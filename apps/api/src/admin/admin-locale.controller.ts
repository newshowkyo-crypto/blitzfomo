// apps/api/src/admin/admin-locale.controller.ts
// 多语言管理（P5 要求之一）

import { Controller, Get, Put, Post, Param, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminRbacGuard } from './admin-rbac.guard';
import { RequireSuperAdmin } from './decorators/require-super-admin.decorator';

@Controller('admin/api/locales')
export class AdminLocaleController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async list() {
    return this.adminService.getLocales();
  }

  @Put(':lang')
  @UseGuards(AdminRbacGuard)
  async update(@Param('lang') lang: string, @Body() content: any) {
    return this.adminService.updateLocale(lang, content);
  }

  @Post(':lang/set-default')
  @UseGuards(AdminRbacGuard)
  @RequireSuperAdmin()
  async setDefault(@Param('lang') lang: string) {
    return this.adminService.setDefaultLocale(lang);
  }
}