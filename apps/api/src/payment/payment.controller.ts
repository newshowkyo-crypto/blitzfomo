import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentService } from './payment.service';

@Controller('api/payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: any, @Body() body: { amountUsdt: number; psysCid?: string }) {
    return this.paymentService.createOrder(user.id, body.amountUsdt, body.psysCid);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getOrder(@CurrentUser() user: any, @Param('id') id: string) {
    return this.paymentService.getOrderForUser(id, user.id);
  }

  @Post('webhook/:gateway')
  async webhook(@Param('gateway') gateway: string, @Body() body: any, @Headers() headers: any) {
    return this.paymentService.handleGatewayCallback(gateway, body, headers);
  }
}
