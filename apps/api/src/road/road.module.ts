import { Module } from '@nestjs/common';
import { RoadController } from './road.controller';
import { RoadAdminController } from './road-admin.controller';
import { RoadPricingService } from './road-pricing.service';
import { RoadPurchaseService } from './road-purchase.service';
import { RoadDividendService } from './road-dividend.service';
import { RoadSponsorService } from './road-sponsor.service';
import { RoadSettlementService } from './road-settlement.service';
import { RoadRewardReleaseWorker } from './road-release.worker';
import { RoadTreasuryService } from './road-treasury.service';
import { RoadConfigService } from './road-config.service';
import { RoadEconomyService } from './road-economy.service';
import { LedgerModule } from '../ledger/ledger.module';
import { JwtModule } from '@nestjs/jwt';
import { RoadTreasuryAdminController } from './road-treasury.admin.controller';
import { RoadCommissionReleaseWorker } from './road-commission.worker';
import { RoadKolAdminController } from './road-kol.admin.controller';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be configured in production');
}

@Module({
  imports: [
    LedgerModule,
    JwtModule.register({
      secret: jwtSecret || 'blitz_dev_jwt_secret_change_before_deploy',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [RoadController, RoadAdminController, RoadTreasuryAdminController, RoadKolAdminController],
  providers: [
    RoadPricingService,
    RoadPurchaseService,
    RoadDividendService,
    RoadSponsorService,
    RoadSettlementService,
    RoadRewardReleaseWorker,
    RoadCommissionReleaseWorker,
    RoadTreasuryService,
    RoadConfigService,
    RoadEconomyService,
  ],
  exports: [
    RoadPricingService,
    RoadPurchaseService,
    RoadDividendService,
    RoadSponsorService,
    RoadSettlementService,
    RoadTreasuryService,
    RoadConfigService,
    RoadEconomyService,
  ],
})
export class RoadModule {}
