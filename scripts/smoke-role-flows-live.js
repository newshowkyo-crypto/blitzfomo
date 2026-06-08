const fs = require('fs');
const crypto = require('crypto');
const { chromium } = require('playwright');

const ROOT = 'https://blitzfomo.com';

function readEnv(file = '.env.production') {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

function makeTelegramInitData(botToken, user) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: `role-smoke-${Date.now()}`,
    user: JSON.stringify(user),
  });
  const dataCheckString = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

async function api(path, options = {}) {
  const res = await fetch(`${ROOT}${path}`, options);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { res, body };
}

async function loginTelegram(env) {
  const initData = makeTelegramInitData(env.BOT_TOKEN, {
    id: 880000002,
    first_name: 'Role',
    last_name: 'Smoke',
    username: 'role_smoke',
  });
  const { res, body } = await api('/api/auth/telegram', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ initData }),
  });
  if (!res.ok || !body.token) throw new Error(`Telegram login failed: ${res.status} ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  const env = readEnv();
  const login = await loginTelegram(env);
  const checks = [];
  const issues = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await context.addInitScript((token) => localStorage.setItem('bf_token', token), login.token);
  const page = await context.newPage();
  page.on('console', (msg) => { if (['error', 'warning'].includes(msg.type())) issues.push(`${msg.type()}: ${msg.text()}`); });
  page.on('pageerror', (err) => issues.push(`pageerror: ${err.message}`));

  await page.goto(ROOT, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  checks.push(['player_loaded_logged_in', await page.locator('#header-balance').innerText().then((t) => /BF/.test(t)).catch(() => false)]);
  checks.push(['player_connection_live', await page.locator('#connection-status').innerText().then((t) => /LIVE/.test(t)).catch(() => false)]);

  const buyButton = page.locator('button[data-road-buy]').first();
  await buyButton.click();
  await page.waitForTimeout(500);
  checks.push(['player_buy_modal_opens', await page.locator('#road-modal').evaluate((el) => getComputedStyle(el).display !== 'none').catch(() => false)]);
  await page.locator('#road-modal-close').click().catch(() => {});

  await page.locator('[data-tab="wallet"]').click();
  await page.waitForTimeout(700);
  await page.locator('#recharge-amount').fill('10');
  await page.locator('#recharge-button').click();
  await page.waitForTimeout(4000);
  checks.push(['player_deposit_order_box_shows', await page.locator('#payment-box').evaluate((el) => el.classList.contains('show')).catch(() => false)]);
  checks.push(['player_deposit_gateway_plisio', await page.locator('#payment-gateway').innerText().then((t) => /plisio/i.test(t)).catch(() => false)]);
  checks.push(['player_payment_order_id_present', await page.locator('#payment-order-id').innerText().then((t) => t && t !== '-').catch(() => false)]);

  await page.locator('[data-tab="refer"]').click();
  await page.waitForTimeout(700);
  checks.push(['agent_ref_link_real_user', await page.locator('#ref-link').innerText().then((t) => /\/ref\//.test(t) && !/demo/.test(t)).catch(() => false)]);
  checks.push(['agent_qr_src_present', await page.locator('#invite-qr').getAttribute('src').then((src) => !!src && src.includes('qr')).catch(() => false)]);

  const admin = await context.newPage();
  await admin.goto(`${ROOT}/admin/`, { waitUntil: 'domcontentloaded' });
  await admin.locator('input').nth(0).fill(env.ADMIN_USERNAME || '');
  await admin.locator('input').nth(1).fill(env.ADMIN_PASSWORD || '');
  await admin.locator('button[type="submit"]').click();
  await admin.waitForTimeout(1500);
  await admin.goto(`${ROOT}/admin/payments`, { waitUntil: 'domcontentloaded' });
  await admin.waitForTimeout(1500);
  const adminText = await admin.locator('body').innerText();
  checks.push(['house_admin_payments_plisio', /Plisio \(生产真实支付\)|Plisio/.test(adminText)]);
  checks.push(['house_admin_no_unimplemented_gateways', !/stripe|fireblocks/i.test(adminText)]);
  checks.push(['house_admin_emergency_mock_labeled', /应急切 Mock/.test(adminText)]);

  await browser.close();

  console.log('Role flow smoke checks:');
  for (const [name, value] of checks) console.log(`${name}: ${value}`);
  if (issues.length) {
    console.log('Browser issues:');
    for (const issue of issues) console.log(`- ${issue}`);
  }
  const failed = checks.filter(([, value]) => value !== true);
  if (failed.length || issues.some((item) => /ReferenceError|TypeError|pageerror/i.test(item))) {
    console.error(`Role smoke failed: ${failed.map(([name]) => name).join(', ')}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
