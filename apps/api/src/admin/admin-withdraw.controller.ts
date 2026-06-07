// apps/api/src/admin/admin-withdraw.controller.ts
// 提现审核相关 Admin 接口（P5 核心运营功能）

import { Controller, Get, Post, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminRbacGuard } from './admin-rbac.guard';
import { RequireSuperAdmin } from './decorators/require-super-admin.decorator';

@Controller('admin/api/withdrawals')
@UseGuards(AdminRbacGuard)
export class AdminWithdrawController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async list(@Query('status') status?: string) {
    return this.adminService.listWithdrawals(status);
  }

  @Post(':id/approve')
  @UseGuards(AdminRbacGuard)
  async approve(@Param('id') id: string, @Body() body: { remark?: string }, @Req() req: any) {
    return this.adminService.approveWithdrawal(id, req.user.id, body.remark);
  }

  @Post(':id/reject')
  @UseGuards(AdminRbacGuard)
  async reject(@Param('id') id: string, @Body() body: { reason: string }, @Req() req: any) {
    return this.adminService.rejectWithdrawal(id, req.user.id, body.reason);
  }

  @Post(':id/mark-paid')
  @UseGuards(AdminRbacGuard)
  @RequireSuperAdmin()
  async markPaid(@Param('id') id: string, @Body() body: { txHash?: string }, @Req() req: any) {
    return this.adminService.markWithdrawalPaid(id, req.user.id, body.txHash);
  }
}
