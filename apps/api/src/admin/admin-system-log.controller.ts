// apps/api/src/admin/admin-system-log.controller.ts
// 后台系统日志接口：分页查询 + CSV 导出（无数据时返回稳定空分页/空 CSV）

import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AdminService } from './admin.service';
import { AdminRbacGuard } from './admin-rbac.guard';

@Controller('admin/api/system-logs')
@UseGuards(AdminRbacGuard)
export class AdminSystemLogController {
  constructor(private readonly adminService: AdminService) {}

  @Get('export.csv')
  async exportCsv(@Query('level') level: string, @Res() res: Response) {
    const csv = await this.adminService.exportSystemLogsCsv(level);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="system_logs.csv"');
    res.send(csv);
  }

  @Get()
  async list(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 10,
    @Query('level') level?: string,
  ) {
    return this.adminService.listSystemLogs(Number(page), Number(pageSize), level);
  }
}
