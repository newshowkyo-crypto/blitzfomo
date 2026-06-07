// apps/api/src/payment/payment-gateway.factory.ts
// 支付网关工厂（实现 TDD 4.4 可插拔 + 后台动态切换）

import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { MockGateway } from './gateways/mock.gateway';
import { StripeGateway } from './gateways/stripe.gateway';
import { PlisioGateway } from './gateways/plisio.gateway';
import { PaymentGateway } from './gateways/payment-gateway.interface';

@Injectable()
export class PaymentGatewayFactory {
  private readonly gateways: Map<string, PaymentGateway> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly mockGateway: MockGateway,
    private readonly stripeGateway: StripeGateway,
    private readonly plisioGateway: PlisioGateway,
  ) {
    this.gateways.set('mock', this.mockGateway);
    this.gateways.set('stripe', this.stripeGateway);
    this.gateways.set('plisio', this.plisioGateway);
    // TODO: 注册更多真实网关（如 Fireblocks）
  }

  async getActiveGateway(): Promise<PaymentGateway> {
    const gameConfig = await this.configService.getGameConfig();
    const activeName = gameConfig?.activePaymentGateway || 'mock';

    if (process.env.NODE_ENV === 'production' && activeName === 'mock') {
      throw new Error('Mock payment gateway is forbidden in production');
    }

    const gateway = this.gateways.get(activeName);
    if (!gateway) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Unknown payment gateway configured in production: ${activeName}`);
      }
      console.warn(`[Payment] Unknown gateway ${activeName}, falling back to mock`);
      return this.gateways.get('mock')!;
    }
    return gateway;
  }

  getGatewayByName(name: string): PaymentGateway | undefined {
    return this.gateways.get(name);
  }
}
