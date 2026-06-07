import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RoadTreasuryBucket, RoadTreasuryEventType } from '@prisma/client';
import { AdminRbacGuard } from '../admin/admin-rbac.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RoadTreasuryService } from './road-treasury.service';

@Controller('admin/api/road/treasury')
@UseGuards(AdminRbacGuard)
export class RoadTreasuryAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly treasury: RoadTreasuryService,
  ) {}

  @Get('buckets')
  async buckets() {
    return this.prisma.$transaction((tx) => this.treasury.getBucketTotals(tx));
  }

  @Get('entries')
  async entries(
    @Query('bucket') bucket?: RoadTreasuryBucket,
    @Query('eventType') eventType?: RoadTreasuryEventType,
    @Query('eventId') eventId?: string,
    @Query('poolId') poolId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.prisma.$transaction((tx) =>
      this.treasury.listEntries(tx, {
        bucket,
        eventType,
        eventId,
        poolId,
        limit: limit ? Number(limit) : undefined,
      }),
    );
  }

  @Get('reconcile')
  async reconcile() {
    return this.prisma.$transaction((tx) => this.treasury.reconcile(tx));
  }
}

