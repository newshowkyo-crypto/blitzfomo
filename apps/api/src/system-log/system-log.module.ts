// apps/api/src/system-log/system-log.module.ts
// 全局模块：让 SystemLogService 可被任意模块注入，无需逐个修改各业务模块的 imports。
// PrismaModule 已是 @Global，这里无需再次导入。

import { Global, Module } from '@nestjs/common';
import { SystemLogService } from './system-log.service';

@Global()
@Module({
  providers: [SystemLogService],
  exports: [SystemLogService],
})
export class SystemLogModule {}
