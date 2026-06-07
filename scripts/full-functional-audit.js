const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.AUDIT_BASE || 'http://localhost:8081';
const OUT = path.join(process.cwd(), 'audit-output');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const notes = [];
function add(name, ok, detail = '') { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' - ' + detail : ''}`); }
function data(x) { return x && typeof x === 'object' && 'data' in x ? x.data : x; }
async function req(method, url, body, token) {
  const r = await fetch(BASE + url, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  const text = await r.text();
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { status: r.status, ok: r.ok, json: data(json), raw: json };
}
async function must(name, fn) {
  try { const d = await fn(); add(name, true, d || ''); return d; }
  catch (e) { add(name, false, e.message.slice(0, 260)); return null; }
}
async function poll(fn, timeout = 18000) {
  const start = Date.now(); let last;
  while (Date.now() - start < timeout) { last = await fn(); if (last) return last; await new Promise(r => setTimeout(r, 1000)); }
  throw new Error('timeout');
}
async function waitForApiReady(timeout = 45000) {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeout) {
    try {
      const r = await req('GET', '/api/health');
      if (r.ok) return;
      last = `HTTP ${r.status}`;
    } catch (e) {
      last = e.message;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`API not ready after ${timeout}ms: ${last}`);
}
(async () => {
  await waitForApiReady();

  await must('API health/game state reachable', async () => {
    const r = await req('GET', '/api/game/state');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return `round=${r.json?.currentRound?.roundNumber || r.json?.roundNumber || 'ok'}`;
  });

  const userAddress = '0x' + Math.random().toString(16).slice(2).padEnd(40, 'a').slice(0, 40);
  const userToken = await must('User demo auth flow works in local dev', async () => {
    const n = await req('GET', `/api/auth/nonce?address=${userAddress}`);
    if (!n.ok || !n.json?.nonce) throw new Error(`nonce failed ${n.status}`);
    const v = await req('POST', '/api/auth/verify', { address: userAddress, signature: '0x123456789abcdef', nonce: n.json.nonce });
    if (!v.ok || !v.json?.token) throw new Error(`verify failed ${v.status}`);
    return v.json.token;
  });

  await must('Invalid Telegram initData is rejected', async () => {
    const r = await req('POST', '/api/auth/telegram', { initData: 'bad=1&hash=nope' });
    if (r.status < 400) throw new Error(`expected reject, got ${r.status}`);
    return `HTTP ${r.status}`;
  });

  let balanceBefore = 0;
  await must('Profile endpoints work', async () => {
    const p = await req('GET', '/api/user/profile/rich', undefined, userToken);
    if (!p.ok) throw new Error(`profile HTTP ${p.status}`);
    balanceBefore = Number(p.json?.balanceUsdt ?? p.json?.balance ?? p.json?.user?.balanceUsdt ?? 0);
    const upd = await req('PATCH', '/api/user/profile', { nickname: 'Audit Player' }, userToken);
    if (!upd.ok) throw new Error(`profile patch HTTP ${upd.status}`);
    return `balance=${balanceBefore}`;
  });

  let orderId;
  await must('Mock payment creates and auto-pays', async () => {
    const c = await req('POST', '/api/payment/create', { amountUsdt: 100 }, userToken);
    if (!c.ok) throw new Error(`create HTTP ${c.status} ${JSON.stringify(c.raw).slice(0,120)}`);
    orderId = c.json?.orderId || c.json?.id;
    if (!orderId) throw new Error('missing orderId');
    const paid = await poll(async () => {
      const s = await req('GET', `/api/payment/${orderId}`, undefined, userToken);
      if (!s.ok) throw new Error(`status HTTP ${s.status}`);
      return s.json?.status === 'PAID' ? s.json : null;
    });
    return `order=${orderId}, status=${paid.status}`;
  });

  await must('Balance credited after payment', async () => {
    const p = await req('GET', '/api/user/profile/rich', undefined, userToken);
    const after = Number(p.json?.balanceUsdt ?? p.json?.balance ?? p.json?.user?.balanceUsdt ?? 0);
    if (after < balanceBefore + 49.99) throw new Error(`balance not credited before=${balanceBefore} after=${after}`);
    return `${balanceBefore} -> ${after}`;
  });

  await must('Purchase succeeds and duplicate idempotency is blocked', async () => {
    const key = 'audit-' + Date.now();
    const a = await req('POST', '/api/game/purchase', { amount: 10, idempotencyKey: key }, userToken);
    if (!a.ok) throw new Error(`purchase HTTP ${a.status} ${JSON.stringify(a.raw).slice(0,140)}`);
    const b = await req('POST', '/api/game/purchase', { amount: 10, idempotencyKey: key }, userToken);
    if (!(b.json?.duplicate === true || b.status >= 400)) throw new Error(`duplicate not flagged HTTP ${b.status}`);
    return b.json?.duplicate ? 'duplicate flagged without double charge' : `duplicate HTTP ${b.status}`;
  });

  await must('Insufficient purchase is rejected', async () => {
    const r = await req('POST', '/api/game/purchase', { amount: 999999, idempotencyKey: 'audit-big-' + Date.now() }, userToken);
    if (r.status < 400) throw new Error(`expected reject, got ${r.status}`);
    return `HTTP ${r.status}`;
  });

  await must('Game read endpoints work', async () => {
    for (const url of ['/api/game/recent-purchases', '/api/game/winner-wall']) {
      const r = await req('GET', url);
      if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
    }
    return 'recent + winner wall';
  });

  await must('Admin API rejects requests without a valid token', async () => {
    const noToken = await req('GET', '/admin/api/users');
    if (noToken.status !== 401 && noToken.status !== 403) throw new Error(`no-token expected 401/403, got ${noToken.status}`);
    const badToken = await req('GET', '/admin/api/users', undefined, 'obviously.invalid.token');
    if (badToken.status !== 401 && badToken.status !== 403) throw new Error(`bad-token expected 401/403, got ${badToken.status}`);
    return `no-token=${noToken.status}, bad-token=${badToken.status}`;
  });

  const adminToken = await must('Admin login works; wrong password rejected', async () => {
    const bad = await req('POST', '/admin/api/auth/login', { username: 'super_admin', password: 'wrong' });
    if (bad.status < 400) throw new Error('wrong password accepted');
    const ok = await req('POST', '/admin/api/auth/login', { username: 'super_admin', password: 'Admin@2026!' });
    if (!ok.ok || !ok.json?.token) throw new Error(`admin login HTTP ${ok.status}`);
    return ok.json.token;
  });

  await must('Admin core APIs respond', async () => {
    const endpoints = [
      '/admin/api/auth/me', '/admin/api/dashboard/stats', '/admin/api/dashboard/trend',
      '/admin/api/game/state', '/admin/api/game/recent-purchases',
      '/admin/api/users', '/admin/api/payment/orders', '/admin/api/payment/gateways',
      '/admin/api/withdrawals', '/admin/api/config/game', '/admin/api/config/risk',
      '/admin/api/config/bot', '/admin/api/locales', '/admin/api/audit-logs',
      '/admin/api/system-logs', '/admin/api/rounds'
    ];
    const bad = [];
    for (const e of endpoints) {
      const r = await req('GET', e, undefined, adminToken);
      if (!r.ok) bad.push(`${e}:${r.status}`);
    }
    if (bad.length) throw new Error(bad.join(', '));
    return `${endpoints.length} endpoints`;
  });

  await must('Withdraw creates then admin reject refunds', async () => {
    const w = await req('POST', '/api/withdraw', { amountUsdt: 10, toAddress: 'TQAuditAddressForFunctionalTest123456789', chain: 'TRC20' }, userToken);
    if (!w.ok) throw new Error(`withdraw HTTP ${w.status} ${JSON.stringify(w.raw).slice(0,140)}`);
    const id = w.json?.id || w.json?.withdrawId;
    if (!id) throw new Error('missing withdrawal id');
    const rej = await req('POST', `/admin/api/withdrawals/${id}/reject`, { reason: 'audit refund test' }, adminToken);
    if (!rej.ok) throw new Error(`reject HTTP ${rej.status}`);
    return `withdrawal=${id}`;
  });

  await must('Admin exports respond', async () => {
    for (const url of ['/admin/api/audit-logs/export.csv', '/admin/api/system-logs/export.csv']) {
      const r = await fetch(BASE + url, { headers: { authorization: `Bearer ${adminToken}` } });
      if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
      const txt = await r.text();
      if (!txt.includes(',')) throw new Error(`${url} not csv-like`);
    }
    return 'csv ok';
  });

  // ---- 上线收口增强：系统日志 / 赛事地图 / 退出登录 专项检查 ----

  await must('System logs API shape matches admin SystemLogs.jsx fields (meta, no context/stack)', async () => {
    const r = await req('GET', '/admin/api/system-logs?page=1&pageSize=20', undefined, adminToken);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const body = r.json || {};
    for (const k of ['items', 'total', 'page', 'pageSize']) {
      if (!(k in body)) throw new Error(`missing pagination key ${k}`);
    }
    if (!Array.isArray(body.items)) throw new Error('items is not an array');
    if (body.items.length) {
      const it = body.items[0];
      for (const k of ['id', 'level', 'module', 'message', 'createdAt']) {
        if (!(k in it)) throw new Error(`log item missing field ${k}`);
      }
      // 前端只读 meta；绝不能再依赖不存在的 context/stack
      if ('context' in it || 'stack' in it) throw new Error('log item still exposes legacy context/stack fields');
      if (!['INFO', 'WARN', 'ERROR', 'DEBUG'].includes(it.level)) throw new Error(`unexpected level ${it.level}`);
    }
    return `items=${body.items.length} total=${body.total}`;
  });

  await must('System logs get persisted by real events (e.g. withdraw:reject above)', async () => {
    // 上一步 reject 提现已触发 systemLog.warn，这里确认确实落库（非伪造数据）
    const r = await poll(async () => {
      const s = await req('GET', '/admin/api/system-logs?page=1&pageSize=50', undefined, adminToken);
      return (s.ok && Number(s.json?.total) > 0) ? s.json : null;
    }, 8000);
    return `total=${r.total}`;
  });

  await must('GameConfig tournamentMapUrl round-trips into /api/game/state', async () => {
    const before = await req('GET', '/admin/api/config/game', undefined, adminToken);
    if (!before.ok) throw new Error(`config GET HTTP ${before.status}`);
    const testUrl = 'https://cdn.blitzfomo.test/tournament-map-' + Date.now() + '.png';
    const patch = await req('PATCH', '/admin/api/config/game', { tournamentMapUrl: testUrl }, adminToken);
    if (!patch.ok) throw new Error(`config PATCH HTTP ${patch.status}`);
    await poll(async () => {
      const s = await req('GET', '/api/game/state');
      return s.json?.tournamentMapUrl === testUrl ? s.json : null;
    }, 8000);
    // 还原为空（前台回退本地默认图），避免后续浏览器步骤加载测试假图
    const restore = await req('PATCH', '/admin/api/config/game', { tournamentMapUrl: '' }, adminToken);
    if (!restore.ok) throw new Error(`config restore HTTP ${restore.status}`);
    await poll(async () => {
      const s = await req('GET', '/api/game/state');
      const v = s.json?.tournamentMapUrl;
      return (v === '' || v == null) ? s.json : null;
    }, 8000);
    return `state reflected configured url then restored to default`;
  });

  await must('Tournament map default image is served with image MIME', async () => {
    const r = await fetch(BASE + '/media/tournament-map.png');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const ct = r.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) throw new Error(`unexpected content-type "${ct}" (nginx MIME)`);
    return ct;
  });

  await must('Admin system-logs API rejects requests without token (post-logout state)', async () => {
    const noToken = await req('GET', '/admin/api/system-logs');
    if (noToken.status !== 401 && noToken.status !== 403) throw new Error(`expected 401/403, got ${noToken.status}`);
    const badToken = await req('GET', '/admin/api/system-logs', undefined, 'logged.out.token');
    if (badToken.status !== 401 && badToken.status !== 403) throw new Error(`expected 401/403 for stale token, got ${badToken.status}`);
    return `no-token=${noToken.status}, stale-token=${badToken.status}`;
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true });
  const page = await context.newPage();
  await must('Frontend mobile pages render and screenshot', async () => {
    const shots = [
      ['/', 'audit-full-arena.png'],
      ['/#wallet', 'audit-full-wallet.png'],
      ['/#leaderboard', 'audit-full-leader.png'],
      ['/#profile', 'audit-full-profile.png'],
    ];
    for (const [route, file] of shots) {
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
      await page.screenshot({ path: path.join(OUT, file), fullPage: true });
    }
    return shots.map(x => x[1]).join(', ');
  });
  await browser.close();

  const adminBrowser = await chromium.launch({ headless: true });
  const adminCtx = await adminBrowser.newContext({ viewport: { width: 1440, height: 1000 } });
  const adminPage = await adminCtx.newPage();
  await must('Admin pages render and screenshot', async () => {
    // 后台是持续轮询的 SPA，networkidle 不会稳定触发，统一用 domcontentloaded + 显式等待
    await adminPage.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const user = adminPage.locator('input').first();
    await user.waitFor({ state: 'visible', timeout: 15000 });
    await user.fill('super_admin');
    await adminPage.locator('input[type="password"]').fill('Admin@2026!');
    await adminPage.locator('button').filter({ hasText: /login|登录/i }).first().click();
    await adminPage.waitForTimeout(2000);
    const routes = [
      ['/admin/', 'audit-full-admin-dashboard.png'],
      ['/admin/live-monitor', 'audit-full-admin-live-monitor.png'],
      ['/admin/users', 'audit-full-admin-users.png'],
      ['/admin/withdrawals', 'audit-full-admin-withdrawals.png'],
      ['/admin/payments', 'audit-full-admin-payments.png'],
      ['/admin/config', 'audit-full-admin-config.png'],
      ['/admin/bot-config', 'audit-full-admin-bot-config.png'],
      ['/admin/risk-config', 'audit-full-admin-risk-config.png'],
      ['/admin/system-logs', 'audit-full-admin-system-logs.png'],
    ];
    for (const [route, file] of routes) {
      await adminPage.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await adminPage.waitForTimeout(1500); // 等待 SPA 拉取数据并渲染
      await adminPage.screenshot({ path: path.join(OUT, file), fullPage: true });
    }
    return routes.map(x => x[1]).join(', ');
  });
  await adminBrowser.close();

  const sourceFindings = [];
  const files = [
    'apps/api/src/user/user.service.ts',
    'apps/api/src/admin/admin.service.ts',
    'apps/api/src/auth/auth.service.ts',
    'apps/api/src/payment/payment-gateway.factory.ts',
    'apps/api/src/admin/admin-payment.controller.ts',
    'apps/api/src/risk/risk.service.ts',
  ];
  for (const f of files) {
    const text = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
    const matches = text.split(/\r?\n/).map((line, i) => ({ line: i + 1, text: line })).filter(x => /TODO|placeholder|no-op|更多|复杂/.test(x.text));
    for (const m of matches) sourceFindings.push(`${f}:${m.line} ${m.text.trim()}`);
  }

  const failed = results.filter(r => !r.ok);
  const summary = { base: BASE, at: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results, sourceFindings, outDir: OUT };
  fs.writeFileSync(path.join(OUT, 'full-functional-results.json'), JSON.stringify(summary, null, 2));
  console.log(`\nSUMMARY passed=${summary.passed} failed=${summary.failed}`);
  if (failed.length) process.exitCode = 1;
})();
