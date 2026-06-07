const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const teams = await prisma.team.findMany();
  const testTeams = teams.filter(t => t.code.startsWith('TEST_') || t.code.startsWith('TST_'));
  const top32Pools = await prisma.roadPool.findMany({ where: { stage: 'TOP32' } });

  // 检查非TOP32的OPEN池
  const nonTop32Stages = ['TOP16', 'TOP8', 'TOP4', 'FINAL', 'CHAMPION'];
  const nonTop32OpenPools = await prisma.roadPool.findMany({
    where: {
      stage: { in: nonTop32Stages },
      status: 'OPEN'
    }
  });

  console.log('=== Database Status ===');
  console.log('Total teams:', teams.length);
  console.log('Test teams remaining:', testTeams.length);
  if (testTeams.length > 0) {
    console.log('  Test team codes:', testTeams.map(t => t.code).join(', '));
  }
  console.log('TOP32 pools:', top32Pools.length);
  console.log('Non-TOP32 OPEN pools:', nonTop32OpenPools.length);
  if (nonTop32OpenPools.length > 0) {
    console.log('  Non-TOP32 OPEN pool codes:', nonTop32OpenPools.map(p => p.teamId).join(', '));
  }

  if (testTeams.length === 0 && nonTop32OpenPools.length === 0) {
    console.log('\n✅ All test data and non-TOP32 OPEN pools have been cleaned up!');
  } else {
    console.log('\n❌ Issues found!');
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});