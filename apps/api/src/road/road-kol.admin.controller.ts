import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { RoadCommissionStatus } from '@prisma/client';
import { AdminRbacGuard } from '../admin/admin-rbac.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/api/road/kol')
@UseGuards(AdminRbacGuard)
export class RoadKolAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('create')
  async create(@Body() body: { userId: string; referralCode: string }) {
    return this.prisma.roadKol.upsert({
      where: { referralCode: body.referralCode },
      update: { inviterId: body.userId, status: 'ACTIVE' },
      create: {
        seasonCode: 'WC2026',
        referralCode: body.referralCode,
        inviterId: body.userId,
        status: 'ACTIVE',
      },
    });
  }

  @Get('commissions')
  async commissions(@Query('status') status?: RoadCommissionStatus, @Query('limit') limit?: string) {
    const take = Math.min(Math.max(Number(limit || 100), 1), 500);
    const where: any = { seasonCode: 'WC2026' };
    if (status) where.status = status;
    return this.prisma.roadReferralCommission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        inviter: { select: { id: true, nickname: true, walletAddress: true } },
        referredUser: { select: { id: true, nickname: true, walletAddress: true } },
      },
    });
  }

  @Get('summary')
  async summary() {
    const rows = await this.prisma.roadReferralCommission.groupBy({
      by: ['status'],
      where: { seasonCode: 'WC2026' },
      _count: { _all: true },
      _sum: { commissionAmount: true },
    });
    return rows.map((r) => ({
      status: r.status,
      count: r._count._all,
      amount: r._sum.commissionAmount ?? 0n,
    }));
  }
}

