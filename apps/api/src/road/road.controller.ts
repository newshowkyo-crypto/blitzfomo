import { Body, Controller, Get, Param, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RateLimitInterceptor } from '../common/interceptors/rate-limit.interceptor';
import { RoadPurchaseService } from './road-purchase.service';

@Controller('api/road')
export class RoadController {
  constructor(private readonly roadPurchase: RoadPurchaseService) {}

  @Get('state')
  async state() {
    return this.roadPurchase.getState();
  }

  @Get('teams')
  async teams() {
    return this.roadPurchase.listTeams();
  }

  @Get('pools')
  async pools(@Query('stage') stage?: string, @Query('team') teamCode?: string) {
    return this.roadPurchase.listPools({ stage, teamCode });
  }

  @Get('pools/:id')
  async pool(@Param('id') id: string) {
    return this.roadPurchase.getPool(id);
  }

  @Get('feed')
  async feed() {
    return this.roadPurchase.getFeed();
  }

  @Post('pools/:id/purchase')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(RateLimitInterceptor)
  async purchase(
    @CurrentUser() user: any,
    @Param('id') poolId: string,
    @Body() body: { amount: number; idempotencyKey?: string; referralCode?: string },
  ) {
    const amount = BigInt(Math.floor((Number(body.amount) || 0) * 100));
    return this.roadPurchase.purchase({
      userId: user.id,
      poolId,
      amount,
      idempotencyKey: body.idempotencyKey,
      referralCode: body.referralCode,
    });
  }

  @Get('me/holdings')
  @UseGuards(JwtAuthGuard)
  async myHoldings(@CurrentUser() user: any) {
    return this.roadPurchase.getMyHoldings(user.id);
  }

  @Get('me/dividends')
  @UseGuards(JwtAuthGuard)
  async myDividends(@CurrentUser() user: any) {
    return this.roadPurchase.getMyDividends(user.id);
  }
}
