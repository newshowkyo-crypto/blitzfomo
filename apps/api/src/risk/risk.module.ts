// apps/api/src/risk/risk.module.ts
import { Global, Module } from '@nestjs/common';
import { RiskService } from './risk.service';

@Global()
@Module({
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}