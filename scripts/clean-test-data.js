const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Cleaning up existing test data ===');
  
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
  
  console.log(`Found ${testTeams.length} test teams to delete:`);
  testTeams.forEach(t => console.log(`  ${t.code} - ${t.name}`));
  
  const teamIds = testTeams.map(t => t.id);
  
  if (teamIds.length > 0) {
    console.log('\nDeleting related records...');
    
    await prisma.roadTreasuryLedger.deleteMany({
      where: { purchase: { pool: { teamId: { in: teamIds } } } }
    });
    console.log('  - Deleted treasury ledgers');
    
    await prisma.roadPurchase.deleteMany({
      where: { pool: { teamId: { in: teamIds } } }
    });
    console.log('  - Deleted purchases');
    
    await prisma.roadKeyHolding.deleteMany({
      where: { pool: { teamId: { in: teamIds } } }
    });
    console.log('  - Deleted holdings');
    
    await prisma.roadDividend.deleteMany({
      where: { pool: { teamId: { in: teamIds } } }
    });
    console.log('  - Deleted dividends');
    
    await prisma.sponsorLedger.deleteMany({
      where: { pool: { teamId: { in: teamIds } } }
    });
    console.log('  - Deleted sponsor ledgers');
    
    await prisma.roadPool.deleteMany({
      where: { teamId: { in: teamIds } }
    });
    console.log('  - Deleted road pools');
    
    await prisma.team.deleteMany({
      where: { id: { in: teamIds } }
    });
    console.log('  - Deleted teams');
  }
  
  console.log('\n=== Cleanup completed ===');
  
  const finalPools = await prisma.roadPool.findMany({ where: { stage: 'TOP32' } });
  console.log(`Remaining TOP32 pools: ${finalPools.length}`);
  
  const remainingTestTeams = await prisma.team.findMany({
    where: {
      OR: [
        { code: { startsWith: 'TEST_' } },
        { code: { startsWith: 'TST_' } },
      ]
    }
  });
  if (remainingTestTeams.length > 0) {
    console.log(`Warning: ${remainingTestTeams.length} test teams still exist:`);
    remainingTestTeams.forEach(t => console.log(`  ${t.code}`));
  }
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});