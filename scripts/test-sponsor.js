
const API_BASE = 'http://localhost:8081';

async function fetchApi(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { res, body };
}

async function main() {
  console.log('=== Testing sponsor ===');
  
  // Login admin
  const loginRes = await fetchApi('/admin/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'super_admin', password: 'Admin@2026!' }),
  });
  console.log('Login res:', loginRes.res.status, loginRes.body);
  const adminToken = loginRes.body.token;
  
  // Set global budget
  const setBudgetRes = await fetchApi('/admin/api/road/sponsor/budget', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ totalBudget: 500000, status: 'ACTIVE' }),
  });
  console.log('Set budget res:', setBudgetRes.res.status, setBudgetRes.body);
  
  // Create test team
  const teamRes = await fetchApi('/admin/api/road/teams', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ code: 'TEST' + Date.now(), name: 'Test Team', strengthFactor: '1.0', status: 'ACTIVE', currentStage: 'GROUP' }),
  });
  console.log('Create team res:', teamRes.res.status, teamRes.body);
  const team = teamRes.body.data || teamRes.body;
  
  // Create pool
  const now = Date.now();
  const poolRes = await fetchApi('/admin/api/road/pools', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      teamId: team.id,
      stage: 'GROUP',
      status: 'OPEN',
      basePrice: 100,
      currentPrice: 100,
      openAt: new Date(now - 60000).toISOString(),
      closeAt: new Date(now + 3600000).toISOString(),
      sponsorBudgetLimit: 1000000,
    }),
  });
  console.log('Create pool res:', poolRes.res.status, poolRes.body);
  const pool = poolRes.body.data || poolRes.body;
  
  // Now sponsor
  const ref = 'test-ref-' + now;
  const sponsorRes = await fetchApi(`/admin/api/road/pools/${pool.id}/sponsor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ amount: 100000, reference: ref }),
  });
  console.log('Sponsor res:', sponsorRes.res.status, sponsorRes.body);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
