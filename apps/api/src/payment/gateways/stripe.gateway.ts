// apps/api/src/payment/gateways/stripe.gateway.ts
// Stripe 支付网关占位实现（真实项目需接入 Stripe SDK + 验签）

import { Injectable } from '@nestjs/common';
import { PaymentGateway } from './payment-gateway.interface';

@Injectable()
export class StripeGateway implements PaymentGateway {
  async createOrder(paymentId: string, amount: bigint, userId: string) {
    // TODO: 调用 Stripe Checkout Session 创建
    return {
      payUrl: `https://checkout.stripe.com/pay/${paymentId}?amount=${amount}`,
      extra: { provider: 'stripe', mode: 'checkout' },
    };
  }

  async verifyCallback(rawBody: any, headers: any): Promise<boolean> {
    throw new Error('Stripe gateway is not implemented. Configure a supported gateway.');
  }

  async parseCallback(rawBody: any) {
    // TODO: 从 Stripe event 中解析 payment_intent.succeeded
    return {
      orderId: rawBody.data?.object?.metadata?.paymentId || '',
      amount: BigInt(rawBody.data?.object?.amount || 0),
      success: rawBody.type === 'payment_intent.succeeded',
      gatewayTransactionId: rawBody.data?.object?.id,
    };
  }
}