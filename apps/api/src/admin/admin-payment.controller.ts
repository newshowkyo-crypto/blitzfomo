// apps/api/src/admin/admin-payment.controller.ts
// 支付网关配置（加密存储 + 切换）- Admin 接口

import { Controller, Get, Post, Patch, Body, Param, UseGuards, Query, Req } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminRbacGuard } from './admin-rbac.guard';
import { RequireSuperAdmin } from './decorators/require-super-admin.decorator';

@Controller('admin/api/payment')
export class AdminPaymentController {
  constructor(private readonly adminService: AdminService) {}

  @Get('gateways')
  async listGateways() {
    return this.adminService.getPaymentGateways();
  }

  @Patch('gateways/:name/activate')
  @UseGuards(AdminRbacGuard)
  @RequireSuperAdmin()
  async activate(@Param('name') name: string) {
    return this.adminService.activatePaymentGateway(name);
  }

  @Patch('gateways/:name/config')
  @UseGuards(AdminRbacGuard)
  @RequireSuperAdmin()
  async updateConfig(@Param('name') name: string, @Body() config: any) {
    // 敏感配置必须 super_admin + 加密存储（TODO）
    return this.adminService.updatePaymentGatewayConfig(name, config);
  }

  // 订单/支付列表 + 手动标记支付 (CODEX 要求的重要 Admin 功能)
  @Get('orders')
  async listOrders(@Query('page') page = 1, @Query('pageSize') pageSize = 50, @Query('status') status?: string) {
    return this.adminService.listPayments(Number(page), Number(pageSize), status);
  }

  @Post('orders/:id/mark-paid')
  @UseGuards(AdminRbacGuard)
  @RequireSuperAdmin()
  async markPaid(@Param('id') id: string, @Body() body: { remark?: string }, @Req() req: any) {
    return this.adminService.markPaymentPaid(id, req.user.id, body.remark);
  }
}
