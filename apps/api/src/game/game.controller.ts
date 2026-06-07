// apps/api/src/game/game.controller.ts
import { Controller, Get, Post, Body, UseGuards, UseInterceptors } from '@nestjs/common';
import { GameService } from './game.service';
import { PurchaseService } from './purchase.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PurchaseDto } from '@blitz/shared/dto/game.dto';
import { RateLimitInterceptor } from '../common/interceptors/rate-limit.interceptor';

@Controller('api/game')
export class GameController {
  constructor(
    private readonly gameService: GameService,
    private readonly purchaseService: PurchaseService,
  ) {}

  @Get('state')
  async getState() {
    return this.gameService.getCurrentState();
  }

  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(RateLimitInterceptor)
  async purchase(@CurrentUser() user: any, @Body() dto: PurchaseDto) {
    // 金额转换：前端传 50.00 → 后端 5000n
    const amount = BigInt(Math.floor(dto.amount * 100));
    const result = await this.purchaseService.purchase(user.id, amount, dto.idempotencyKey);
    // 产品级体验：购买后立即返回最新状态，让前端可以马上刷新
    const state = await this.gameService.getCurrentState();
    return { ...result, state };
  }

  @Get('recent-purchases')
  async recentPurchases() {
    return this.gameService.getRecentPurchases();
  }

  @Get('winner-wall')
  async winnerWall() {
    return this.gameService.getWinnerWall();
  }
}