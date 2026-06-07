// apps/api/src/admin/admin-risk.controller.ts
// 风控配置接口

import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminRbacGuard } from './admin-rbac.guard';
import { RequireSuperAdmin } from './decorators/require-super-admin.decorator';
import { UpdateRiskConfigDto } from '@blitz/shared/dto/config.dto';

@Controller('admin/api/config/risk')
export class AdminRiskController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async get() {
    return this.adminService.getRiskConfig();
  }

  @Patch()
  @UseGuards(AdminRbacGuard)
  @RequireSuperAdmin()
  async update(@Body() dto: UpdateRiskConfigDto) {
    return this.adminService.updateRiskConfig(dto);
  }
}