// apps/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';

import { GameModule } from './game/game.module';
import { UserModule } from './user/user.module';
import { PaymentModule } from './payment/payment.module';
import { WithdrawModule } from './withdraw/withdraw.module';
import { AdminModule } from './admin/admin.module';
import { LedgerModule } from './ledger/ledger.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { SocketModule } from './socket/socket.module';
import { AuditModule } from './audit/audit.module';
import { RiskModule } from './risk/risk.module';
import { HealthModule } from './health/health.module';
import { LocaleModule } from './locale/locale.module';
import { SettlementModule } from './settlement/settlement.module';
import { RoadModule } from './road/road.module';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SystemLogModule } from './system-log/system-log.module';

import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    SystemLogModule,
    LedgerModule,
    AuthModule,
    ConfigModule,
    SocketModule,
    AuditModule,
    RiskModule,
    LocaleModule,
    HealthModule,
    GameModule,
    UserModule,
    PaymentModule,
    WithdrawModule,
    SettlementModule,
    AdminModule,
    RoadModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
