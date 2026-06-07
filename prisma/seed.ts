// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding...');

  await prisma.gameConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      initialPrizePool: 100000n,
      countdownSeconds: 60,
      minBuyAmount: 100n,
      winnerPercent: 70,
      platformPercent: 30,
      activePaymentGateway: process.env.ACTIVE_PAYMENT_GATEWAY || 'mock',
      botEnabled: true,
      botPurchaseIntervalMs: 8000,
      botMinAmount: 100n,
      botMaxAmount: 500n,
    },
  });
  console.log('✅ gameConfig');

  await prisma.riskConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      withdrawMinAmount: 100n,
      withdrawMaxAmountDaily: 1000000n,
      withdrawRequirePurchaseCount: 1,
      withdrawCooldownHours: 0,
      purchaseMaxAmountPerTx: 100000n,
      purchaseRateLimitPerMin: 10,
      largeAmountThreshold: 500000n,
    },
  });
  console.log('✅ riskConfig');

  const locales = [
    { lang: 'en', isDefault: true, content: { app_title: 'Blitz Finale', buy: 'Buy', withdraw: 'Withdraw' } },
    { lang: 'zh', isDefault: false, content: { app_title: '闪电终局', buy: '购买', withdraw: '提现' } },
  ];
  for (const loc of locales) {
    await prisma.locale.upsert({
      where: { lang: loc.lang },
      update: { content: loc.content, isDefault: loc.isDefault },
      create: { lang: loc.lang, content: loc.content, isDefault: loc.isDefault },
    });
  }
  console.log('✅ locales');

  const superUsername = process.env.ADMIN_USERNAME || 'super_admin';
  const superPassword = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'Admin@2026!');
  const operatorUsername = process.env.OPERATOR_USERNAME || 'operator';
  const operatorPassword = process.env.OPERATOR_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'operator123');

  if (!superPassword) {
    throw new Error('ADMIN_PASSWORD must be configured in production');
  }

  const superHash = await bcrypt.hash(superPassword, 10);
  await prisma.admin.upsert({
    where: { username: superUsername },
    update: {
      passwordHash: superHash,
      role: 'SUPER_ADMIN',
    },
    create: {
      username: superUsername,
      passwordHash: superHash,
      role: 'SUPER_ADMIN',
    },
  });
  console.log(`✅ ${superUsername} (SUPER_ADMIN)`);

  if (operatorPassword) {
    const opHash = await bcrypt.hash(operatorPassword, 10);
    await prisma.admin.upsert({
      where: { username: operatorUsername },
      update: {
        passwordHash: opHash,
        role: 'OPERATOR',
      },
      create: {
        username: operatorUsername,
        passwordHash: opHash,
        role: 'OPERATOR',
      },
    });
    console.log(`✅ ${operatorUsername} (OPERATOR)`);
  }

  const existingRound = await prisma.round.findFirst({ where: { status: 'OPEN' } });
  const roundDeadline = new Date(Date.now() + 60000);
  if (!existingRound) {
    const config = await prisma.gameConfig.findUnique({ where: { id: 1 } });
    await prisma.round.create({
      data: {
        roundNumber: 1,
        prizePool: config?.initialPrizePool ?? 100000n,
        initialPool: config?.initialPrizePool ?? 100000n,
        status: 'OPEN',
        startedAt: new Date(),
        deadlineAt: roundDeadline,
      },
    });
    console.log('✅ initial round');
  } else if (existingRound.deadlineAt.getTime() <= Date.now()) {
    await prisma.round.update({
      where: { id: existingRound.id },
      data: {
        startedAt: new Date(),
        deadlineAt: roundDeadline,
      },
    });
    console.log('✅ refreshed expired open round');
  }

  const botUsers = [
    { nickname: 'Bot_Alpha', wallet: '0xbot000000000000000000000000000000000001' },
    { nickname: 'Bot_Bravo', wallet: '0xbot000000000000000000000000000000000002' },
    { nickname: 'Bot_Charlie', wallet: '0xbot000000000000000000000000000000000003' },
  ];
  for (const bot of botUsers) {
    await prisma.user.upsert({
      where: { walletAddress: bot.wallet },
      update: {},
      create: {
        walletAddress: bot.wallet,
        nickname: bot.nickname,
        balance: process.env.NODE_ENV === 'production' ? 0n : 500000n,
      },
    });
  }
  console.log('✅ bot users');

  await prisma.superJackpot.upsert({
    where: { seasonCode: 'WC2026' },
    update: {},
    create: { seasonCode: 'WC2026', amount: 0n, status: 'ACTIVE' },
  });
  console.log('✅ super jackpot');

  const roadConfig = await prisma.roadConfig.upsert({
    where: { seasonCode: 'WC2026' },
    update: {},
    create: {
      seasonCode: 'WC2026',
      baseHouseFeeBps: 600,
      maxHouseFeeBps: 2000,
      baseDividendBps: 2800,
      prizeBps: 3200,
      superBps: 1500,
      reinvestBps: 1000,
      agentBps: 1000,
      reserveBps: 500,
      releaseDelayHours: 24,
      lowCoverageThresholdBps: 10000,
      sponsorGlobalBudget: 500000n,
    },
  });
  console.log('✅ road config');

  await prisma.officialSponsorBudget.upsert({
    where: { seasonCode: 'WC2026' },
    update: {},
    create: {
      seasonCode: 'WC2026',
      totalBudget: roadConfig.sponsorGlobalBudget,
      usedBudget: 0n,
      remainingBudget: roadConfig.sponsorGlobalBudget,
      status: 'ACTIVE',
    },
  });
  console.log('✅ official sponsor budget');

  // Road teams and pools are now managed by scripts/seed-road-production.js
  // DO NOT create RoadPool here - use scripts/seed-road-production.js instead
  console.log('✅ road teams & pools (handled by seed-road-production.js)');

  console.log('\n🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
