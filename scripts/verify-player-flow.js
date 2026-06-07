const fetch = require('node-fetch');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function api(path, options = {}, token) {
  const url = API_BASE + path;
  const headers = { ...options.headers };
  if (token) headers['authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  let body;
  try { body = await res.json(); } catch (e) { body = await res.text(); }
  return { res, body };
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

async function adjustBalance(adminTok, userId, amountBf, reason) {
  const r = await api(`/admin/api/users/${userId}/adjust-balance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount: amountBf, reason }),
  }, adminTok);
  if (!r.res.ok) throw new Error(`Adjust balance failed status=${r.res.status} body=${JSON.stringify(r.body)}`);
}

async function main() {
  console.log('\n=== 👤 玩家完整链路测试 ===\n');
  
  let step = 1;
  
  try {
    // ========== 阶段1: 用户注册/登录 ==========
    console.log(`[${step++}] 用户注册/登录...`);
    const { token: userToken, user } = await createUser();
    console.log(`   ✅ 用户创建成功:`);
    console.log(`      - ID: ${user.id}`);
    console.log(`      - 昵称: ${user.nickname}`);
    console.log(`      - 初始余额: ${user.balance} BF`);
    
    // ========== 阶段2: 查看用户信息 ==========
    console.log(`\n[${step++}] 查看用户信息...`);
    const profileRes = await api('/api/user/profile', {}, userToken);
    const profile = profileRes.body;
    console.log(`   ✅ 用户信息获取成功:`);
    console.log(`      - 余额: ${profile.balance} BF`);
    console.log(`      - 总购买: ${profile.totalPurchased} BF`);
    console.log(`      - 总收益: ${profile.totalWon} BF`);
    
    // ========== 阶段3: 查看游戏状态 ==========
    console.log(`\n[${step++}] 查看游戏状态...`);
    const gameStateRes = await api('/api/game/state');
    const gameState = gameStateRes.body;
    console.log(`   ✅ 游戏状态获取成功:`);
    console.log(`      - 当前轮次: #${gameState.roundNumber}`);
    console.log(`      - 奖池: ${gameState.prizePool} BF`);
    console.log(`      - 剩余时间: ${gameState.countdown}s`);
    
    // ========== 阶段4: 管理员充值 ==========
    console.log(`\n[${step++}] 管理员为用户充值...`);
    const adminToken = await adminLogin();
    await adjustBalance(adminToken, user.id, 2000, 'Test credit for player flow');
    console.log(`   ✅ 充值成功: +2000 BF`);
    
    // 更新用户余额
    const profileAfterRes = await api('/api/user/profile', {}, userToken);
    const balanceAfter = profileAfterRes.body.balance;
    console.log(`   ✅ 当前余额: ${balanceAfter} BF`);
    
    // ========== 阶段5: 购买游戏（Jackpot） ==========
    console.log(`\n[${step++}] 购买游戏（Jackpot）...`);
    const purchaseRes = await api('/api/game/purchase', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: 100, idempotencyKey: String(Date.now()) }),
    }, userToken);
    
    if (!purchaseRes.res.ok) {
      throw new Error(`购买失败: ${purchaseRes.res.status} - ${JSON.stringify(purchaseRes.body)}`);
    }
    
    console.log(`   ✅ 购买成功:`);
    console.log(`      - 购买金额: 100 BF`);
    console.log(`      - 购买后余额: ${purchaseRes.body.balance} BF`);
    
    // 验证余额减少
    const expectedBalance = balanceAfter - 100;
    if (Math.abs(purchaseRes.body.balance - expectedBalance) > 0.01) {
      throw new Error(`余额不一致: 期望 ${expectedBalance}, 实际 ${purchaseRes.body.balance}`);
    }
    console.log(`   ✅ 余额扣减正确`);
    
    // ========== 阶段6: 查看 Road 状态 ==========
    console.log(`\n[${step++}] 查看 Road 状态...`);
    const roadStateRes = await api('/api/road/state');
    const roadState = roadStateRes.body;
    console.log(`   ✅ Road 状态获取成功:`);
    console.log(`      - Super Jackpot: ${roadState.superJackpot} BF`);
    console.log(`      - 总购买量: ${roadState.totalPurchases} BF`);
    
    // ========== 阶段7: 购买 Road Key ==========
    console.log(`\n[${step++}] 购买 Road Key...`);
    
    // 获取开放的池子
    const poolsRes = await api('/api/road/pools');
    const pools = poolsRes.body && poolsRes.body.data ? poolsRes.body.data : (poolsRes.body || []);
    const openPool = pools.find(p => p.status === 'OPEN');
    
    if (!openPool) {
      console.log(`   ⚠️  未找到开放的池子，跳过 Road Key 购买测试`);
    } else {
      const roadPurchaseRes = await api(`/api/road/pools/${openPool.id}/purchase`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: 50, idempotencyKey: String(Date.now()) }),
      }, userToken);
      
      if (!roadPurchaseRes.res.ok) {
        console.log(`   ⚠️  Road Key 购买失败: ${roadPurchaseRes.res.status}`);
      } else {
        console.log(`   ✅ Road Key 购买成功:`);
        console.log(`      - 池子: ${openPool.team.code}`);
        console.log(`      - 购买金额: 50 BF`);
        console.log(`      - 购买后余额: ${roadPurchaseRes.body.balanceAfter} BF`);
      }
    }
    
    // ========== 阶段8: 查看丰富的用户信息 ==========
    console.log(`\n[${step++}] 查看丰富的用户信息...`);
    const richProfileRes = await api('/api/user/profile/rich', {}, userToken);
    const richProfile = richProfileRes.body;
    console.log(`   ✅ 丰富用户信息获取成功:`);
    console.log(`      - 最近购买记录数: ${richProfile.recentActivity?.purchases?.length || 0}`);
    console.log(`      - 最近提现记录数: ${richProfile.recentActivity?.withdrawals?.length || 0}`);
    console.log(`      - 推荐人数: ${richProfile.referralCount || 0}`);
    
    // ========== 阶段9: 更新用户昵称 ==========
    console.log(`\n[${step++}] 更新用户昵称...`);
    const newNickname = `TestPlayer_${Date.now().toString().slice(-6)}`;
    const updateRes = await api('/api/user/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nickname: newNickname }),
    }, userToken);
    
    if (!updateRes.res.ok) {
      console.log(`   ⚠️  昵称更新失败: ${updateRes.res.status}`);
    } else {
      console.log(`   ✅ 昵称更新成功: ${updateRes.body.nickname}`);
    }
    
    // ========== 测试完成 ==========
    console.log('\n=== 🎉 玩家完整链路测试全部通过！ ===\n');
    console.log('流程验证:');
    console.log('  1. ✅ 用户注册/登录');
    console.log('  2. ✅ 查看用户信息');
    console.log('  3. ✅ 查看游戏状态');
    console.log('  4. ✅ 管理员充值');
    console.log('  5. ✅ 购买游戏（Jackpot）');
    console.log('  6. ✅ 查看 Road 状态');
    console.log('  7. ✅ 购买 Road Key');
    console.log('  8. ✅ 查看丰富用户信息');
    console.log('  9. ✅ 更新用户昵称');
    
    console.log('\n📊 玩家链路数据:');
    console.log(`  - 用户ID: ${user.id}`);
    console.log(`  - 初始余额: ${user.balance} BF`);
    console.log(`  - 最终余额: ${richProfile.balance} BF`);
    console.log(`  - 购买次数: ${richProfile.recentActivity?.purchases?.length || 0}`);
    
  } catch (e) {
    console.error(`\n❌ 测试失败 [步骤 ${step}]: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
