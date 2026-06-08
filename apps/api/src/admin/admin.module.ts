// apps/api/src/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminWithdrawController } from './admin-withdraw.controller';
import { AdminPaymentController } from './admin-payment.controller';
import { AdminUserController } from './admin-user.controller';
import { AdminRiskController } from './admin-risk.controller';
import { AdminBotController } from './admin-bot.controller';
import { AdminAuditController } from './admin-audit.controller';
import { AdminLocaleController } from './admin-locale.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AdminGameController } from './admin-game.controller';
import { AdminRoundsController } from './admin-rounds.controller';
import { AdminSystemLogController } from './admin-system-log.controller';
import { AdminService } from './admin.service';
import { LedgerModule } from '../ledger/ledger.module';
import { GameModule } from '../game/game.module';
import { QueueModule } from '../queue/queue.module';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('FATAL: JWT_SECRET environment variable is required');
}

@Module({
  imports: [
    LedgerModule,
    GameModule,
    QueueModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [
    AdminController,
    AdminWithdrawController,
    AdminPaymentController,
    AdminUserController,
    AdminRiskController,
    AdminBotController,
    AdminAuditController,
    AdminLocaleController,
    AdminAuthController,
    AdminGameController,
    AdminRoundsController,
    AdminSystemLogController,
  ],
  providers: [AdminService],
})
export class AdminModule {}
