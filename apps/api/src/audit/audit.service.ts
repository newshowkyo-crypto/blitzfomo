// apps/api/src/audit/audit.service.ts
// 审计日志服务（所有敏感写操作必须调用此服务记录 admin_audit_log）

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    adminId: string;
    action: string;
    targetType?: string;
    targetId?: string;
    before?: any;
    after?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    await this.prisma.adminAuditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        before: params.before,
        after: params.after,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }
}