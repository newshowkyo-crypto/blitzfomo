// apps/api/src/game/game.module.ts
import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { PurchaseService } from './purchase.service';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  controllers: [GameController],
  providers: [GameService, PurchaseService],
  exports: [GameService, PurchaseService],
})
export class GameModule {}