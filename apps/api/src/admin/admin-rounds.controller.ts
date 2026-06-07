// apps/api/src/admin/admin-rounds.controller.ts
// 后台轮次接口：分页列表 + 轮次详情（含购买记录）

import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminRbacGuard } from './admin-rbac.guard';

@Controller('admin/api/rounds')
@UseGuards(AdminRbacGuard)
export class AdminRoundsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async list(@Query('page') page = 1, @Query('pageSize') pageSize = 10) {
    return this.adminService.listRounds(Number(page), Number(pageSize));
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.adminService.getRoundDetail(id);
  }
}
