// apps/api/src/admin/admin-audit.controller.ts
// 审计日志查询 + CSV 导出（P5 要求）

import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AdminService } from './admin.service';
import { AdminRbacGuard } from './admin-rbac.guard';
import { RequireSuperAdmin } from './decorators/require-super-admin.decorator';

@Controller('admin/api/audit-logs')
@UseGuards(AdminRbacGuard)
export class AdminAuditController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async list(@Query('page') page = 1, @Query('pageSize') pageSize = 50, @Query('adminId') adminId?: string) {
    return this.adminService.listAuditLogs(Number(page), Number(pageSize), adminId);
  }

  @Get('export.csv')
  @UseGuards(AdminRbacGuard)
  @RequireSuperAdmin()
  async exportCsv(@Res() res: Response) {
    const csv = await this.adminService.exportAuditLogsCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"');
    res.send(csv);
  }
}