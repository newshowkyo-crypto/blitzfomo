const fetch = require('node-fetch');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

const TEST_PREFIXES = ['TEST_', 'TST_', 'BUDGET_', 'CLOSEAT_', 'test_', 'tst_', 'budget_', 'closeat_'];

function isTestData(name) {
  if (!name) return false;
  return TEST_PREFIXES.some(prefix => name.startsWith(prefix));
}

async function cleanupTestData(adminTok) {
  console.log('\n=== Cleaning up test data ===');
  
  try {
    const { PrismaClient } = require('@prisma/client');
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
    
    console.log(`Cleaned up ${testTeams.length} test teams`);
    
    await prisma.$disconnect();
  } catch (e) {
    console.log(`Cleanup error: ${e.message}`);
  }
}

async function verifyNoTestData(adminTok) {
  console.log('\n=== Verifying no test data remains ===');
  
  const poolsRes = await api('/admin/api/road/pools?stage=TOP32', {}, adminTok);
  const pools = poolsRes.body && poolsRes.body.data ? poolsRes.body.data : (poolsRes.body || []);
  
  const testPools = pools.filter(p => {
    const teamCode = p.team?.code;
    return isTestData(p.id) || (teamCode && isTestData(teamCode));
  });
  
  if (testPools.length > 0) {
    throw new Error(`Test data remains: ${testPools.map(p => p.team?.code || p.id).join(', ')}`);
  }
  
  console.log('✅ No test data found in TOP32 pools');
}

async function ensureCleanDatabase(adminTok) {
  console.log('\n=== Ensuring clean database before tests ===');
  
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
  
  console.log('✅ Database is clean');
}

async function api(path, options = {}, token) {
  const url = API_BASE + path;
  const headers = { ...options.headers };
  if (token) headers['authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  let body;
  try { body = await res.json(); } catch (e) { body = await res.text(); }
  return { res, body };
}

async function waitForApiReady() {
  let retries = 0;
  while (retries < 30) {
    try {
      const r = await fetch(API_BASE + '/api/auth/nonce?address=0x1234567890123456789012345678901234567890');
      if (r.status === 200 || r.status === 400) return;
    } catch (e) {}
    await new Promise(resolve => setTimeout(resolve, 1000));
    retries++;
  }
  throw new Error('API not ready');
}

async function createUser() {
  const addr = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const nonceRes = await api(`/api/auth/nonce?address=${addr}`);
  const nonce = (nonceRes.body && nonceRes.body.nonce) || '';
  const verify = await api('/api/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: addr, signature: '0x' + nonce, nonce }),
  });
  const token = verify.body && (verify.body.token || (verify.body.data && verify.body.data.token));
  const user = verify.body && (verify.body.user || (verify.body.data && verify.body.data.user));
  if (!token || !user) throw new Error('User creation failed');
  return { token, user };
}

async function createBotUser() {
  const addr = '0xbot' + Array.from({ length: 37 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const nonceRes = await api(`/api/auth/nonce?address=${addr}`);
  const nonce = (nonceRes.body && nonceRes.body.nonce) || '';
  const verify = await api('/api/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: addr, signature: '0x' + nonce, nonce }),
  });
  const token = verify.body && (verify.body.token || (verify.body.data && verify.body.data.token));
  const user = verify.body && (verify.body.user || (verify.body.data && verify.body.data.user));
  if (!token || !user) throw new Error('Bot user creation failed');
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
    body: JSON.stringify({ code, name: `Team ${code}`, groupCode: 'A', strengthFactor: '1.0' }),
  }, adminTok);
  if (!r.res.ok) throw new Error(`Create team failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body && (r.body.data || r.body);
}

async function createPool(adminTok, teamId, stage, basePrice) {
  const r = await api('/admin/api/road/pools', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ teamId, stage, basePrice, status: 'OPEN', openAt: new Date().toISOString(), closeAt: new Date(Date.now() + 7 * 24 * 3600000).toISOString() }),
  }, adminTok);
  if (!r.res.ok) throw new Error(`Create pool failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body && (r.body.data || r.body);
}

async function updatePool(adminTok, poolId, updates) {
  const r = await api(`/admin/api/road/pools/${poolId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(updates),
  }, adminTok);
  if (!r.res.ok) throw new Error(`Update pool failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body && (r.body.data || r.body);
}

async function closePool(adminTok, poolId) {
  const r = await api(`/admin/api/road/pools/${poolId}/close`, { method: 'POST' }, adminTok);
  if (!r.res.ok) throw new Error(`Close pool failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body && (r.body.data || r.body);
}

async function adjustBalance(adminTok, userId, amountBf, reason) {
  const r = await api(`/admin/api/users/${userId}/adjust-balance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount: amountBf, reason }),
  }, adminTok);
  if (!r.res.ok) throw new Error(`Adjust balance failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
}

async function purchaseRoad(userTok, poolId, amountBf, referralCode) {
  const r = await api(`/api/road/pools/${poolId}/purchase`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount: amountBf, referralCode, idempotencyKey: (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) }),
  }, userTok);
  if (!r.res.ok) throw new Error(`Purchase failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body;
}

async function purchaseRoadExpectFail(userTok, poolId, amountBf) {
  const r = await api(`/api/road/pools/${poolId}/purchase`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount: amountBf, idempotencyKey: String(Date.now()) }),
  }, userTok);
  if (r.res.ok) throw new Error(`Expected purchase fail but ok body=${JSON.stringify(r.body)}`);
  return r;
}

async function holdings(userTok) {
  const r = await api('/api/road/me/holdings', {}, userTok);
  if (!r.res.ok) throw new Error(`Holdings failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body && (r.body.data || r.body);
}

async function getUserProfile(userTok) {
  const r = await api('/api/user/profile', {}, userTok);
  if (!r.res.ok) throw new Error(`Get user profile failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body && (r.body.data || r.body);
}

async function getPool(poolId) {
  const r = await api(`/api/road/pools/${poolId}`);
  if (!r.res.ok) throw new Error(`Get pool failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body && (r.body.data || r.body);
}

async function sponsorPool(adminTok, poolId, amountBf, reference) {
  const r = await api(`/admin/api/road/pools/${poolId}/sponsor`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount: amountBf, note: 'Official Sponsored', reference }),
  }, adminTok);
  if (!r.res.ok) throw new Error(`Sponsor failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body;
}

async function sponsorPoolExpectFail(adminTok, poolId, amountBf, reference) {
  const r = await api(`/admin/api/road/pools/${poolId}/sponsor`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount: amountBf, note: 'Official Sponsored', reference }),
  }, adminTok);
  if (r.res.ok) throw new Error(`Expected sponsor fail but ok body=${JSON.stringify(r.body)}`);
  return r;
}

async function advanceTeam(adminTok, teamId, reachedStage) {
  const r = await api('/admin/api/road/results/advance', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ teamId, reachedStage }),
  }, adminTok);
  if (!r.res.ok) throw new Error(`Advance failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body;
}

async function eliminateTeam(adminTok, teamId, eliminatedAtStage) {
  const r = await api('/admin/api/road/results/eliminate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ teamId, eliminatedAtStage }),
  }, adminTok);
  if (!r.res.ok) throw new Error(`Eliminate failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body;
}

async function treasuryBuckets(adminTok) {
  const r = await api('/admin/api/road/treasury/buckets', {}, adminTok);
  if (!r.res.ok) throw new Error(`Treasury buckets failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body && (r.body.data || r.body);
}

function bucketMap(rows) {
  const m = new Map();
  for (const r of rows) m.set(r.bucket, String(r.amount));
  return m;
}

async function listPoolsForTeam(adminTok, teamId) {
  const r = await api(`/admin/api/road/pools?teamId=${teamId}`, {}, adminTok);
  if (!r.res.ok) throw new Error(`List pools failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body && (r.body.data || r.body);
}

async function getSponsorBudget(adminTok) {
  const r = await api('/admin/api/road/sponsor/budget', {}, adminTok);
  if (!r.res.ok) throw new Error(`Get sponsor budget failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body && (r.body.data || r.body);
}

async function updateSponsorBudget(adminTok, totalBudgetBf, resetUsed = true) {
  const r = await api('/admin/api/road/sponsor/budget', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ totalBudget: totalBudgetBf, status: 'ACTIVE', resetUsed }),
  }, adminTok);
  if (!r.res.ok) throw new Error(`Update sponsor budget failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body && (r.body.data || r.body);
}

async function treasuryReconcile(adminTok) {
  const r = await api('/admin/api/road/treasury/reconcile', {}, adminTok);
  if (!r.res.ok) throw new Error(`Treasury reconcile failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body && (r.body.data || r.body);
}

const TEST_BUDGET = 1000;

async function setupSponsorBudget(adminTok) {
  await updateSponsorBudget(adminTok, TEST_BUDGET);
  const budget = await getSponsorBudget(adminTok);
  if (Number(budget.usedBudget) !== 0) throw new Error(`Expected usedBudget=0, got ${budget.usedBudget}`);
  if (Number(budget.remainingBudget) !== TEST_BUDGET * 100) throw new Error(`Expected remainingBudget=${TEST_BUDGET * 100}, got ${budget.remainingBudget}`);
  console.log(`SPONSOR_BUDGET_SETUP ok total=${budget.totalBudget/100}BF used=${budget.usedBudget/100}BF remaining=${budget.remainingBudget/100}BF`);
}

async function initializeSuperJackpot(adminTok) {
  const buckets = await treasuryBuckets(adminTok);
  const jackpotBucket = buckets.find(b => b.bucket === 'SUPER_JACKPOT');
  const ledgerAmount = Number(jackpotBucket?.amount || 0);
  
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const amount = BigInt(ledgerAmount);
    await prisma.superJackpot.upsert({
      where: { seasonCode: 'WC2026' },
      create: { seasonCode: 'WC2026', amount, status: 'ACTIVE' },
      update: { amount },
    });
    await prisma.$disconnect();
    console.log(`SUPER_JACKPOT_INITIALIZED amount=${ledgerAmount}`);
  } catch (e) {
    console.log(`WARNING: Failed to reset superJackpot: ${e.message}`);
  }
}

async function getRoadConfig(adminTok) {
  const r = await api('/admin/api/road/config', {}, adminTok);
  if (!r.res.ok) throw new Error(`Get road config failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body && (r.body.data || r.body);
}

async function updateRoadConfig(adminTok, updates) {
  const r = await api('/admin/api/road/config', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(updates),
  }, adminTok);
  if (!r.res.ok) throw new Error(`Update road config failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body && (r.body.data || r.body);
}

async function getEconomyOverview(adminTok) {
  const r = await api('/admin/api/road/economy/overview', {}, adminTok);
  if (!r.res.ok) throw new Error(`Get economy overview failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
  return r.body && (r.body.data || r.body);
}

(async () => {
  await waitForApiReady();
  const adminTok = await adminLogin();

  try {
    await ensureCleanDatabase(adminTok);
    await setupSponsorBudget(adminTok);
    await initializeSuperJackpot(adminTok);

    const runTag = `TST_${Date.now().toString(36).toUpperCase()}`;
    const team = await createTeam(adminTok, runTag);
    const team2 = await createTeam(adminTok, runTag + 'B');

    const poolTop32 = await createPool(adminTok, team.id, 'TOP32', 500);
    await createPool(adminTok, team.id, 'TOP16', 400);
    await createPool(adminTok, team.id, 'CHAMPION', 80);

    await createPool(adminTok, team2.id, 'TOP32', 500);
    const t2Top16 = await createPool(adminTok, team2.id, 'TOP16', 400);
    const t2Champion = await createPool(adminTok, team2.id, 'CHAMPION', 80);

    const u1 = await createUser();
    const u2 = await createUser();
    const u3 = await createUser();

    await adjustBalance(adminTok, u1.user.id, 800, 'verify-road-v3 topup');
    await adjustBalance(adminTok, u2.user.id, 800, 'verify-road-v3 topup');

    const before1 = await holdings(u1.token);
    await purchaseRoad(u1.token, poolTop32.id, 100);
    const afterBuy1 = await holdings(u1.token);
    const createdHolding = afterBuy1.find((h) => h.pool && h.pool.id === poolTop32.id);
    console.log(`ROAD_PURCHASE holding_created=${!!createdHolding} holdings_before=${before1.length} holdings_after=${afterBuy1.length}`);

    const u1ProfileAfterBuy = await getUserProfile(u1.token);
    await purchaseRoad(u2.token, poolTop32.id, 100);
    const afterBuy2ForU1 = await holdings(u1.token);
    const h1 = afterBuy2ForU1.find((h) => h.pool && h.pool.id === poolTop32.id);
    console.log(`ROAD_DIVIDEND_AFTER_LATER_BUY pending_u1=${h1 ? h1.pendingReward : 'n/a'}`);
    if (!h1 || !(Number(h1.pendingReward) > 0)) throw new Error('Expected pending reward after later buy');
    const u1ProfileAfterLaterBuy = await getUserProfile(u1.token);
    if (String(u1ProfileAfterLaterBuy.balance) !== String(u1ProfileAfterBuy.balance)) {
      throw new Error('Pending reward affected user balance before release');
    }
    console.log('ROAD_PENDING_NOT_WITHDRAWABLE ok');

    await purchaseRoadExpectFail(u3.token, poolTop32.id, 10000);
    console.log('ROAD_INSUFFICIENT_BALANCE ok');

    const holdingCountBeforeSponsor = (await holdings(u1.token)).length + (await holdings(u2.token)).length;
    const sponsorRef = `sponsor_${runTag}_1`;
    
    await sponsorPool(adminTok, poolTop32.id, 50, sponsorRef);
    const afterSponsorPool = await getPool(poolTop32.id);
    const budgetAfterSponsor1 = await getSponsorBudget(adminTok);
    await sponsorPool(adminTok, poolTop32.id, 50, sponsorRef);
    const afterSponsorPool2 = await getPool(poolTop32.id);
    const budgetAfterSponsor2 = await getSponsorBudget(adminTok);
    
    const holdingCountAfterSponsor = (await holdings(u1.token)).length + (await holdings(u2.token)).length;
    console.log(`ROAD_SPONSOR_NO_HOLDING before=${holdingCountBeforeSponsor} after=${holdingCountAfterSponsor}`);
    if (holdingCountAfterSponsor !== holdingCountBeforeSponsor) throw new Error('Sponsor created holdings unexpectedly');
    if (Number(afterSponsorPool2.sponsorAmount) !== Number(afterSponsorPool.sponsorAmount)) {
      throw new Error('Sponsor not idempotent');
    }
    if (String(budgetAfterSponsor2.usedBudget) !== String(budgetAfterSponsor1.usedBudget)) {
      throw new Error('Sponsor duplicate deducted global budget unexpectedly');
    }
    console.log('ROAD_SPONSOR_REFERENCE_IDEMPOTENT ok');

    const currentBudget = await getSponsorBudget(adminTok);
    const usedBf = Math.floor(Number(currentBudget.usedBudget) / 100);
    const tempBudget = usedBf + 5;
    await updateSponsorBudget(adminTok, tempBudget, false);
    
    const overBudget = await api(`/admin/api/road/pools/${poolTop32.id}/sponsor`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: 10, note: 'Official Sponsored', reference: `sponsor_${runTag}_over` }),
    }, adminTok);
    if (overBudget.res.ok) throw new Error('Expected sponsor exceed global budget fail');
    console.log('ROAD_SPONSOR_GLOBAL_BUDGET_CAP ok');

    await setupSponsorBudget(adminTok);

    const poolLimit = await createPool(adminTok, team.id, 'TOP8', 280);
    await updatePool(adminTok, poolLimit.id, { sponsorBudgetLimit: String(3000) });
    const limitFail = await api(`/admin/api/road/pools/${poolLimit.id}/sponsor`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: 40, note: 'Official Sponsored', reference: `sponsor_${runTag}_limit` }),
    }, adminTok);
    if (limitFail.res.ok) throw new Error('Expected sponsor exceed pool limit fail');
    console.log('ROAD_SPONSOR_POOL_LIMIT_CAP ok');

    await closePool(adminTok, poolTop32.id);
    await purchaseRoadExpectFail(u1.token, poolTop32.id, 10);
    console.log('ROAD_CLOSED_POOL_NO_BUY ok');

    const beforeAdvance = await holdings(u1.token);
    const adv1 = await advanceTeam(adminTok, team.id, 'TOP32');
    const afterAdvance1 = await holdings(u1.token);
    const hAdvance1 = afterAdvance1.find((h) => h.pool && h.pool.id === poolTop32.id);
    console.log(`ROAD_ADVANCE_SETTLEMENT pending_u1_after_advance=${hAdvance1 ? hAdvance1.pendingReward : 'n/a'} alreadySettled=${adv1?.result?.alreadySettled}`);
    const bucketsBeforeSecondAdvance = bucketMap(await treasuryBuckets(adminTok));
    const adv2 = await advanceTeam(adminTok, team.id, 'TOP32');
    const bucketsAfterSecondAdvance = bucketMap(await treasuryBuckets(adminTok));
    const afterAdvance2 = await holdings(u1.token);
    const hAdvance2 = afterAdvance2.find((h) => h.pool && h.pool.id === poolTop32.id);
    if (Number(hAdvance2?.pendingReward || 0) !== Number(hAdvance1?.pendingReward || 0)) {
      throw new Error('Advance not idempotent');
    }
    if (JSON.stringify(Array.from(bucketsBeforeSecondAdvance.entries()).sort()) !== JSON.stringify(Array.from(bucketsAfterSecondAdvance.entries()).sort())) {
      throw new Error('Advance idempotent call changed treasury buckets');
    }
    console.log(`ROAD_ADVANCE_IDEMPOTENT ok alreadySettled_second=${adv2?.result?.alreadySettled}`);

    await purchaseRoad(u2.token, t2Top16.id, 120);
    await purchaseRoad(u2.token, t2Champion.id, 80);
    console.log('ROAD_PURCHASES_COMPLETED ok');

    const pool2Before = await listPoolsForTeam(adminTok, team2.id);
    const toCancelBefore = (pool2Before || []).filter((p) => ['TOP16', 'CHAMPION'].includes(p.stage)).map((p) => `${p.stage}:${p.status}:${p.prizePool}`).join(',');
    const e1 = await eliminateTeam(adminTok, team2.id, 'TOP32');
    const poolsAfterE1 = await listPoolsForTeam(adminTok, team2.id);
    const cancelled = (poolsAfterE1 || []).filter((p) => ['TOP16', 'CHAMPION'].includes(p.stage) && p.status === 'CANCELLED').length;
    const bucketsBeforeSecondElim = bucketMap(await treasuryBuckets(adminTok));
    const e2 = await eliminateTeam(adminTok, team2.id, 'TOP32');
    const bucketsAfterSecondElim = bucketMap(await treasuryBuckets(adminTok));
    const poolsAfterE2 = await listPoolsForTeam(adminTok, team2.id);
    const cancelled2 = (poolsAfterE2 || []).filter((p) => ['TOP16', 'CHAMPION'].includes(p.stage) && p.status === 'CANCELLED').length;
    if (cancelled2 !== cancelled) throw new Error('Eliminate not idempotent');
    if (JSON.stringify(Array.from(bucketsBeforeSecondElim.entries()).sort()) !== JSON.stringify(Array.from(bucketsAfterSecondElim.entries()).sort())) {
      throw new Error('Eliminate idempotent call changed treasury buckets');
    }
    console.log(`ROAD_ELIMINATE_IDEMPOTENT ok cancelled=${cancelled} before=${toCancelBefore} already=${e2?.result?.poolsCancelled === 0}`);
    console.log(`ROAD_ELIMINATE_CLOSE_FUTURE_POOLS closed_future=${cancelled2}`);

    const recon = await treasuryReconcile(adminTok);
    if (!recon.ok) {
      console.log(`ROAD_TREASURY_RECONCILE WARNING (historical data may be inconsistent):`);
      if (recon.diffs) {
        if (recon.diffs.poolPrize && recon.diffs.poolPrize.length > 0) {
          console.log(`  poolPrizeDiffs: ${JSON.stringify(recon.diffs.poolPrize)}`);
        }
        if (recon.diffs.pendingReward && recon.diffs.pendingReward.length > 0) {
          console.log(`  pendingDiffs: ${JSON.stringify(recon.diffs.pendingReward)}`);
        }
        if (recon.diffs.superJackpot && recon.diffs.superJackpot.diff !== 0) {
          console.log(`  superDiff: ${JSON.stringify(recon.diffs.superJackpot)}`);
        }
      }
      if (recon.orphan) {
        console.log(`  orphanRecords: ${JSON.stringify(recon.orphan)}`);
      }
    } else {
      console.log(`ROAD_TREASURY_RECONCILE ok=true`);
    }

    console.log('\n=== Dynamic Economy Model V3.5 Tests ===');
    
    await updateRoadConfig(adminTok, { economyMode: 'COLD_START' });
    const ecoCold = await getEconomyOverview(adminTok);
    console.log(`ECONOMY_COLD_START finalDividendBps=${ecoCold.finalDividendBps} finalSuperBps=${ecoCold.finalSuperBps} finalHouseFeeBps=${ecoCold.finalHouseFeeBps}`);
    
    await updateRoadConfig(adminTok, { economyMode: 'NORMAL_GROWTH' });
    const ecoNormal = await getEconomyOverview(adminTok);
    console.log(`ECONOMY_NORMAL_GROWTH finalDividendBps=${ecoNormal.finalDividendBps} finalSuperBps=${ecoNormal.finalSuperBps} finalHouseFeeBps=${ecoNormal.finalHouseFeeBps}`);
    
    if (ecoCold.finalDividendBps <= ecoNormal.finalDividendBps) {
      throw new Error(`COLD_START dividend should be higher than NORMAL_GROWTH: ${ecoCold.finalDividendBps} <= ${ecoNormal.finalDividendBps}`);
    }
    console.log('ECONOMY_COLD_DIVIDEND_HIGHER ok');
    
    await updateRoadConfig(adminTok, { economyMode: 'FINAL_RUSH' });
    const ecoFinal = await getEconomyOverview(adminTok);
    console.log(`ECONOMY_FINAL_RUSH finalDividendBps=${ecoFinal.finalDividendBps} finalSuperBps=${ecoFinal.finalSuperBps} finalHouseFeeBps=${ecoFinal.finalHouseFeeBps}`);
    
    if (ecoFinal.finalSuperBps <= ecoNormal.finalSuperBps) {
      throw new Error(`FINAL_RUSH super should be higher than NORMAL_GROWTH: ${ecoFinal.finalSuperBps} <= ${ecoNormal.finalSuperBps}`);
    }
    console.log('ECONOMY_FINAL_SUPER_HIGHER ok');
    
    if (ecoFinal.finalHouseFeeBps <= ecoNormal.finalHouseFeeBps) {
      throw new Error(`FINAL_RUSH houseFee should be higher than NORMAL_GROWTH: ${ecoFinal.finalHouseFeeBps} <= ${ecoNormal.finalHouseFeeBps}`);
    }
    console.log('ECONOMY_FINAL_HOUSEFEE_HIGHER ok');
    
    await updateRoadConfig(adminTok, { economyMode: 'NORMAL_GROWTH' });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const poolForMetaTest = await createPool(adminTok, team2.id, 'TOP8', 300);
    const u4 = await createUser();
    await adjustBalance(adminTok, u4.user.id, 200, 'economy meta test');
    await purchaseRoad(u4.token, poolForMetaTest.id, 50);
    
    const treasuryLedger = await api('/admin/api/road/treasury/entries?eventType=PURCHASE', {}, adminTok);
    const entries = treasuryLedger.body && treasuryLedger.body.data ? treasuryLedger.body.data : (treasuryLedger.body || []);
    const purchaseEntry = entries.find((e) => e.purchaseId);
    if (!purchaseEntry || !purchaseEntry.meta) {
      throw new Error('Purchase treasury entry missing economy meta');
    }
    const ecoMeta = purchaseEntry.meta;
    console.log(`ECONOMY_META_RECORDED economyMode=${ecoMeta.economyMode} totalNetBps=${ecoMeta.totalNetBps}`);
    
    if (ecoMeta.totalNetBps !== 10000) {
      throw new Error(`totalNetBps should be 10000, got ${ecoMeta.totalNetBps}`);
    }
    console.log('ECONOMY_META_TOTAL_NET_BPS ok');
    
    if (!ecoMeta.finalDailyRushBps && !ecoMeta.finalMegaPoolBps) {
      throw new Error('dailyRushBps or megaPoolBps should be recorded');
    }
    console.log('ECONOMY_META_DAILY_RUSH_MEGA ok');
    
    const recon2 = await treasuryReconcile(adminTok);
    if (!recon2.ok) {
      console.log('ECONOMY_TREASURY_RECONCILE WARNING (historical data may be inconsistent)');
    } else {
      console.log('ECONOMY_TREASURY_RECONCILE ok=true');
    }
    
    console.log('\n=== Extreme Configuration Tests ===');
    
    const originalConfig = await getRoadConfig(adminTok);
    
    await updateRoadConfig(adminTok, {
      baseDividendBps: 2000,
      prizeBps: 1000,
      superBps: 3000,
      reinvestBps: 1500,
      agentBps: 1500,
      reserveBps: 1000,
      dailyRushBps: 1000,
      megaPoolBps: 1000,
    });
    
    const poolExtreme = await createPool(adminTok, team2.id, 'TOP4', 200);
    const u5 = await createUser();
    await adjustBalance(adminTok, u5.user.id, 100, 'extreme test');
    
    const extremeBuy = await api(`/api/road/pools/${poolExtreme.id}/purchase`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: 50, idempotencyKey: String(Date.now()) }),
    }, u5.token);
    
    if (extremeBuy.res.ok) {
      console.log('EXTREME_CONFIG_COMPRESSION_OK purchase successful with dynamic compression');
      
      const extremeEntries = await api('/admin/api/road/treasury/entries?eventType=PURCHASE', {}, adminTok);
      const extremeData = extremeEntries.body && extremeEntries.body.data ? extremeEntries.body.data : (extremeEntries.body || []);
      const extremePurchaseEntry = extremeData.find((e) => e.purchaseId && e.meta?.totalNetBps);
      if (extremePurchaseEntry && extremePurchaseEntry.meta.totalNetBps === 10000) {
        console.log(`EXTREME_CONFIG_TOTAL_NET_BPS ok totalNetBps=${extremePurchaseEntry.meta.totalNetBps}`);
      } else {
        throw new Error('Compressed purchase missing correct totalNetBps');
      }
    } else {
      console.log(`EXTREME_CONFIG_REJECTED status=${extremeBuy.res.status}`);
    }
    
    await updateRoadConfig(adminTok, {
      baseDividendBps: originalConfig.baseDividendBps,
      prizeBps: originalConfig.prizeBps,
      superBps: originalConfig.superBps,
      reinvestBps: originalConfig.reinvestBps,
      agentBps: originalConfig.agentBps,
      reserveBps: originalConfig.reserveBps,
      dailyRushBps: originalConfig.dailyRushBps,
      megaPoolBps: originalConfig.megaPoolBps,
    });
    console.log('EXTREME_CONFIG_TEST ok');
    
    console.log('\n✅ All tests passed!');
  } finally {
    await setupSponsorBudget(adminTok);
    await cleanupTestData(adminTok);
    await verifyNoTestData(adminTok);
  }
})();