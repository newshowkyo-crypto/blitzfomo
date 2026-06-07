// apps/api/src/admin/admin-rbac.guard.ts
// Admin RBAC 守卫（区分 SUPER_ADMIN / OPERATOR）

import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AdminRbacGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const rawAuth = request.headers?.authorization || '';
    const token = rawAuth.startsWith('Bearer ') ? rawAuth.slice(7) : '';

    if (!token) {
      throw new UnauthorizedException('Admin token missing');
    }

    let payload: any;
    try {
      payload = this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired admin token');
    }
    const admin = {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
    };
    request.user = admin;

    // 关键安全校验：用户端 JWT 与后台 JWT 使用同一个 JWT_SECRET 签名，
    // 因此必须显式校验角色，禁止普通用户 token（role: 'user'）冒充后台身份。
    const ADMIN_ROLES = ['SUPER_ADMIN', 'OPERATOR'];
    if (!admin.role || !ADMIN_ROLES.includes(admin.role)) {
      throw new ForbiddenException('Admin privileges required');
    }

    // 示例：某些路由需要 SUPER_ADMIN
    const requiredRole = this.reflector.get<string>('requireSuperAdmin', context.getHandler());
    if (requiredRole === 'SUPER_ADMIN' && admin.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only SUPER_ADMIN can perform this action');
    }

    return true;
  }
}
