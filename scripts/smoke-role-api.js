const fs = require('fs');
const crypto = require('crypto');

const ROOT = process.env.SMOKE_BASE_URL || 'https://blitzfomo.com';

function readEnv(file = '.env.production') {
  const env = {
    ADMIN_USERNAME: process.env.ADMIN_USERNAME || '',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
    BOT_TOKEN: process.env.BOT_TOKEN || '',
  };
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !env[match[1]]) env[match[1]] = match[2];
  }
  return env;
}

function makeTelegramInitData(botToken, user) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: `api-smoke-${Date.now()}`,
    user: JSON.stringify(user),
  });
  const dataCheckString = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

async function parseJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${ROOT}${path}`, options);
  const body = await parseJson(res);
  return { res, body };
}

async function main() {
  const env = readEnv();
  const results = [];

  const adminLogin = await request('/admin/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD }),
  });
  if (!adminLogin.body.token) throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.body)}`);
  const adminHeaders = { authorization: `Bearer ${adminLogin.body.token}` };
  results.push(['admin_login', true, `status=${adminLogin.res.status}`]);

  const gateways = await request('/admin/api/payment/gateways', { headers: adminHeaders });
  results.push(['admin_gateway_active', gateways.body.active === 'plisio', `active=${gateways.body.active}`]);

  const reconcile = await request('/admin/api/road/treasury/reconcile', { headers: adminHeaders });
  results.push(['admin_reconcile_ok', reconcile.body.ok === true, `ok=${reconcile.body.ok}`]);

  const topup = async (userId, amount, reason) => {
    const res = await request(`/admin/api/users/${userId}/adjust-balance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...adminHeaders },
      body: JSON.stringify({ amount, reason }),
    });
    return res;
  };

  const tgLogin = await request('/api/auth/telegram', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      initData: makeTelegramInitData(env.BOT_TOKEN, {
        id: 880000004,
        first_name: 'Api',
        last_name: 'Smoke',
        username: 'api_smoke',
      }),
    }),
  });
  if (!tgLogin.body.token) throw new Error(`Telegram login failed: ${JSON.stringify(tgLogin.body)}`);
  const userHeaders = { authorization: `Bearer ${tgLogin.body.token}` };
  results.push(['player_login', true, `status=${tgLogin.res.status}`]);

  const topup1 = await topup(tgLogin.body.user.id, 50, 'smoke player funding');
  results.push(['admin_topup_player1', typeof topup1.body?.newBalance !== 'undefined', JSON.stringify(topup1.body)]);

  const profile = await request('/api/user/profile', { headers: userHeaders });
  results.push(['player_profile', !!profile.body.id, `balance=${profile.body.balance}`]);

  const rich = await request('/api/user/profile/rich', { headers: userHeaders });
  results.push(['agent_referral_code', !!rich.body.referralCode, `referralCode=${rich.body.referralCode || 'none'}`]);
  results.push(['agent_referral_stats', typeof rich.body.referralCount === 'number', `count=${rich.body.referralCount}, commission=${rich.body.referralCommission}`]);

  const tgLogin2 = await request('/api/auth/telegram', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      initData: makeTelegramInitData(env.BOT_TOKEN, {
        id: 880000005,
        first_name: 'Referral',
        last_name: 'Buyer',
        username: 'ref_buyer',
      }),
    }),
  });
  if (!tgLogin2.body.token) throw new Error(`Second Telegram login failed: ${JSON.stringify(tgLogin2.body)}`);
  const user2Headers = { authorization: `Bearer ${tgLogin2.body.token}` };
  const topup2 = await topup(tgLogin2.body.user.id, 50, 'smoke referral buyer funding');
  results.push(['admin_topup_player2', typeof topup2.body?.newBalance !== 'undefined', JSON.stringify(topup2.body)]);

  const pools = await request('/api/road/pools');
  const openPool = Array.isArray(pools.body) ? pools.body.find((p) => p.status === 'OPEN') : null;
  results.push(['road_open_pool', !!openPool, openPool ? `${openPool.team.code}.${openPool.stage}` : 'none']);

  if (openPool) {
    const buy = await request(`/api/road/pools/${openPool.id}/purchase`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...userHeaders },
      body: JSON.stringify({
        amount: 10,
        idempotencyKey: `api-smoke-buy-${Date.now()}`,
        referralCode: rich.body.referralCode,
      }),
    });
    const buyOk = !!buy.body.success || !!buy.body.purchaseId;
    results.push(['player_road_purchase', buyOk, buyOk ? `purchaseId=${buy.body.purchaseId || 'ok'}` : JSON.stringify(buy.body)]);

    const referredBuy = await request(`/api/road/pools/${openPool.id}/purchase`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...user2Headers },
      body: JSON.stringify({
        amount: 10,
        idempotencyKey: `api-smoke-ref-${Date.now()}`,
        referralCode: rich.body.referralCode,
      }),
    });
    const referredBuyOk = !!referredBuy.body.success || !!referredBuy.body.purchaseId;
    results.push(['referred_player_road_purchase', referredBuyOk, referredBuyOk ? `purchaseId=${referredBuy.body.purchaseId || 'ok'}` : JSON.stringify(referredBuy.body)]);
  }

  const payment = await request('/api/payment/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...userHeaders },
    body: JSON.stringify({ amountUsdt: 10, psysCid: 'USDT_TRX' }),
  });
  const paymentOk = payment.body.gateway === 'plisio' && !!payment.body.payUrl;
  results.push(['player_plisio_order', paymentOk, paymentOk ? payment.body.payUrl.slice(0, 60) : JSON.stringify(payment.body)]);

  const commissions = await request('/admin/api/road/kol/commissions?limit=5', { headers: adminHeaders });
  const commissionRow = Array.isArray(commissions.body)
    ? commissions.body.find((row) => row.referralCode === rich.body.referralCode && row.referredUserId === tgLogin2.body.user.id)
    : null;
  results.push(['agent_commission_created', !!commissionRow, commissionRow ? `amount=${commissionRow.commissionAmount}` : JSON.stringify(commissions.body)]);

  const withdraw = await request('/api/withdraw', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...userHeaders },
    body: JSON.stringify({ amountUsdt: 10, toAddress: 'TON_SMOKE_WALLET_001', chain: 'TON' }),
  });
  const withdrawOk = !!withdraw.body.withdrawId || !!withdraw.body.status;
  results.push(['player_withdraw_request', withdrawOk, withdrawOk ? `status=${withdraw.body.status}` : JSON.stringify(withdraw.body)]);

  for (const [name, ok, detail] of results) {
    console.log(`${name}: ${ok} | ${detail}`);
  }

  const failed = results.filter(([, ok]) => !ok);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
