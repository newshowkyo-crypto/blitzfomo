// apps/api/src/withdraw/withdraw.controller.ts
import { Controller, Post, Get, Body, UseGuards, UseInterceptors } from '@nestjs/common';
import { WithdrawService } from './withdraw.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateWithdrawDto } from '@blitz/shared/dto/withdraw.dto';
import { RateLimitInterceptor } from '../common/interceptors/rate-limit.interceptor';

@Controller('api/withdraw')
export class WithdrawController {
  constructor(private readonly withdrawService: WithdrawService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(RateLimitInterceptor)
  async create(@CurrentUser() user: any, @Body() dto: CreateWithdrawDto) {
    return this.withdrawService.createWithdraw(user.id, dto);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async history(@CurrentUser() user: any) {
    // 简化：实际应分页
    return this.withdrawService.getHistory(user.id);
  }
}