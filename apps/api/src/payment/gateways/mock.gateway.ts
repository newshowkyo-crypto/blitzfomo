// apps/api/src/payment/gateways/mock.gateway.ts
// Mock 支付网关（开发联调专用）
// 特点：创建订单后自动回调成功，便于全链路测试

import { Injectable } from '@nestjs/common';
import { PaymentGateway } from './payment-gateway.interface';

@Injectable()
export class MockGateway implements PaymentGateway {
  async createOrder(paymentId: string, amount: bigint, userId: string) {
    return {
      payUrl: `https://mock-pay.blitzfinale.local/pay/${paymentId}`,
      qrCode: `mock-qr-${paymentId}`,
      extra: { message: 'This is a MOCK payment. It will succeed automatically.' },
    };
  }

  async verifyCallback(rawBody: any, headers?: any): Promise<boolean> {
    return true;
  }

  async parseCallback(rawBody: any) {
    return {
      orderId: rawBody?.paymentId || '',
      amount: BigInt(rawBody?.amount || 0),
      success: true,
      gatewayTransactionId: `mock-tx-${Date.now()}`,
    };
  }
}