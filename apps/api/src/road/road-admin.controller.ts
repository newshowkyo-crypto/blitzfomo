import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminRbacGuard } from '../admin/admin-rbac.guard';
import { RequireSuperAdmin } from '../admin/decorators/require-super-admin.decorator';
import { RoadSponsorService } from './road-sponsor.service';
import { RoadSettlementService } from './road-settlement.service';
import { RoadPurchaseService } from './road-purchase.service';
import { RoadConfigService } from './road-config.service';
import { RoadEconomyService } from './road-economy.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoadStage } from '@prisma/client';

@Controller('admin/api/road')
@UseGuards(AdminRbacGuard)
export class RoadAdminController {
  constructor(
    private readonly roadPurchase: RoadPurchaseService,
    private readonly roadSponsor: RoadSponsorService,
    private readonly roadSettlement: RoadSettlementService,
    private readonly roadConfig: RoadConfigService,
    private readonly roadEconomy: RoadEconomyService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('super-jackpot/reset')
  @RequireSuperAdmin()
  async resetSuperJackpot(@Body() body: { amount: number }) {
    const amount = BigInt(Math.round(body.amount * 100));
    await this.prisma.superJackpot.upsert({
      where: { seasonCode: 'WC2026' },
      create: { seasonCode: 'WC2026', amount, status: 'ACTIVE' },
      update: { amount },
    });
    return { success: true, amount };
  }

  @Get('economy/overview')
  async economyOverview(@Query('stage') stage?: RoadStage) {
    const targetStage = stage || 'TOP32';
    return this.roadEconomy.calculateDynamicEconomy(targetStage);
  }

  @Get('overview')
  async overview() {
    return this.roadPurchase.getAdminOverview();
  }

  @Get('liability')
  async liability() {
    return this.roadPurchase.getAdminLiability();
  }

  @Get('teams')
  async teams() {
    return this.roadPurchase.listTeams();
  }

  @Post('teams')
  @RequireSuperAdmin()
  async createTeam(@Req() req: any, @Body() body: any) {
    return this.roadPurchase.createTeam(req.user.id, body);
  }

  @Patch('teams/:id')
  @RequireSuperAdmin()
  async updateTeam(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.roadPurchase.updateTeam(req.user.id, id, body);
  }

  @Get('pools')
  async pools(@Query('status') status?: string, @Query('stage') stage?: string, @Query('teamId') teamId?: string) {
    return this.roadPurchase.adminListPools({ status, stage, teamId });
  }

  @Post('pools')
  @RequireSuperAdmin()
  async createPool(@Req() req: any, @Body() body: any) {
    return this.roadPurchase.createPool(req.user.id, body);
  }

  @Patch('pools/:id')
  @RequireSuperAdmin()
  async updatePool(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.roadPurchase.updatePool(req.user.id, id, body);
  }

  @Post('pools/:id/close')
  @RequireSuperAdmin()
  async closePool(@Req() req: any, @Param('id') id: string) {
    return this.roadSettlement.closePool(req.user.id, id);
  }

  @Post('pools/:id/sponsor')
  @RequireSuperAdmin()
  async sponsor(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { amount: number; note?: string; reference?: string },
  ) {
    const amount = BigInt(Math.floor((Number(body.amount) || 0) * 100));
    return this.roadSponsor.sponsorPool(req.user.id, id, amount, { note: body.note, reference: body.reference });
  }

  @Get('sponsor/budget')
  async sponsorBudget() {
    return this.roadSponsor.getGlobalBudget();
  }

  @Patch('sponsor/budget')
  @RequireSuperAdmin()
  async updateSponsorBudget(@Req() req: any, @Body() body: { totalBudget?: number; status?: string; resetUsed?: boolean }) {
    const totalBudget = body.totalBudget !== undefined ? BigInt(Math.floor((Number(body.totalBudget) || 0) * 100)) : undefined;
    return this.roadSponsor.updateGlobalBudget(req.user.id, { totalBudget, status: body.status, resetUsed: body.resetUsed });
  }

  @Get('config')
  async config() {
    return this.roadConfig.get();
  }

  @Patch('config')
  @RequireSuperAdmin()
  async updateConfig(@Req() req: any, @Body() body: any) {
    return this.roadConfig.update(req.user.id, body);
  }

  @Post('results/advance/preview')
  @RequireSuperAdmin()
  async advancePreview(@Req() req: any, @Body() body: { teamId: string; reachedStage: string }) {
    return this.roadSettlement.previewAdvance(req.user.id, body.teamId, body.reachedStage);
  }

  @Post('results/advance')
  @RequireSuperAdmin()
  async advance(@Req() req: any, @Body() body: { teamId: string; reachedStage: string }) {
    return this.roadSettlement.advanceTeam(req.user.id, body.teamId, body.reachedStage);
  }

  @Post('results/eliminate/preview')
  @RequireSuperAdmin()
  async eliminatePreview(@Req() req: any, @Body() body: { teamId: string; eliminatedAtStage: string }) {
    return this.roadSettlement.previewEliminate(req.user.id, body.teamId, body.eliminatedAtStage);
  }

  @Post('results/eliminate')
  @RequireSuperAdmin()
  async eliminate(@Req() req: any, @Body() body: { teamId: string; eliminatedAtStage: string }) {
    return this.roadSettlement.eliminateTeam(req.user.id, body.teamId, body.eliminatedAtStage);
  }
}
