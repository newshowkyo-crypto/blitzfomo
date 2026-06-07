// apps/api/src/admin/admin.controller.ts
// Admin 后台接口骨架（RBAC + 审计待完善）

import { Controller, Get, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminRbacGuard } from './admin-rbac.guard';
import { RequireSuperAdmin } from './decorators/require-super-admin.decorator';

@Controller('admin/api')
@UseGuards(AdminRbacGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/stats')
  async getStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('dashboard/trend')
  async getTrend(@Query('days') days = 7) {
    return this.adminService.getDashboardTrend(Number(days));
  }

  @Get('config/game')
  async getGameConfig() {
    return this.adminService.getGameConfig();
  }

  @Patch('config/game')
  @UseGuards(AdminRbacGuard)
  @RequireSuperAdmin()
  async updateGameConfig(@Body() body: any) {
    return this.adminService.updateGameConfig(body);
  }
}