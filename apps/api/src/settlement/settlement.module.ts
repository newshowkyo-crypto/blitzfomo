import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { SettlementWorker } from './settlement.worker';

@Module({
  imports: [LedgerModule],
  providers: [SettlementWorker],
})
export class SettlementModule {}
