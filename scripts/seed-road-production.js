const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// WC2026 32支球队数据（占位数据，实际名单需替换）
const WORLD_CUP_2026_TEAMS = [
  // Group A
  { code: 'ARG', name: 'Argentina', flagUrl: 'https://flagcdn.com/w2560/ar.png', groupCode: 'A', displayOrder: 1 },
  { code: 'USA', name: 'United States', flagUrl: 'https://flagcdn.com/w2560/us.png', groupCode: 'A', displayOrder: 2 },
  { code: 'SAU', name: 'Saudi Arabia', flagUrl: 'https://flagcdn.com/w2560/sa.png', groupCode: 'A', displayOrder: 3 },
  { code: 'JPN', name: 'Japan', flagUrl: 'https://flagcdn.com/w2560/jp.png', groupCode: 'A', displayOrder: 4 },
  
  // Group B
  { code: 'GER', name: 'Germany', flagUrl: 'https://flagcdn.com/w2560/de.png', groupCode: 'B', displayOrder: 5 },
  { code: 'FRA', name: 'France', flagUrl: 'https://flagcdn.com/w2560/fr.png', groupCode: 'B', displayOrder: 6 },
  { code: 'MEX', name: 'Mexico', flagUrl: 'https://flagcdn.com/w2560/mx.png', groupCode: 'B', displayOrder: 7 },
  { code: 'MAR', name: 'Morocco', flagUrl: 'https://flagcdn.com/w2560/ma.png', groupCode: 'B', displayOrder: 8 },
  
  // Group C
  { code: 'BRA', name: 'Brazil', flagUrl: 'https://flagcdn.com/w2560/br.png', groupCode: 'C', displayOrder: 9 },
  { code: 'ESP', name: 'Spain', flagUrl: 'https://flagcdn.com/w2560/es.png', groupCode: 'C', displayOrder: 10 },
  { code: 'POR', name: 'Portugal', flagUrl: 'https://flagcdn.com/w2560/pt.png', groupCode: 'C', displayOrder: 11 },
  { code: 'SUI', name: 'Switzerland', flagUrl: 'https://flagcdn.com/w2560/ch.png', groupCode: 'C', displayOrder: 12 },
  
  // Group D
  { code: 'BEL', name: 'Belgium', flagUrl: 'https://flagcdn.com/w2560/be.png', groupCode: 'D', displayOrder: 13 },
  { code: 'NED', name: 'Netherlands', flagUrl: 'https://flagcdn.com/w2560/nl.png', groupCode: 'D', displayOrder: 14 },
  { code: 'URU', name: 'Uruguay', flagUrl: 'https://flagcdn.com/w2560/uy.png', groupCode: 'D', displayOrder: 15 },
  { code: 'KOR', name: 'South Korea', flagUrl: 'https://flagcdn.com/w2560/kr.png', groupCode: 'D', displayOrder: 16 },
  
  // Group E
  { code: 'ENG', name: 'England', flagUrl: 'https://flagcdn.com/w2560/gb-eng.png', groupCode: 'E', displayOrder: 17 },
  { code: 'CRO', name: 'Croatia', flagUrl: 'https://flagcdn.com/w2560/hr.png', groupCode: 'E', displayOrder: 18 },
  { code: 'CAN', name: 'Canada', flagUrl: 'https://flagcdn.com/w2560/ca.png', groupCode: 'E', displayOrder: 19 },
  { code: 'NGA', name: 'Nigeria', flagUrl: 'https://flagcdn.com/w2560/ng.png', groupCode: 'E', displayOrder: 20 },
  
  // Group F
  { code: 'ITA', name: 'Italy', flagUrl: 'https://flagcdn.com/w2560/it.png', groupCode: 'F', displayOrder: 21 },
  { code: 'AUS', name: 'Australia', flagUrl: 'https://flagcdn.com/w2560/au.png', groupCode: 'F', displayOrder: 22 },
  { code: 'DEN', name: 'Denmark', flagUrl: 'https://flagcdn.com/w2560/dk.png', groupCode: 'F', displayOrder: 23 },
  { code: 'ALG', name: 'Algeria', flagUrl: 'https://flagcdn.com/w2560/dz.png', groupCode: 'F', displayOrder: 24 },
  
  // Group G
  { code: 'POL', name: 'Poland', flagUrl: 'https://flagcdn.com/w2560/pl.png', groupCode: 'G', displayOrder: 25 },
  { code: 'SWE', name: 'Sweden', flagUrl: 'https://flagcdn.com/w2560/se.png', groupCode: 'G', displayOrder: 26 },
  { code: 'COL', name: 'Colombia', flagUrl: 'https://flagcdn.com/w2560/co.png', groupCode: 'G', displayOrder: 27 },
  { code: 'IRN', name: 'Iran', flagUrl: 'https://flagcdn.com/w2560/ir.png', groupCode: 'G', displayOrder: 28 },
  
  // Group H
  { code: 'SEN', name: 'Senegal', flagUrl: 'https://flagcdn.com/w2560/sn.png', groupCode: 'H', displayOrder: 29 },
  { code: 'NOR', name: 'Norway', flagUrl: 'https://flagcdn.com/w2560/no.png', groupCode: 'H', displayOrder: 30 },
  { code: 'ECU', name: 'Ecuador', flagUrl: 'https://flagcdn.com/w2560/ec.png', groupCode: 'H', displayOrder: 31 },
  { code: 'QAT', name: 'Qatar', flagUrl: 'https://flagcdn.com/w2560/qa.png', groupCode: 'H', displayOrder: 32 },
];

// 根据球队实力设置基础价格（单位：USDT分）
// 定价策略：基于FIFA排名和世界杯历史战绩分层
// Tier 1 (热门冠军): 450-500 | Tier 2 (争冠热门): 380-440 | Tier 3 (淘汰赛常客): 300-370 | Tier 4 (中游球队): 220-290 | Tier 5 (弱队): 120-210
const TEAM_PRICES = {
  // Tier 1 - 热门冠军 (500 USDT)
  'ARG': 500, 'BRA': 500,
  // Tier 2 - 争冠热门 (400-450 USDT)
  'FRA': 450, 'GER': 440, 'ENG': 430, 'ESP': 420, 'POR': 410, 'BEL': 400,
  // Tier 3 - 淘汰赛常客 (320-380 USDT)
  'ITA': 380, 'NED': 360, 'CRO': 350, 'URU': 340, 'SUI': 330, 'DEN': 320,
  // Tier 4 - 中游球队 (220-300 USDT)
  'POL': 300, 'SWE': 290, 'NOR': 280, 'COL': 270, 'MEX': 260, 'USA': 250, 'CAN': 240, 'JPN': 230, 'KOR': 220,
  // Tier 5 - 弱队/新军 (120-200 USDT)
  'AUS': 200, 'ECU': 190, 'SAU': 180, 'MAR': 170, 'NGA': 160, 'ALG': 150, 'IRN': 140, 'SEN': 130, 'QAT': 120,
};

function getBasePrice(code) {
  return TEAM_PRICES[code] || 200;
}

async function main() {
  console.log('=== WC2026 Road to Champion Production Seeding ===\n');
  
  // 1. 创建/更新32支球队
  console.log('1. Creating/Updating 32 teams...');
  let createdTeams = 0;
  let updatedTeams = 0;
  
  for (const teamData of WORLD_CUP_2026_TEAMS) {
    const existingTeam = await prisma.team.findUnique({ where: { code: teamData.code } });
    
    if (existingTeam) {
      await prisma.team.update({
        where: { code: teamData.code },
        data: {
          name: teamData.name,
          flagUrl: teamData.flagUrl,
          groupCode: teamData.groupCode,
          status: 'ACTIVE',
          currentStage: 'GROUP',
          strengthFactor: '1.0',
        }
      });
      updatedTeams++;
    } else {
      await prisma.team.create({
        data: {
          code: teamData.code,
          name: teamData.name,
          flagUrl: teamData.flagUrl,
          groupCode: teamData.groupCode,
          status: 'ACTIVE',
          currentStage: 'GROUP',
          strengthFactor: '1.0',
        }
      });
      createdTeams++;
    }
  }
  console.log(`   Created: ${createdTeams}, Updated: ${updatedTeams}`);
  
  // 2. 创建TOP32初始池（仅当不存在时）
  console.log('\n2. Creating TOP32 pools (if not exists)...');
  let createdPools = 0;
  let skippedPools = 0;
  let updatedCloseAt = 0;
  let skippedCloseAt = 0;

  // 默认不重置已有池的封盘时间，避免每次部署把 TOP32 closeAt 顺延，
  // 仅当显式设置 SEED_RESET_CLOSE_AT=true 时才覆盖已有 closeAt。
  const resetCloseAt = process.env.SEED_RESET_CLOSE_AT === 'true';

  const now = new Date();
  const openAt = new Date(now.getTime() - 3600000).toISOString(); // 1小时前开放
  const closeAt = new Date(now.getTime() + 14 * 24 * 3600000).toISOString(); // 14天后关闭（统一TOP32封盘时间）
  
  // 统一赞助预算策略：所有球队一致为 5,000 USDT
  const unifiedSponsorBudgetLimit = 500000; // 5,000 USDT
  
  for (const teamData of WORLD_CUP_2026_TEAMS) {
    const team = await prisma.team.findUnique({ where: { code: teamData.code } });
    if (!team) continue;
    
    const existingPool = await prisma.roadPool.findFirst({
      where: { teamId: team.id, stage: 'TOP32' }
    });
    
    if (existingPool) {
      // 已存在的池只更新统一预算；closeAt 默认保留，避免每次部署顺延封盘
      const updateData = { sponsorBudgetLimit: unifiedSponsorBudgetLimit };
      if (resetCloseAt) {
        updateData.closeAt = closeAt;
        updatedCloseAt++;
      } else {
        skippedCloseAt++;
      }
      await prisma.roadPool.update({
        where: { id: existingPool.id },
        data: updateData,
      });
      skippedPools++;
      continue;
    }
    
    const basePrice = getBasePrice(teamData.code);
    
    await prisma.roadPool.create({
      data: {
        teamId: team.id,
        stage: 'TOP32',
        status: 'OPEN',
        basePrice,
        currentPrice: basePrice,
        openAt,
        closeAt,
        sponsorBudgetLimit: unifiedSponsorBudgetLimit, // 统一 5,000 USDT
        prizePool: 0,
        soldKeys: 0,
        totalPurchases: 0,
        dividendPaid: 0,
        superPoolContrib: 0,
        reserveContrib: 0,
        sponsorAmount: 0,
      }
    });
    createdPools++;
  }
  console.log(`   Created: ${createdPools}, Updated/Skipped: ${skippedPools}`);
  console.log(`   closeAt: reset=${resetCloseAt} updated=${updatedCloseAt} skipped(preserved)=${skippedCloseAt}`);
  
  // 3. 清理测试数据
  console.log('\n3. Cleaning up test data...');
  const testTeams = await prisma.team.findMany({
    where: {
      OR: [
        { code: { startsWith: 'TEST_' } },
        { code: { startsWith: 'TST_' } },
        { code: { startsWith: 'test_' } },
        { code: { startsWith: 'tst_' } },
      ]
    }
  });

  if (testTeams.length > 0) {
    const teamIds = testTeams.map(t => t.id);
    await prisma.roadTreasuryLedger.deleteMany({ where: { purchase: { pool: { teamId: { in: teamIds } } } } });
    await prisma.roadPurchase.deleteMany({ where: { pool: { teamId: { in: teamIds } } } });
    await prisma.roadKeyHolding.deleteMany({ where: { pool: { teamId: { in: teamIds } } } });
    await prisma.roadDividend.deleteMany({ where: { pool: { teamId: { in: teamIds } } } });
    await prisma.sponsorLedger.deleteMany({ where: { pool: { teamId: { in: teamIds } } } });
    await prisma.roadPool.deleteMany({ where: { teamId: { in: teamIds } } });
    await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
    console.log(`   Cleaned ${testTeams.length} test teams`);
  } else {
    console.log('   No test data found');
  }

  // 3.1 清理非TOP32的OPEN池（策略A：上线初期只开放TOP32）
  console.log('\n3.1 Cleaning up non-TOP32 OPEN pools (Strategy A: only TOP32 open at launch)...');
  const nonTop32Stages = ['TOP16', 'TOP8', 'TOP4', 'FINAL', 'CHAMPION'];
  const nonTop32OpenPools = await prisma.roadPool.findMany({
    where: {
      stage: { in: nonTop32Stages },
      status: 'OPEN'
    },
    include: { team: true }
  });

  if (nonTop32OpenPools.length > 0) {
    console.log(`   Found ${nonTop32OpenPools.length} non-TOP32 OPEN pools:`);
    for (const pool of nonTop32OpenPools) {
      console.log(`     - ${pool.team?.code || 'unknown'}/${pool.stage}`);
    }

    // 检查是否有实际购买/资金记录
    for (const pool of nonTop32OpenPools) {
      const hasPurchases = await prisma.roadPurchase.count({ where: { poolId: pool.id } }) > 0;
      const hasHoldings = await prisma.roadKeyHolding.count({ where: { poolId: pool.id } }) > 0;
      const hasDividends = await prisma.roadDividend.count({ where: { poolId: pool.id } }) > 0;
      const hasTreasury = await prisma.roadTreasuryLedger.count({ where: { purchase: { poolId: pool.id } } }) > 0;
      const hasSponsors = await prisma.sponsorLedger.count({ where: { poolId: pool.id } }) > 0;

      if (hasPurchases || hasHoldings || hasDividends || hasTreasury || hasSponsors) {
        // 有资金关联，改为CANCELLED状态
        await prisma.roadPool.update({
          where: { id: pool.id },
          data: { status: 'CANCELLED' }
        });
        console.log(`   Cancelled pool ${pool.team?.code}/${pool.stage} (has financial records)`);
      } else {
        // 无资金记录，直接删除
        await prisma.roadPool.delete({ where: { id: pool.id } });
        console.log(`   Deleted pool ${pool.team?.code}/${pool.stage} (no financial records)`);
      }
    }
  } else {
    console.log('   No non-TOP32 OPEN pools found');
  }
  
  // 4. 验证结果
  console.log('\n4. Verification:');
  const totalTeams = await prisma.team.count();
  const totalTop32Pools = await prisma.roadPool.count({ where: { stage: 'TOP32' } });
  const openTop32Pools = await prisma.roadPool.count({ where: { stage: 'TOP32', status: 'OPEN' } });

  // 检查非TOP32的OPEN池（已在3.1中清理）
  const nonTop32OpenPoolsCount = await prisma.roadPool.count({
    where: {
      stage: { in: nonTop32Stages },
      status: 'OPEN'
    }
  });

  console.log(`   Total Teams: ${totalTeams}`);
  console.log(`   TOP32 Pools: ${totalTop32Pools}`);
  console.log(`   OPEN TOP32 Pools: ${openTop32Pools}`);
  console.log(`   Non-TOP32 OPEN Pools: ${nonTop32OpenPoolsCount}`);

  if (totalTeams === 32 && totalTop32Pools === 32 && openTop32Pools === 32 && nonTop32OpenPoolsCount === 0) {
    console.log('\n✅ Production seeding completed successfully!');
  } else {
    console.log('\n❌ Seeding incomplete!');
    if (nonTop32OpenPoolsCount > 0) {
      console.log(`   ERROR: ${nonTop32OpenPoolsCount} non-TOP32 OPEN pools remain (Strategy A requires 0)`);
    }
    process.exit(1);
  }
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Seeding failed:', e);
  process.exit(1);
});