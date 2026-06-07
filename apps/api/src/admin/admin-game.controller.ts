// apps/api/src/admin/admin-game.controller.ts
// 后台实时监控接口：游戏状态 + 最近购买流（复用 GameService / Prisma）

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminRbacGuard } from './admin-rbac.guard';

@Controller('admin/api/game')
@UseGuards(AdminRbacGuard)
export class AdminGameController {
  constructor(private readonly adminService: AdminService) {}

  @Get('state')
  async state() {
    return this.adminService.getGameState();
  }

  @Get('recent-purchases')
  async recentPurchases(@Query('limit') limit = 20) {
    return this.adminService.getRecentPurchases(Number(limit));
  }
}
