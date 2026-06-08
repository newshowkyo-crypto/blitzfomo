// apps/api/src/admin/admin-auth.controller.ts
import { Controller, Post, Get, Body, Req, UseGuards, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcrypt';
import { AdminRbacGuard } from './admin-rbac.guard';

@Controller('admin/api/auth')
export class AdminAuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
  ) {}

  @Get('me')
  @UseGuards(AdminRbacGuard)
  async me(@Req() req: any) {
    return { id: req.user.id, username: req.user.username, role: req.user.role };
  }

  @Post('login')
  async login(@Body() body: { username: string; password: string }, @Req() req: any) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const rateKey = `admin:login:${ip}`;
    const redis = this.redis.getClient();
    const attempts = await redis.incr(rateKey);
    if (attempts === 1) await redis.expire(rateKey, 300);
    if (attempts > 10) {
      throw new HttpException('Too many login attempts. Try again in 5 minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }

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

    await redis.del(rateKey);

    const token = this.jwt.sign(
      { sub: admin.id, username: admin.username, role: admin.role },
      { expiresIn: '8h' },
    );

    return { token, username: admin.username, role: admin.role, msg: 'ok' };
  }
}
