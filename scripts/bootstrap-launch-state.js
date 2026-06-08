const { PrismaClient, RoadTreasuryBucket, RoadTreasuryEventType } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_TEAMS = ['BRA', 'ARG', 'FRA', 'POR'];

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name, fallback) => {
    const prefix = `--${name}=`;
    const found = args.find((item) => item.startsWith(prefix));
    return found ? found.slice(prefix.length) : fallback;
  };

  return {
    apply: args.includes('--apply'),
    superPool: Number(get('super-pool', '500')),
    sponsor: Number(get('sponsor', '100')),
    teams: get('teams', DEFAULT_TEAMS.join(',')).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
  };
}

function cents(amount) {
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`Invalid amount: ${amount}`);
  return BigInt(Math.round(amount * 100));
}

async function main() {
  const options = parseArgs();
  const superTarget = cents(options.superPool);
  const sponsorAmount = cents(options.sponsor);

  console.log('Launch bootstrap plan');
  console.log(`mode=${options.apply ? 'APPLY' : 'DRY_RUN'}`);
  console.log(`superPoolTarget=${options.superPool}`);
  console.log(`sponsorPerTeam=${options.sponsor}`);
  console.log(`teams=${options.teams.join(',')}`);

  const result = await prisma.$transaction(async (tx) => {
    const actions = [];

    const superJackpot = await tx.superJackpot.upsert({
      where: { seasonCode: 'WC2026' },
      update: {},
      create: { seasonCode: 'WC2026', amount: 0n, status: 'ACTIVE' },
    });
    const superDelta = superTarget - superJackpot.amount;
    if (superDelta > 0n) {
      actions.push({ type: 'super-jackpot', from: superJackpot.amount, to: superTarget, delta: superDelta });
      if (options.apply) {
        await tx.superJackpot.update({
          where: { seasonCode: 'WC2026' },
          data: { amount: superTarget },
        });
        await tx.roadTreasuryLedger.create({
          data: {
            seasonCode: 'WC2026',
            eventType: RoadTreasuryEventType.SPONSOR_INJECT,
            eventId: 'launch-super-pool-bootstrap',
            entryKey: `SUPER_JACKPOT|launch-super-pool-bootstrap|${superDelta.toString()}`,
            bucket: RoadTreasuryBucket.SUPER_JACKPOT,
            amount: superDelta,
            meta: { reason: 'launch_bootstrap', target: superTarget.toString() },
          },
        }).catch((err) => {
          if (err?.code !== 'P2002') throw err;
        });
      }
    }

    const pools = await tx.roadPool.findMany({
      where: { stage: 'TOP32', status: 'OPEN', team: { code: { in: options.teams } } },
      include: { team: true },
    });

    const totalSponsorNeeded = sponsorAmount * BigInt(pools.length);
    const budget = await tx.officialSponsorBudget.upsert({
      where: { seasonCode: 'WC2026' },
      update: {},
      create: {
        seasonCode: 'WC2026',
        totalBudget: totalSponsorNeeded,
        usedBudget: 0n,
        remainingBudget: totalSponsorNeeded,
        status: 'ACTIVE',
      },
    });

    const budgetShortfall = totalSponsorNeeded > budget.remainingBudget ? totalSponsorNeeded - budget.remainingBudget : 0n;
    if (budgetShortfall > 0n) {
      actions.push({ type: 'sponsor-budget-topup', delta: budgetShortfall });
      if (options.apply) {
        await tx.officialSponsorBudget.update({
          where: { seasonCode: 'WC2026' },
          data: {
            totalBudget: { increment: budgetShortfall },
            remainingBudget: { increment: budgetShortfall },
          },
        });
      }
    }

    for (const pool of pools) {
      const reference = `launch-sponsor-${pool.team.code}-TOP32`;
      const existing = await tx.sponsorLedger.findUnique({ where: { reference } });
      if (existing) {
        actions.push({ type: 'sponsor-skip-existing', team: pool.team.code, reference });
        continue;
      }

      actions.push({ type: 'sponsor-inject', team: pool.team.code, poolId: pool.id, amount: sponsorAmount, reference });
      if (!options.apply) continue;

      const sponsor = await tx.sponsorLedger.create({
        data: {
          poolId: pool.id,
          amount: sponsorAmount,
          source: 'OFFICIAL',
          reference,
          note: 'Launch bootstrap official sponsor',
        },
      });

      await tx.roadPool.update({
        where: { id: pool.id },
        data: {
          prizePool: { increment: sponsorAmount },
          sponsorAmount: { increment: sponsorAmount },
        },
      });

      await tx.officialSponsorBudget.update({
        where: { seasonCode: 'WC2026' },
        data: {
          usedBudget: { increment: sponsorAmount },
          remainingBudget: { decrement: sponsorAmount },
        },
      });

      await tx.roadTreasuryLedger.createMany({
        data: [
          {
            seasonCode: 'WC2026',
            eventType: RoadTreasuryEventType.SPONSOR_INJECT,
            eventId: sponsor.id,
            entryKey: `POOL_PRIZE|${pool.id}|${sponsor.id}`,
            bucket: RoadTreasuryBucket.POOL_PRIZE,
            amount: sponsorAmount,
            poolId: pool.id,
            sponsorLedgerId: sponsor.id,
            meta: { reason: 'launch_bootstrap', team: pool.team.code, reference },
          },
          {
            seasonCode: 'WC2026',
            eventType: RoadTreasuryEventType.SPONSOR_INJECT,
            eventId: sponsor.id,
            entryKey: `OFFICIAL_SPONSOR_COST|${pool.id}|${sponsor.id}`,
            bucket: RoadTreasuryBucket.OFFICIAL_SPONSOR_COST,
            amount: sponsorAmount,
            poolId: pool.id,
            sponsorLedgerId: sponsor.id,
            meta: { reason: 'launch_bootstrap', team: pool.team.code, reference },
          },
        ],
        skipDuplicates: true,
      });
    }

    return actions;
  });

  console.log(JSON.stringify(result, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
  if (!options.apply) console.log('DRY_RUN only. Re-run with --apply to write changes.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
