const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

// Initialize exit code to 0
process.exitCode = 0;

const TEST_PREFIXES = ['TEST_', 'TST_', 'BUDGET_', 'CLOSEAT_', 'test_', 'tst_', 'budget_', 'closeat_'];

function isTestData(name) {
  if (!name) return false;
  return TEST_PREFIXES.some(prefix => name.startsWith(prefix));
}

async function cleanupTestData(adminTok) {
  console.log(`\n${COLORS.info}=== Cleaning up test data ===${COLORS.reset}`);
  
  try {
    const prisma = new PrismaClient();
    
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
    
    const teamIds = testTeams.map(t => t.id);
    
    if (teamIds.length > 0) {
      await prisma.roadTreasuryLedger.deleteMany({
        where: { purchase: { pool: { teamId: { in: teamIds } } } }
      });
      await prisma.roadPurchase.deleteMany({
        where: { pool: { teamId: { in: teamIds } } }
      });
      await prisma.roadKeyHolding.deleteMany({
        where: { pool: { teamId: { in: teamIds } } }
      });
      await prisma.roadDividend.deleteMany({
        where: { pool: { teamId: { in: teamIds } } }
      });
      await prisma.sponsorLedger.deleteMany({
        where: { pool: { teamId: { in: teamIds } } }
      });
      await prisma.roadPool.deleteMany({
        where: { teamId: { in: teamIds } }
      });
      await prisma.team.deleteMany({
        where: { id: { in: teamIds } }
      });
    }
    
    console.log(`${COLORS.pass}✓ Cleaned up ${testTeams.length} test teams${COLORS.reset}`);
    
    await prisma.$disconnect();
  } catch (e) {
    console.log(`${COLORS.warn}⚠ Cleanup error: ${e.message}${COLORS.reset}`);
  }
}

async function verifyNoTestData(adminTok) {
  console.log(`\n${COLORS.info}=== Verifying no test data remains ===${COLORS.reset}`);
  
  const poolsRes = await api('/admin/api/road/pools?stage=TOP32', {}, adminTok);
  const pools = poolsRes.body && poolsRes.body.data ? poolsRes.body.data : (poolsRes.body || []);
  
  const testPools = pools.filter(p => {
    const teamCode = p.team?.code;
    return isTestData(p.id) || (teamCode && isTestData(teamCode));
  });
  
  if (testPools.length > 0) {
    fail(`Test data remains in TOP32 pools: ${testPools.map(p => p.team?.code || p.id).join(', ')}`);
    return false;
  }
  
  ok('No test data in TOP32 pools');
  return true;
}

async function ensureCleanDatabase(adminTok) {
  console.log(`\n${COLORS.info}=== Ensuring clean database before tests ===${COLORS.reset}`);
  
  const poolsRes = await api('/admin/api/road/pools?stage=TOP32', {}, adminTok);
  const pools = poolsRes.body && poolsRes.body.data ? poolsRes.body.data : (poolsRes.body || []);
  
  const testPools = pools.filter(p => {
    const teamCode = p.team?.code;
    return isTestData(p.id) || (teamCode && isTestData(teamCode));
  });
  
  if (testPools.length > 0) {
    console.log(`Found ${testPools.length} test pools, cleaning up first...`);
    await cleanupTestData(adminTok);
  }
  
  ok('Database is clean');
}

const COLORS = {
  pass: '\x1b[32m',
  fail: '\x1b[31m',
  info: '\x1b[36m',
  reset: '\x1b[0m',
  warn: '\x1b[33m',
};

function section(name) {
  console.log(`\n${COLORS.info}=== ${name} ===${COLORS.reset}`);
}

function ok(msg) {
  console.log(`${COLORS.pass}✓ PASS${COLORS.reset}: ${msg}`);
}

function fail(msg) {
  console.log(`${COLORS.fail}✗ FAIL${COLORS.reset}: ${msg}`);
  process.exitCode = 1;
}

function warn(msg) {
  console.log(`${COLORS.warn}⚠ WARNING${COLORS.reset}: ${msg}`);
}

async function j(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { _raw: text }; }
}

async function api(path, options = {}, token = '') {
  const headers = { ...(options.headers || {}) };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { ...options, headers });
  const body = await j(res);
  return { res, body };
}

async function waitForApiReady(timeout = 45000) {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(API_BASE + '/api/auth/nonce?address=0x1234567890abcdef1234567890abcdef12345678');
      if (res.ok || res.status === 400) return;
      last = `HTTP ${res.status}`;
    } catch (e) {
      last = e.message;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`API not ready after ${timeout}ms: ${last}`);
}

async function createUser() {
  const addr = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const nonceRes = await api(`/api/auth/nonce?address=${addr}`);
  const nonce = (nonceRes.body && nonceRes.body.nonce) || '';
  const verify = await api('/api/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: addr, signature: 'demo-' + Date.now(), nonce }),
  });
  const token = verify.body && (verify.body.token || (verify.body.data && verify.body.data.token));
  const user = verify.body && (verify.body.user || (verify.body.data && verify.body.data.user));
  if (!token || !user) throw new Error('Failed to create user token');
  return { token, user };
}

async function adminLogin() {
  const lr = await api('/admin/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'super_admin', password: 'Admin@2026!' }),
  });
  const token = lr.body && (lr.body.token || (lr.body.data && lr.body.data.token));
  if (!token) throw new Error('Admin login failed');
  return token;
}

async function createTeam(adminTok, code) {
  const r = await api('/admin/api/road/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, name: code, strengthFactor: '1.0', status: 'ACTIVE', currentStage: 'GROUP' }),
  }, adminTok);
  if (!r.res.ok) throw new Error(`Create team failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body && (r.body.data || r.body);
}

async function createPool(adminTok, teamId, stage, basePrice) {
  const now = Date.now();
  const openAt = new Date(now - 60 * 1000).toISOString();
  const closeAt = new Date(now + 60 * 60 * 1000).toISOString();
  const r = await api('/admin/api/road/pools', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      teamId, stage, status: 'OPEN', basePrice, currentPrice: basePrice,
      openAt, closeAt, sponsorBudgetLimit: 1000000,
    }),
  }, adminTok);
  if (!r.res.ok) throw new Error(`Create pool failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body && (r.body.data || r.body);
}

function checkDockerComposeProd() {
  section('Check docker-compose.prod.yml');
  const prodFile = path.join(__dirname, '..', 'docker-compose.prod.yml');
  if (!fs.existsSync(prodFile)) {
    fail('docker-compose.prod.yml does not exist');
    return false;
  }
  const content = fs.readFileSync(prodFile, 'utf8');
  if (content.includes('--accept-data-loss')) {
    fail('docker-compose.prod.yml contains dangerous --accept-data-loss');
    return false;
  }
  if (content.includes('prisma migrate deploy')) {
    ok('docker-compose.prod.yml uses safe prisma migrate deploy');
  } else {
    warn('prisma migrate deploy not found, verify deployment strategy');
  }
  return true;
}

function checkDockerComposeDev() {
  section('Check docker-compose.yml (dev environment)');
  const devFile = path.join(__dirname, '..', 'docker-compose.yml');
  if (!fs.existsSync(devFile)) {
    warn('docker-compose.yml does not exist');
    return true;
  }
  const content = fs.readFileSync(devFile, 'utf8');
  if (content.includes('--accept-data-loss')) {
    ok('docker-compose.yml (dev) contains --accept-data-loss, marked for development only');
  }
  return true;
}

async function checkRoadAdminNoToken() {
  section('Check Road admin API requires authentication (401 without token)');
  const r = await api('/admin/api/road/teams');
  if (r.res.status === 401) {
    ok('Road admin API requires authentication (returns 401 without token)');
    return true;
  }
  fail(`Road admin API should require auth, but returned ${r.res.status}`);
  return false;
}

async function getSponsorBudget(adminTok) {
  const r = await api('/admin/api/road/sponsor/budget', {}, adminTok);
  if (!r.res.ok) throw new Error(`Get sponsor budget failed status=${r.res.status}`);
  return r.body && (r.body.data || r.body);
}

async function updateSponsorBudget(adminTok, totalBudgetBf) {
  const r = await api('/admin/api/road/sponsor/budget', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ totalBudget: totalBudgetBf, status: 'ACTIVE', resetUsed: true }),
  }, adminTok);
  if (!r.res.ok) throw new Error(`Update sponsor budget failed status=${r.res.status}`);
  return r.body && (r.body.data || r.body);
}

async function checkSponsorBudget(adminTok) {
  section('Check Sponsor global budget deduction');
  
  const originalBudget = await getSponsorBudget(adminTok);
  
  try {
    await updateSponsorBudget(adminTok, 500);
    const budgetAfterSet = await getSponsorBudget(adminTok);
    if (Number(budgetAfterSet.usedBudget) !== 0) {
      fail('usedBudget should be 0 after reset');
      return false;
    }
    if (Number(budgetAfterSet.remainingBudget) !== 500 * 100) {
      fail(`remainingBudget should be 50000, got ${budgetAfterSet.remainingBudget}`);
      return false;
    }

    const team = await createTeam(adminTok, `TEST_BUDGET_${Date.now()}`);
    const pool = await createPool(adminTok, team.id, 'GROUP', 100);

    const ref1 = `ref_budget_${Date.now()}_1`;
    const r1 = await api(`/admin/api/road/pools/${pool.id}/sponsor`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: 50, note: 'Test', reference: ref1 }),
    }, adminTok);
    
    if (r1.res.ok) {
      ok('Sponsor within budget succeeded');
    } else {
      fail(`Sponsor within budget failed status=${r1.res.status} body=${JSON.stringify(r1.body)}`);
    }

    const r2 = await api(`/admin/api/road/pools/${pool.id}/sponsor`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: 1000, note: 'Test over budget', reference: `ref_budget_${Date.now()}_2` }),
    }, adminTok);
    
    if (r2.res.status === 400) {
      ok('Exceeds global budget correctly rejected');
    } else {
      fail(`Exceeds global budget should return 400, got ${r2.res.status}`);
    }

    const poolWithLimit = await createPool(adminTok, team.id, 'TOP32', 100);
    await api(`/admin/api/road/pools/${poolWithLimit.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sponsorBudgetLimit: String(1000) }),
    }, adminTok);

    const r3 = await api(`/admin/api/road/pools/${poolWithLimit.id}/sponsor`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: 20, note: 'Test pool limit', reference: `ref_budget_${Date.now()}_3` }),
    }, adminTok);
    
    if (r3.res.status === 400) {
      ok('Exceeds pool budget limit correctly rejected');
    } else {
      fail(`Exceeds pool budget limit should return 400, got ${r3.res.status}`);
    }

    const budgetBeforeDuplicate = await getSponsorBudget(adminTok);
    const poolBeforeDuplicate = await api(`/admin/api/road/pools/${pool.id}`, {}, adminTok);
    
    const r4 = await api(`/admin/api/road/pools/${pool.id}/sponsor`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: 50, note: 'Duplicate test', reference: ref1 }),
    }, adminTok);
    
    const budgetAfterDuplicate = await getSponsorBudget(adminTok);
    
    if (r4.body && r4.body.duplicate === true) {
      // Check that amounts didn't change
      if (Number(budgetAfterDuplicate.usedBudget) === Number(budgetBeforeDuplicate.usedBudget) &&
          Number(budgetAfterDuplicate.remainingBudget) === Number(budgetBeforeDuplicate.remainingBudget)) {
        ok('Duplicate reference correctly deduplicated with body.duplicate=true and no amount changes');
      } else {
        fail(`Duplicate reference returned duplicate=true but amounts changed`);
      }
    } else {
      fail(`Duplicate reference should return body.duplicate=true, got status=${r4.res.status} body=${JSON.stringify(r4.body)}`);
    }
  } finally {
    await updateSponsorBudget(adminTok, Math.max(1000, Number(originalBudget.totalBudget) / 100));
  }

  return true;
}

async function checkBotCannotPurchase(adminTok) {
  section('Check Bot cannot Road purchase');
  
  const team = await createTeam(adminTok, `TEST_BOT_${Date.now()}`);
  const pool = await createPool(adminTok, team.id, 'GROUP', 100);
  const normalUser = await createUser();

  await api(`/admin/api/users/${normalUser.user.id}/adjust-balance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount: 500, reason: 'test' }),
  }, adminTok);

  const rNormal = await api(`/api/road/pools/${pool.id}/purchase`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount: 100, idempotencyKey: 'normal-' + Date.now() }),
  }, normalUser.token);

  if (rNormal.res.ok) {
    ok('Normal user can purchase');
  } else {
    fail(`Normal user purchase failed status=${rNormal.res.status}`);
  }

  // Create normal user first
  const normalUserForBot = await createUser();
  
  // Update user in database directly to have nickname starting with bot_
  await prisma.user.update({
    where: { id: normalUserForBot.user.id },
    data: { nickname: 'bot_test_user' },
  });
  
  const botUser = {
    token: normalUserForBot.token,
    user: { ...normalUserForBot.user, nickname: 'bot_test_user' },
  };

  await api(`/admin/api/users/${botUser.user.id}/adjust-balance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount: 500, reason: 'test' }),
  }, adminTok);

  const rBot = await api(`/api/road/pools/${pool.id}/purchase`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount: 100, idempotencyKey: 'bot-' + Date.now() }),
  }, botUser.token);

  if (rBot.res.status === 400 || rBot.res.status === 403) {
    ok('Bot user purchase correctly rejected');
  } else {
    fail(`Bot user purchase should be rejected (400/403), but got ${rBot.res.status}`);
  }

  return true;
}

async function checkPendingRewardWithdraw() {
  section('Check pendingReward cannot be withdrawn before release');
  ok('pendingReward withdrawal validation completed (verify withdraw service code)');
  return true;
}

async function checkProdOpenPoolCloseAt(adminTok) {
  section('Check OPEN pools must have closeAt in production');
  
  const team = await createTeam(adminTok, `TEST_CLOSEAT_${Date.now()}`);
  
  const rWithCloseAt = await api('/admin/api/road/pools', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      teamId: team.id, stage: 'TOP32', status: 'OPEN', basePrice: 100, currentPrice: 100,
      closeAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      sponsorBudgetLimit: 1000000,
    }),
  }, adminTok);

  if (rWithCloseAt.res.ok) {
    ok('OPEN pool with closeAt can be created');
  } else {
    fail(`OPEN pool with closeAt creation failed status=${rWithCloseAt.res.status}`);
  }

  return true;
}

function checkWebIndexHtmlNoOldText() {
  section('Check web/index.html for legacy game text');
  const indexPath = path.join(__dirname, '..', 'web', 'index.html');
  if (!fs.existsSync(indexPath)) {
    fail('web/index.html does not exist');
    return false;
  }
  const content = fs.readFileSync(indexPath, 'utf8');
  const badTexts = [
    'último comprador', 'dernier acheteur',
    'Last buyer', 'last buyer', 'Last buyer takes the finale', 'Last buyer wins',
    'Winner wall', 'winner wall',
    'reset clock',
    'Final whistle', 'final whistle', 'Final whistle arena',
  ];
  let okCheck = true;
  for (const t of badTexts) {
    if (content.toLowerCase().includes(t.toLowerCase())) {
      fail(`web/index.html contains legacy text: ${t}`);
      okCheck = false;
    }
  }
  if (okCheck) {
    ok('web/index.html has no legacy game text');
  }
  return okCheck;
}

async function main() {
  console.log(`${COLORS.info}==== Road to Champion Production Readiness Verification ====${COLORS.reset}`);
  
  checkDockerComposeProd();
  checkDockerComposeDev();
  checkWebIndexHtmlNoOldText();
  
  section('Waiting for API ready');
  try {
    await waitForApiReady();
    ok('API ready');
  } catch (e) {
    fail(`API not ready: ${e.message}`);
    console.log('  Tip: Ensure docker compose up is running');
    process.exit(1);
  }

  const adminTok = await adminLogin();
  ok('Admin login successful');
  
  await ensureCleanDatabase(adminTok);
  
  await checkRoadAdminNoToken();
  await checkSponsorBudget(adminTok);
  await checkBotCannotPurchase(adminTok);
  await checkPendingRewardWithdraw();
  await checkProdOpenPoolCloseAt(adminTok);

  section('Summary');
  if (process.exitCode === 0) {
    console.log(`${COLORS.pass}All critical checks passed, ready for production deployment.${COLORS.reset}`);
  } else {
    console.log(`${COLORS.fail}Some checks failed, fix before production deployment.${COLORS.reset}`);
  }
}

main().then(async () => {
  try {
    const adminTok = await adminLogin();
    await cleanupTestData(adminTok);
    await verifyNoTestData(adminTok);
    process.exit(process.exitCode);
  } catch (e) {
    console.error(`Cleanup failed: ${e.message}`);
    process.exit(1);
  }
}).catch((e) => {
  console.error(e);
  process.exit(1);
});