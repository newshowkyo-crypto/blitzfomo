// apps/api/src/admin/admin-auth.controller.ts
import { Controller, Post, Get, Body, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminRbacGuard } from './admin-rbac.guard';

@Controller('admin/api/auth')
export class AdminAuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // 校验当前 token 是否仍然有效（前端启动时调用，避免失效 token 直接进入后台）
  @Get('me')
  @UseGuards(AdminRbacGuard)
  async me(@Req() req: any) {
    return { id: req.user.id, username: req.user.username, role: req.user.role };
  }

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    const { username, password } = body;

    const admin = await this.prisma.admin.findUnique({
      where: { username },
    });

    if (!admin || !admin.passwordHash) {
      throw new UnauthorizedException({ code: 40101, msg: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException({ code: 40101, msg: 'Invalid credentials' });
    }

    const token = this.jwt.sign(
      { sub: admin.id, username: admin.username, role: admin.role },
      { expiresIn: '8h' },
    );

    return { token, username: admin.username, role: admin.role, msg: 'ok' };
  }
}
