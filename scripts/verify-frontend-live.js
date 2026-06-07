const { chromium } = require('playwright');

async function main() {
  console.log('=== Frontend Live Verification ===');
  console.log('Opening browser to verify "32 LIVE" status...');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:8081');
    console.log('Page loaded, waiting 3 seconds...');
    await page.waitForTimeout(3000);
    
    console.log('Checking connection-status element...');
    const statusElement = await page.$('#connection-status');
    
    if (!statusElement) {
      console.log('❌ FAIL: connection-status element not found');
      process.exit(1);
    }
    
    const statusText = await statusElement.textContent();
    console.log(`Current status: "${statusText}"`);
    
    if (statusText === '32 LIVE') {
      console.log('✅ PASS: Page shows "32 LIVE"');
    } else {
      console.log('❌ FAIL: Expected "32 LIVE", got "' + statusText + '"');
      process.exit(1);
    }
    
    console.log('\n=== Summary ===');
    console.log('✅ Browser verification passed!');
    console.log('   - Page displays "32 LIVE" correctly');
    
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
