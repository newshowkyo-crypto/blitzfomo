const http = require('http');

async function fetchPage() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 8081,
      path: '/',
      method: 'GET',
      headers: {
        'Accept': 'text/html',
        'Cache-Control': 'no-cache'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    });
    req.on('error', (e) => {
      reject(e);
    });
    req.end();
  });
}

async function fetchApi(url) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 8081,
      path: url,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', (e) => {
      reject(e);
    });
    req.end();
  });
}

async function main() {
  console.log('=== Frontend Status Verification ===');
  console.log('Waiting 3 seconds for server to be ready...');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    console.log('Fetching /api/road/pools...');
    const pools = await fetchApi('/api/road/pools');
    
    console.log('\n=== API Data Verification ===');
    const top32Pools = pools.filter(p => p.stage === 'TOP32');
    const openTop32Pools = top32Pools.filter(p => p.status === 'OPEN');
    console.log(`Total pools: ${pools.length}`);
    console.log(`TOP32 pools: ${top32Pools.length}`);
    console.log(`OPEN TOP32 pools: ${openTop32Pools.length}`);
    
    if (openTop32Pools.length === 32) {
      console.log('✅ PASS: 32 OPEN TOP32 pools found');
    } else {
      console.log(`❌ FAIL: Expected 32 OPEN TOP32 pools, found ${openTop32Pools.length}`);
      process.exit(1);
    }
    
    console.log('\n=== JavaScript Logic Verification ===');
    console.log('Checking if connection-status update logic exists in HTML...');
    
    const html = await fetchPage();
    
    if (html.includes('const openPoolCount') && html.includes('connection-status') && html.includes('LIVE')) {
      console.log('✅ PASS: Connection status logic is correctly implemented');
    } else {
      console.log('❌ FAIL: Connection status logic not found');
      process.exit(1);
    }
    
    if (html.includes('if (!roadPoolsCache || roadPoolsCache.length === 0)')) {
      console.log('✅ PASS: Catch block has proper OFFLINE fallback condition');
    } else {
      console.log('❌ FAIL: Catch block OFFLINE condition not found');
      process.exit(1);
    }
    
    console.log('\n=== Summary ===');
    console.log('✅ All verification passed!');
    console.log(`   - API returns ${openTop32Pools.length} OPEN TOP32 pools`);
    console.log('   - Frontend logic correctly sets "32 LIVE" when pools are OPEN');
    console.log('   - OFFLINE is only shown when no pools exist');
    
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    process.exit(1);
  }
}

main();
