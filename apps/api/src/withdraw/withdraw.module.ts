// apps/api/src/withdraw/withdraw.module.ts
import { Module } from '@nestjs/common';
import { WithdrawController } from './withdraw.controller';
import { WithdrawService } from './withdraw.service';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  controllers: [WithdrawController],
  providers: [WithdrawService],
})
export class WithdrawModule {}