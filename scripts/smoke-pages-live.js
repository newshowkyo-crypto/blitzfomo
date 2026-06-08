const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = 'https://blitzfomo.com';
const OUT_DIR = path.join(process.cwd(), 'audit-output', 'live-smoke');

function readEnv(file = '.env.production') {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

async function screenshot(page, name) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
}

async function main() {
  const env = readEnv();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const issues = [];
  const checks = [];

  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) issues.push(`console:${msg.type()}:${msg.text()}`);
  });
  page.on('pageerror', (err) => issues.push(`pageerror:${err.message}`));

  await page.goto(ROOT, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await screenshot(page, 'home-mobile');

  const homeText = await page.locator('body').innerText();
  checks.push(['home_has_road_title', /Road to Champion|冠军之路|World Cup Champion Path/.test(homeText)]);
  checks.push(['home_has_plisio_wallet_text', /Plisio|Gateway|支付网关/.test(homeText)]);
  checks.push(['home_has_no_service_fail', !/Service connection failed|服务连接失败|OFFLINE/.test(homeText)]);

  const status = await page.locator('#connection-status').count()
    ? (await page.locator('#connection-status').textContent() || '').trim()
    : 'missing';
  checks.push(['connection_status', status]);

  const walletNav = page.locator('[data-nav="wallet"], button:has-text("Wallet"), button:has-text("钱包"), a:has-text("Wallet"), a:has-text("钱包")').first();
  if (await walletNav.count()) {
    await walletNav.click().catch(() => {});
    await page.waitForTimeout(800);
  }
  await screenshot(page, 'wallet-mobile');
  const walletText = await page.locator('body').innerText();
  checks.push(['wallet_has_deposit', /Deposit|充值/.test(walletText)]);
  checks.push(['wallet_has_plisio', /Plisio/.test(walletText)]);

  const admin = await context.newPage();
  const adminIssues = [];
  admin.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) adminIssues.push(`admin-console:${msg.type()}:${msg.text()}`);
  });
  admin.on('pageerror', (err) => adminIssues.push(`admin-pageerror:${err.message}`));
  await admin.goto(`${ROOT}/admin/`, { waitUntil: 'networkidle' });
  await admin.locator('input').nth(0).fill(env.ADMIN_USERNAME || '');
  await admin.locator('input').nth(1).fill(env.ADMIN_PASSWORD || '');
  await admin.locator('button[type="submit"]').click();
  await admin.waitForTimeout(2000);
  await admin.goto(`${ROOT}/admin/payments`, { waitUntil: 'networkidle' });
  await admin.waitForTimeout(1500);
  await screenshot(admin, 'admin-payments-desktop');
  const adminText = await admin.locator('body').innerText();
  checks.push(['admin_login_and_payments_page', /订单管理|支付网关/.test(adminText)]);
  checks.push(['admin_payments_shows_plisio_active', /Plisio \(生产真实支付\)|Plisio/.test(adminText)]);
  checks.push(['admin_payments_no_stripe_fireblocks', !/stripe|fireblocks/i.test(adminText)]);
  issues.push(...adminIssues);

  await browser.close();

  const failed = checks.filter(([, ok]) => ok === false);
  console.log('Live page smoke checks:');
  for (const [name, value] of checks) console.log(`${name}: ${value}`);
  console.log(`screenshots: ${OUT_DIR}`);
  if (issues.length) {
    console.log('Browser issues:');
    for (const issue of issues) console.log(`- ${issue}`);
  }
  if (failed.length) {
    console.error(`Smoke failed: ${failed.map(([name]) => name).join(', ')}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
