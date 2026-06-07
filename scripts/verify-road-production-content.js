const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const REPO_ROOT = path.join(__dirname, '..');
const EXPECTED_PSYS_CIDS = 'USDT_TRX,USDT_TON,TON,TRX';

const COLORS = {
  pass: '\x1b[32m',
  fail: '\x1b[31m',
  info: '\x1b[36m',
  reset: '\x1b[0m',
};

function ok(msg) {
  console.log(`${COLORS.pass}✓ PASS${COLORS.reset}: ${msg}`);
}

function fail(msg) {
  console.log(`${COLORS.fail}✗ FAIL${COLORS.reset}: ${msg}`);
  process.exitCode = 1;
}

async function main() {
  console.log(`${COLORS.info}==== Road to Champion Production Content Verification ====${COLORS.reset}\n`);
  
  let allPassed = true;
  
  // 1. 检查球队数量
  console.log('=== Team Verification ===');
  const teams = await prisma.team.findMany();
  const testTeams = teams.filter(t => 
    t.code.startsWith('TEST_') || t.code.startsWith('TST_') || 
    t.code.startsWith('test_') || t.code.startsWith('tst_')
  );
  
  if (teams.length === 32) {
    ok(`Total teams = 32`);
  } else {
    fail(`Total teams = ${teams.length}, expected 32`);
    allPassed = false;
  }
  
  if (testTeams.length === 0) {
    ok('No test teams found');
  } else {
    fail(`Found ${testTeams.length} test teams: ${testTeams.map(t => t.code).join(', ')}`);
    allPassed = false;
  }
  
  // 2. 检查TOP32池
  console.log('\n=== TOP32 Pool Verification ===');
  const top32Pools = await prisma.roadPool.findMany({ where: { stage: 'TOP32' }, include: { team: true } });
  
  if (top32Pools.length === 32) {
    ok(`TOP32 pools = 32`);
  } else {
    fail(`TOP32 pools = ${top32Pools.length}, expected 32`);
    allPassed = false;
  }
  
  // 检查所有TOP32池状态
  const openPools = top32Pools.filter(p => p.status === 'OPEN');
  if (openPools.length === 32) {
    ok(`All TOP32 pools are OPEN`);
  } else {
    fail(`Only ${openPools.length}/32 TOP32 pools are OPEN`);
    allPassed = false;
  }
  
  // 检查closeAt
  const poolsWithoutCloseAt = top32Pools.filter(p => !p.closeAt);
  if (poolsWithoutCloseAt.length === 0) {
    ok('All TOP32 pools have closeAt set');
  } else {
    fail(`${poolsWithoutCloseAt.length} TOP32 pools missing closeAt`);
    allPassed = false;
  }
  
  // 检查basePrice
  const poolsWithoutBasePrice = top32Pools.filter(p => !p.basePrice || p.basePrice <= 0);
  if (poolsWithoutBasePrice.length === 0) {
    ok('All TOP32 pools have valid basePrice');
  } else {
    fail(`${poolsWithoutBasePrice.length} TOP32 pools missing or invalid basePrice`);
    allPassed = false;
  }
  
  // 检查sponsorBudgetLimit
  const poolsWithoutBudget = top32Pools.filter(p => !p.sponsorBudgetLimit || p.sponsorBudgetLimit <= 0);
  if (poolsWithoutBudget.length === 0) {
    ok('All TOP32 pools have valid sponsorBudgetLimit');
  } else {
    fail(`${poolsWithoutBudget.length} TOP32 pools missing or invalid sponsorBudgetLimit`);
    allPassed = false;
  }
  
  // 检查是否有测试池
  const testPools = top32Pools.filter(p => {
    const teamCode = p.team?.code;
    return teamCode && (teamCode.startsWith('TEST_') || teamCode.startsWith('TST_'));
  });
  if (testPools.length === 0) {
    ok('No test pools in TOP32');
  } else {
    fail(`Found ${testPools.length} test pools in TOP32`);
    allPassed = false;
  }

  // 3. 检查非TOP32的OPEN池（策略A：上线初期只开放TOP32）
  console.log('\n=== Non-TOP32 Pool Verification (Strategy A) ===');
  const nonTop32Stages = ['TOP16', 'TOP8', 'TOP4', 'FINAL', 'CHAMPION'];
  const nonTop32OpenPools = await prisma.roadPool.findMany({
    where: {
      stage: { in: nonTop32Stages },
      status: 'OPEN'
    },
    include: { team: true }
  });

  if (nonTop32OpenPools.length === 0) {
    ok(`Non-TOP32 OPEN pools = 0 (Strategy A: only TOP32 open at launch)`);
  } else {
    fail(`Non-TOP32 OPEN pools = ${nonTop32OpenPools.length}, expected 0`);
    console.log(`   Remaining non-TOP32 OPEN pools:`);
    for (const pool of nonTop32OpenPools.slice(0, 10)) {
      console.log(`     - ${pool.team?.code || 'unknown'}/${pool.stage}`);
    }
    if (nonTop32OpenPools.length > 10) {
      console.log(`     ... and ${nonTop32OpenPools.length - 10} more`);
    }
    allPassed = false;
  }
  
  // 3. 检查球队数据完整性
  console.log('\n=== Team Data Completeness ===');
  const teamsWithMissingData = teams.filter(t => !t.flagUrl || !t.name || !t.groupCode);
  if (teamsWithMissingData.length === 0) {
    ok('All teams have complete data (flagUrl, name, groupCode)');
  } else {
    fail(`${teamsWithMissingData.length} teams have missing data`);
    allPassed = false;
  }
  
  // 4. 分组分布检查
  console.log('\n=== Group Distribution ===');
  const groupCounts = {};
  teams.forEach(t => {
    groupCounts[t.groupCode] = (groupCounts[t.groupCode] || 0) + 1;
  });
  
  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  let allGroupsValid = true;
  for (const group of groups) {
    if (groupCounts[group] === 4) {
      ok(`Group ${group}: 4 teams`);
    } else {
      fail(`Group ${group}: ${groupCounts[group] || 0} teams (expected 4)`);
      allGroupsValid = false;
    }
  }
  
  // 6. Plisio 币种默认值与前端展示一致
  console.log('\n=== Plisio Currency Consistency ===');
  const expectedSet = new Set(EXPECTED_PSYS_CIDS.split(',').map((s) => s.trim()));
  function normalizeCids(value) {
    return new Set(String(value || '').split(',').map((s) => s.trim()).filter(Boolean));
  }
  function setsEqual(a, b) {
    return a.size === b.size && [...a].every((v) => b.has(v));
  }

  // .env.production.example 默认值
  const envExamplePath = path.join(REPO_ROOT, '.env.production.example');
  const envContent = fs.existsSync(envExamplePath) ? fs.readFileSync(envExamplePath, 'utf8') : '';
  const envMatch = envContent.match(/^PLISIO_ALLOWED_PSYS_CIDS=(.*)$/m);
  if (envMatch && setsEqual(normalizeCids(envMatch[1]), expectedSet)) {
    ok(`.env.production.example PLISIO_ALLOWED_PSYS_CIDS = ${EXPECTED_PSYS_CIDS}`);
  } else {
    fail(`.env.production.example PLISIO_ALLOWED_PSYS_CIDS mismatch (got: ${envMatch ? envMatch[1] : 'missing'}, expected ${EXPECTED_PSYS_CIDS})`);
    allPassed = false;
  }

  // docker-compose.prod.yml 默认值
  const composePath = path.join(REPO_ROOT, 'docker-compose.prod.yml');
  const composeContent = fs.existsSync(composePath) ? fs.readFileSync(composePath, 'utf8') : '';
  const composeMatch = composeContent.match(/PLISIO_ALLOWED_PSYS_CIDS:\s*\$\{PLISIO_ALLOWED_PSYS_CIDS:-([^}]*)\}/);
  if (composeMatch && setsEqual(normalizeCids(composeMatch[1]), expectedSet)) {
    ok(`docker-compose.prod.yml PLISIO_ALLOWED_PSYS_CIDS default = ${EXPECTED_PSYS_CIDS}`);
  } else {
    fail(`docker-compose.prod.yml PLISIO_ALLOWED_PSYS_CIDS default mismatch (got: ${composeMatch ? composeMatch[1] : 'missing'}, expected ${EXPECTED_PSYS_CIDS})`);
    allPassed = false;
  }

  // 前端展示币种映射应与白名单一致
  const webIndexPath = path.join(REPO_ROOT, 'web', 'index.html');
  const webContent = fs.existsSync(webIndexPath) ? fs.readFileSync(webIndexPath, 'utf8') : '';
  const frontendCids = new Set();
  const coinMapMatch = webContent.match(/COIN_TO_PSYS\s*=\s*\{([^}]*)\}/);
  if (coinMapMatch) {
    const re = /'([A-Z_]+)'/g;
    let m;
    while ((m = re.exec(coinMapMatch[1])) !== null) frontendCids.add(m[1]);
  }
  if (setsEqual(frontendCids, expectedSet)) {
    ok('web/index.html coin selector maps exactly to the allowed psys_cids');
  } else {
    fail(`web/index.html coin mapping mismatch (got: ${[...frontendCids].join(',') || 'missing'}, expected ${EXPECTED_PSYS_CIDS})`);
    allPassed = false;
  }

  // 7. seed 默认不重置已有池 closeAt
  console.log('\n=== Seed closeAt Safety ===');
  const seedPath = path.join(REPO_ROOT, 'scripts', 'seed-road-production.js');
  const seedContent = fs.existsSync(seedPath) ? fs.readFileSync(seedPath, 'utf8') : '';
  const seedGuardsCloseAt =
    seedContent.includes("SEED_RESET_CLOSE_AT") &&
    /if\s*\(\s*resetCloseAt\s*\)/.test(seedContent);
  if (seedGuardsCloseAt) {
    ok('seed-road-production.js only resets existing closeAt when SEED_RESET_CLOSE_AT=true');
  } else {
    fail('seed-road-production.js may reset existing pool closeAt unconditionally');
    allPassed = false;
  }

  // 8. prisma/migrations 存在 initial migration
  console.log('\n=== Prisma Migrations ===');
  const migrationsDir = path.join(REPO_ROOT, 'prisma', 'migrations');
  let hasInitialMigration = false;
  if (fs.existsSync(migrationsDir)) {
    const dirs = fs.readdirSync(migrationsDir).filter((name) =>
      fs.statSync(path.join(migrationsDir, name)).isDirectory()
    );
    hasInitialMigration = dirs.some((d) =>
      fs.existsSync(path.join(migrationsDir, d, 'migration.sql'))
    );
  }
  if (hasInitialMigration) {
    ok('prisma/migrations contains an initial migration (migration.sql)');
  } else {
    fail('prisma/migrations has no migration.sql — prisma migrate deploy will fail');
    allPassed = false;
  }

  // 5. 输出统计信息
  console.log('\n=== Statistics ===');
  console.log(`Total Teams: ${teams.length}`);
  console.log(`Total TOP32 Pools: ${top32Pools.length}`);
  console.log(`Open Pools: ${openPools.length}`);
  console.log(`Groups: ${Object.keys(groupCounts).length}`);
  
  console.log('\n=== Summary ===');
  if (allPassed) {
    console.log(`${COLORS.pass}✅ All production content verification passed!${COLORS.reset}`);
  } else {
    console.log(`${COLORS.fail}❌ Some verifications failed!${COLORS.reset}`);
    process.exit(1);
  }
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Verification failed:', e);
  process.exit(1);
});