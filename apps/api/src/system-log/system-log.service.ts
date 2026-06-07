// apps/api/src/system-log/system-log.service.ts
// 轻量系统日志服务：把运营/资金相关的关键事件结构化落库到 system_logs 表，
// 供后台「系统日志」页查询。
//
// 设计铁律：
// - 仅记录事件，绝不参与资金/结算/防薅核心逻辑；
// - write() 永不抛出，日志失败只退化为应用日志，不影响主业务流程；
// - 字段与 prisma SystemLog 模型严格对齐：level / module / message / meta；
//   前端 SystemLogs.jsx 读取的也是这些字段（meta），不存在 context/stack。

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type SystemLogLevel = 'INFO' | 'WARN' | 'ERROR';

@Injectable()
export class SystemLogService {
  private readonly logger = new Logger(SystemLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  info(module: string, message: string, meta?: Record<string, any>) {
    return this.write('INFO', module, message, meta);
  }

  warn(module: string, message: string, meta?: Record<string, any>) {
    return this.write('WARN', module, message, meta);
  }

  error(module: string, message: string, meta?: Record<string, any>) {
    return this.write('ERROR', module, message, meta);
  }

  private async write(
    level: SystemLogLevel,
    module: string,
    message: string,
    meta?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.prisma.systemLog.create({
        data: {
          level,
          module,
          message: String(message ?? '').slice(0, 2000),
          meta: meta ? this.sanitize(meta) : undefined,
        },
      });
    } catch (e: any) {
      // 落库失败绝不能影响主流程，仅记录到应用日志
      this.logger.warn(`[SystemLog] failed to persist (${module}): ${e?.message}`);
    }
  }

  // BigInt 无法直接写入 Prisma Json，统一转字符串；同时防止循环引用导致序列化异常。
  private sanitize(meta: Record<string, any>): any {
    try {
      return JSON.parse(
        JSON.stringify(meta, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
      );
    } catch {
      return { note: 'meta-not-serializable' };
    }
  }
}
