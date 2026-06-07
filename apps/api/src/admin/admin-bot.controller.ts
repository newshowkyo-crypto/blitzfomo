// apps/api/src/admin/admin-bot.controller.ts
// 机器人配置 + 手动触发（P5 / P7）

import { Controller, Get, Patch, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminRbacGuard } from './admin-rbac.guard';
import { RequireSuperAdmin } from './decorators/require-super-admin.decorator';

@Controller('admin/api/config/bot')
export class AdminBotController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async get() {
    return this.adminService.getBotConfig();
  }

  @Patch()
  @UseGuards(AdminRbacGuard)
  @RequireSuperAdmin()
  async update(@Body() body: any) {
    return this.adminService.updateBotConfig(body);
  }

  @Post('trigger-once')
  @UseGuards(AdminRbacGuard)
  @RequireSuperAdmin()
  async triggerOnce(@Req() req: any) {
    return this.adminService.triggerBotPurchaseOnce(req.user.id);
  }

  @Post('create-users')
  @UseGuards(AdminRbacGuard)
  @RequireSuperAdmin()
  async createUsers(@Body() body: { count?: number }) {
    return this.adminService.createBotUsers(body.count || 5);
  }
}
