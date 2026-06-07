// apps/api/src/payment/payment.module.ts
import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { MockGateway } from './gateways/mock.gateway';
import { StripeGateway } from './gateways/stripe.gateway';
import { PlisioGateway } from './gateways/plisio.gateway';
import { PaymentGatewayFactory } from './payment-gateway.factory';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  controllers: [PaymentController],
  providers: [PaymentService, MockGateway, StripeGateway, PlisioGateway, PaymentGatewayFactory],
  exports: [PaymentService],
})
export class PaymentModule {}
