import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { LedgerType } from '@prisma/client';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentGatewayFactory } from './payment-gateway.factory';
import { PaymentGateway } from './gateways/payment-gateway.interface';
import { SystemLogService } from '../system-log/system-log.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly systemLog: SystemLogService,
  ) {}

  private async getActiveGateway(): Promise<PaymentGateway> {
    return this.gatewayFactory.getActiveGateway();
  }

  async createOrder(userId: string, amountUsdt: number, psysCid?: string) {
    if (!Number.isFinite(amountUsdt) || amountUsdt < 10 || amountUsdt > 100000) {
      throw new BadRequestException('Invalid payment amount');
    }

    // 充值币种闭环：只允许 env 白名单内币种，未传默认 USDT_TRX
    const allowedCids = (process.env.PLISIO_ALLOWED_PSYS_CIDS || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const selectedCid = (psysCid ? String(psysCid).trim() : '') || 'USDT_TRX';
    if (allowedCids.length > 0 && !allowedCids.includes(selectedCid)) {
      throw new BadRequestException('Unsupported payment currency');
    }

    const amount = BigInt(Math.floor(amountUsdt * 100));
    const gateway = await this.getActiveGateway();
    const gameConfig = await this.prisma.gameConfig.findUnique({ where: { id: 1 } });
    const gatewayName = gameConfig?.activePaymentGateway || 'mock';

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        gateway: gatewayName,
        amountUsdt: amount,
        status: 'PENDING',
      },
    });

    const result = await gateway.createOrder(payment.id, amount, userId, selectedCid);

    if (result.extra?.gatewayOrderId) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { gatewayOrderId: String(result.extra.gatewayOrderId) },
      });
    }

    if (gatewayName === 'mock') {
      setTimeout(async () => {
        await this.handleSuccessfulPayment(payment.id, userId, amount);
      }, 2200);
    }

    return {
      orderId: payment.id,
      ...result,
      gateway: gatewayName,
    };
  }

  async getOrderForUser(paymentId: string, userId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
      select: {
        id: true,
        gateway: true,
        gatewayOrderId: true,
        amountUsdt: true,
        status: true,
        paidAt: true,
        createdAt: true,
      },
    });

    if (!payment) {
      throw new BadRequestException('Payment order not found');
    }

    return payment;
  }

  private async handleSuccessfulPayment(paymentId: string, userId?: string, amount?: bigint) {
    const credited = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment || payment.status !== 'PENDING') return null;

      const statusUpdated = await tx.payment.updateMany({
        where: { id: paymentId, status: 'PENDING' },
        data: { status: 'PAID', paidAt: new Date() },
      });
      if (statusUpdated.count !== 1) return null;

      const creditUserId = userId || payment.userId;
      const creditAmount = amount && amount > 0n ? amount : payment.amountUsdt;

      const result = await this.ledger.applyLedgerTx(tx, {
        userId: creditUserId,
        type: LedgerType.RECHARGE,
        amount: creditAmount,
        description: `Recharge via ${payment.gateway}`,
        paymentId,
      });

      return { creditUserId, creditAmount, balanceAfter: result.balanceAfter };
    });

    if (credited) {
      this.logger.log(`[PAYMENT] Successful recharge: user=${credited.creditUserId} amount=${credited.creditAmount}`);
    }
  }

  private async handleFailedPayment(paymentId: string, reason?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status !== 'PENDING') return;

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'FAILED',
        callbackRaw: reason ? { reason } : undefined,
      },
    });
  }

  async handleGatewayCallback(gatewayName: string, rawBody: any, headers: any) {
    const gateway = this.gatewayFactory.getGatewayByName(gatewayName);
    if (!gateway) {
      await this.systemLog.error('payment', `Unknown payment gateway in webhook: ${gatewayName}`, {
        gateway: gatewayName,
      });
      throw new Error(`Unknown gateway: ${gatewayName}`);
    }

    try {
      const isValid = await gateway.verifyCallback(rawBody, headers);
      if (!isValid) {
        // Plisio verify_hash 校验失败 / 回调签名无效 → 记录告警，便于事后排查伪造或配置问题
        await this.systemLog.error('payment', `Gateway callback signature verification failed (${gatewayName})`, {
          gateway: gatewayName,
          orderId: rawBody?.order_number || rawBody?.orderNumber || null,
          status: rawBody?.status || null,
        });
        throw new Error('Invalid callback signature');
      }

      const parsed = await gateway.parseCallback(rawBody);
      if (!parsed.orderId) {
        await this.systemLog.warn('payment', `Gateway callback missing order id (${gatewayName})`, {
          gateway: gatewayName,
          status: parsed.status || null,
        });
        throw new BadRequestException('Missing payment order id');
      }

      // 金额 mismatch：Plisio 标记实付与发票不符，绝不自动全额入账，留待后台人工核对
      if (String(parsed.status || '').toLowerCase() === 'mismatch') {
        const order = await this.prisma.payment.findUnique({ where: { id: parsed.orderId } });
        await this.systemLog.warn('payment', `Payment amount mismatch, manual review required (${gatewayName})`, {
          gateway: gatewayName,
          orderId: parsed.orderId,
          callbackAmount: parsed.amount?.toString?.() ?? null,
          orderAmount: order?.amountUsdt?.toString?.() ?? null,
          status: parsed.status,
        });
      }

      if (parsed.success) {
        await this.handleSuccessfulPayment(parsed.orderId);
      } else if (['expired', 'cancelled', 'error'].includes(String(parsed.status || '').toLowerCase())) {
        await this.handleFailedPayment(parsed.orderId, parsed.status);
      }

      return { ok: true, orderId: parsed.orderId, success: parsed.success };
    } catch (err: any) {
      // BadRequest/签名失败已单独记日志，这里只补记未预期的 webhook 异常，然后原样抛出
      if (!(err instanceof BadRequestException) && err?.message !== 'Invalid callback signature') {
        await this.systemLog.error('payment', `Payment webhook processing error (${gatewayName})`, {
          gateway: gatewayName,
          error: err?.message,
        });
      }
      throw err;
    }
  }
}
