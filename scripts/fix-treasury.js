const fetch = require('node-fetch');
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function api(path, options = {}, token = '') {
  const headers = { ...(options.headers || {}) };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { ...options, headers });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { _raw: text }; }
  return { res, body };
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

async function getReconcile(adminTok) {
  const r = await api('/admin/api/road/treasury/reconcile', {}, adminTok);
  return r.body;
}

async function fixPoolPrizeDiffs(adminTok, diffs) {
  console.log('Fixing pool prize diffs...');
  for (const diff of diffs) {
    console.log(`  Pool ${diff.pool_id}: pool_prize=${diff.pool_prize}, ledger_prize=${diff.ledger_prize}, diff=${diff.diff}`);
    // Add missing POOL_PRIZE entries to treasury ledger
    if (Number(diff.diff) > 0) {
      const r = await api('/admin/api/road/treasury/entries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventType: 'FIX_RECONCILE',
          eventId: `fix_pool_prize_${diff.pool_id}`,
          entries: [{ bucket: 'POOL_PRIZE', amount: Number(diff.diff), poolId: diff.pool_id }],
        }),
      }, adminTok);
      console.log(`    Fixed: status=${r.res.status}`);
    }
  }
}

async function fixPendingRewardDiffs(adminTok, diffs) {
  console.log('Fixing pending reward diffs...');
  for (const diff of diffs) {
    console.log(`  Pool ${diff.pool_id}: holding_pending=${diff.holding_pending}, ledger_pending=${diff.ledger_pending}, diff=${diff.diff}`);
    // Add missing PENDING_REWARD entries to treasury ledger
    if (Number(diff.diff) > 0) {
      const r = await api('/admin/api/road/treasury/entries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventType: 'FIX_RECONCILE',
          eventId: `fix_pending_${diff.pool_id}`,
          entries: [{ bucket: 'PENDING_REWARD', amount: Number(diff.diff), poolId: diff.pool_id }],
        }),
      }, adminTok);
      console.log(`    Fixed: status=${r.res.status}`);
    }
  }
}

async function fixSuperJackpotDiff(adminTok, diff) {
  console.log(`Fixing super jackpot diff: db=${diff.db}, treasury=${diff.treasury}, diff=${diff.diff}`);
  if (diff.diff !== 0) {
    const r = await api('/admin/api/road/treasury/entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventType: 'FIX_RECONCILE',
        eventId: 'fix_super_jackpot',
        entries: [{ bucket: 'SUPER_JACKPOT', amount: diff.diff }],
      }),
    }, adminTok);
    console.log(`    Fixed: status=${r.res.status}`);
  }
}

async function main() {
  console.log('=== Treasury Reconcile Fix Script ===');
  
  const adminTok = await adminLogin();
  console.log('Admin login successful');
  
  let reconcile = await getReconcile(adminTok);
  console.log(`Initial reconcile status: ok=${reconcile.ok}`);
  
  if (reconcile.diffs && reconcile.diffs.poolPrize && reconcile.diffs.poolPrize.length > 0) {
    await fixPoolPrizeDiffs(adminTok, reconcile.diffs.poolPrize);
  }
  
  if (reconcile.diffs && reconcile.diffs.pendingReward && reconcile.diffs.pendingReward.length > 0) {
    await fixPendingRewardDiffs(adminTok, reconcile.diffs.pendingReward);
  }
  
  if (reconcile.diffs && reconcile.diffs.superJackpot && reconcile.diffs.superJackpot.diff !== 0) {
    await fixSuperJackpotDiff(adminTok, reconcile.diffs.superJackpot);
  }
  
  // Verify fix
  reconcile = await getReconcile(adminTok);
  console.log(`\nFinal reconcile status: ok=${reconcile.ok}`);
  
  if (reconcile.ok) {
    console.log('✅ All treasury differences fixed!');
  } else {
    console.log('❌ Some differences remain:');
    if (reconcile.diffs) {
      if (reconcile.diffs.poolPrize && reconcile.diffs.poolPrize.length > 0) {
        console.log('  poolPrize diffs:', reconcile.diffs.poolPrize);
      }
      if (reconcile.diffs.pendingReward && reconcile.diffs.pendingReward.length > 0) {
        console.log('  pendingReward diffs:', reconcile.diffs.pendingReward);
      }
      if (reconcile.diffs.superJackpot && reconcile.diffs.superJackpot.diff !== 0) {
        console.log('  superJackpot diff:', reconcile.diffs.superJackpot);
      }
    }
  }
}

main().catch(console.error);
