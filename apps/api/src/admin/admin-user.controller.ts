// apps/api/src/admin/admin-user.controller.ts
// 用户管理接口（P5 要求：CRUD、冻结、调余额、查看 ledger）

import { Controller, Get, Patch, Post, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminRbacGuard } from './admin-rbac.guard';
import { RequireSuperAdmin } from './decorators/require-super-admin.decorator';

@Controller('admin/api/users')
@UseGuards(AdminRbacGuard)
export class AdminUserController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async list(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.listUsers(Number(page), Number(pageSize), search, status);
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Get(':id/ledger')
  async ledger(@Param('id') id: string, @Query('page') page = 1, @Query('pageSize') pageSize = 20) {
    return this.adminService.getUserLedger(id, Number(page), Number(pageSize));
  }

  @Patch(':id/freeze')
  @UseGuards(AdminRbacGuard)
  async freeze(@Param('id') id: string, @Body() body: { freeze: boolean; reason?: string }, @Req() req: any) {
    return this.adminService.freezeUser(id, body.freeze, body.reason, req.user.id);
  }

  @Post(':id/adjust-balance')
  @UseGuards(AdminRbacGuard)
  @RequireSuperAdmin()
  async adjustBalance(@Param('id') id: string, @Body() body: { amount: number; reason: string }, @Req() req: any) {
    return this.adminService.adjustUserBalance(id, BigInt(Math.floor(body.amount * 100)), body.reason, req.user.id);
  }

  @Post(':id/update-nickname')
  @UseGuards(AdminRbacGuard)
  @RequireSuperAdmin()
  async updateNickname(@Param('id') id: string, @Body() body: { nickname: string }) {
    return this.adminService.updateUserNickname(id, body.nickname);
  }
}
