const BASE_URL = 'http://localhost:3000';

async function adminLogin() {
  const res = await fetch(`${BASE_URL}/admin/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'super_admin', password: 'Admin@2026!' })
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: '登录失败' }));
    throw new Error(error.msg || error.message);
  }
  const data = await res.json();
  console.log('   Token获取:', data.token ? '成功' : '失败');
  return data.token;
}

async function testAdminApi(token, endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);
  
  const res = await fetch(`${BASE_URL}${endpoint}`, options);
  return {
    ok: res.ok,
    status: res.status,
    body: res.ok ? await res.json() : null,
    error: !res.ok ? await res.text() : null
  };
}

async function main() {
  console.log('=== 🔧 后台管理功能测试 ===\n');
  
  let token;
  try {
    console.log('[1] 管理员登录...');
    token = await adminLogin();
    console.log('   ✅ 登录成功');
  } catch (e) {
    console.log('   ❌ 登录失败:', e.message);
    return;
  }

  const tests = [
    { name: '仪表盘统计', endpoint: '/admin/api/dashboard/stats' },
    { name: '游戏状态', endpoint: '/admin/api/game/state' },
    { name: '用户列表', endpoint: '/admin/api/users?page=1&pageSize=5' },
    { name: '提现列表', endpoint: '/admin/api/withdrawals' },
    { name: '支付订单', endpoint: '/admin/api/payment/orders' },
    { name: '支付网关', endpoint: '/admin/api/payment/gateways' },
    { name: '风控配置', endpoint: '/admin/api/config/risk' },
    { name: '游戏配置', endpoint: '/admin/api/config/game' },
    { name: '机器人配置', endpoint: '/admin/api/config/bot' },
    { name: 'Road 总览', endpoint: '/admin/api/road/overview' },
    { name: 'Road 球队', endpoint: '/admin/api/road/teams' },
    { name: 'Road 池子', endpoint: '/admin/api/road/pools' },
    { name: 'Road 财务', endpoint: '/admin/api/road/treasury/buckets' },
    { name: 'Road KOL', endpoint: '/admin/api/road/kol/summary' },
    { name: '轮次列表', endpoint: '/admin/api/rounds?page=1&pageSize=5' },
    { name: '审计日志', endpoint: '/admin/api/audit-logs?page=1&pageSize=5' },
  ];

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`\n[${i + 2}] ${test.name}...`);
    try {
      const result = await testAdminApi(token, test.endpoint);
      if (result.ok) {
        console.log(`   ✅ 成功`);
        passed++;
      } else {
        console.log(`   ❌ 失败 (${result.status}): ${result.error?.slice(0, 50) || '未知错误'}`);
        failed++;
      }
    } catch (e) {
      console.log(`   ❌ 异常: ${e.message}`);
      failed++;
    }
  }

  console.log('\n=== 📊 测试结果 ===');
  console.log(`通过: ${passed} / ${tests.length}`);
  console.log(`失败: ${failed} / ${tests.length}`);

  if (failed === 0) {
    console.log('\n🎉 后台管理功能全部通过！');
  } else {
    console.log('\n⚠️ 部分功能需要检查');
  }
}

main().catch(console.error);
