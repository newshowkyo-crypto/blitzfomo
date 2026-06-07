const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(process.cwd(), 'audit-output');
const B = process.env.AUDIT_BASE || 'http://localhost:8081';
async function waitForApiReady(timeout = 45000) {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(B + '/api/health');
      if (res.ok) return;
      last = `HTTP ${res.status}`;
    } catch (e) {
      last = e.message;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`API not ready after ${timeout}ms: ${last}`);
}
(async () => {
  await waitForApiReady();

  const browser = await chromium.launch({ headless: true });

  // 1) Admin logged-out must show login form (no token)
  const a = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const ap = await a.newPage();
  await ap.goto(B + '/admin/', { waitUntil: 'domcontentloaded' });
  await ap.waitForTimeout(1500);
  const hasPwd = await ap.locator('input[type="password"]').count();
  const hasLoginBtn = await ap.locator('button', { hasText: /登录|login/i }).count();
  await ap.screenshot({ path: path.join(OUT, 'verify-admin-login.png'), fullPage: true });
  console.log(`ADMIN_LOGIN_VISIBLE password_inputs=${hasPwd} login_buttons=${hasLoginBtn}`);

  // 2) Player profile tab: Admin entry must be hidden by default
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const p = await c.newPage();
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  await p.locator('button[data-tab="profile"]').click();
  await p.waitForTimeout(800);
  const adminVisibleDefault = await p.locator('#admin-entry').isVisible();
  await p.screenshot({ path: path.join(OUT, 'verify-player-profile-default.png'), fullPage: true });
  console.log(`PLAYER_ADMIN_ENTRY_VISIBLE_DEFAULT=${adminVisibleDefault}`);

  // 2b) With ADMIN_DEBUG enabled it should appear
  await p.evaluate(() => localStorage.setItem('bf_admin_debug', 'true'));
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  await p.locator('button[data-tab="profile"]').click();
  await p.waitForTimeout(600);
  const adminVisibleDebug = await p.locator('#admin-entry').isVisible();
  console.log(`PLAYER_ADMIN_ENTRY_VISIBLE_DEBUG=${adminVisibleDebug}`);

  // 3) Bracket/tournament map page renders an image with real dimensions
  await p.evaluate(() => localStorage.removeItem('bf_admin_debug'));
  await p.locator('button[data-tab="profile"]').click();
  await p.waitForTimeout(400);
  await p.locator('button[data-go="bracket"]').click();
  await p.waitForTimeout(1200);
  const mapInfo = await p.$eval('#bracket-img', el => ({ src: el.getAttribute('src'), w: el.naturalWidth, h: el.naturalHeight }));
  await p.screenshot({ path: path.join(OUT, 'verify-player-bracket.png'), fullPage: true });
  console.log(`PLAYER_MAP src=${mapInfo.src} naturalWidth=${mapInfo.w} naturalHeight=${mapInfo.h}`);

  // 4) System logs API: shape backed by real events (meta field, no legacy context/stack)
  async function apiGet(url, token) {
    const r = await fetch(B + url, { headers: token ? { authorization: 'Bearer ' + token } : {} });
    let j = null; try { j = await r.json(); } catch {}
    const body = j && typeof j === 'object' && 'data' in j ? j.data : j;
    return { status: r.status, ok: r.ok, body };
  }
  let adminTok = '';
  try {
    const lr = await fetch(B + '/admin/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'super_admin', password: 'Admin@2026!' }),
    });
    const lj = await lr.json();
    adminTok = (lj && (lj.token || (lj.data && lj.data.token))) || '';
  } catch {}
  const sl = await apiGet('/admin/api/system-logs?page=1&pageSize=10', adminTok);
  const item = (sl.body && sl.body.items && sl.body.items[0]) || null;
  const legacy = item ? (('context' in item) || ('stack' in item)) : false;
  console.log(`SYSTEM_LOGS status=${sl.status} total=${sl.body && sl.body.total} sample_has_meta=${item ? ('meta' in item) : 'n/a'} legacy_context_stack=${legacy}`);
  const noTok = await apiGet('/admin/api/system-logs');
  console.log(`ADMIN_SYSTEM_LOGS_NO_TOKEN_STATUS=${noTok.status}`);

  await browser.close();
})();
