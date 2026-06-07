const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('=== Frontend Status Verification ===');
    console.log('Opening http://localhost:8081...');
    
    await page.goto('http://localhost:8081');
    
    console.log('Waiting 3 seconds for page to load...');
    await page.waitForTimeout(3000);
    
    const pageContent = await page.content();
    
    console.log('\n=== Verification Results ===');
    
    if (pageContent.includes('32 LIVE')) {
      console.log('✅ PASS: Page contains "32 LIVE"');
    } else {
      console.log('❌ FAIL: Page does NOT contain "32 LIVE"');
      console.log('Looking for connection-status element...');
      const statusElement = await page.$('#connection-status');
      if (statusElement) {
        const statusText = await statusElement.textContent();
        console.log(`Current status text: "${statusText}"`);
      }
      process.exit(1);
    }
    
    if (!pageContent.includes('阶段池状态') || !pageContent.includes('OFFLINE')) {
      console.log('✅ PASS: Page does NOT contain "阶段池状态 OFFLINE"');
    } else {
      console.log('❌ FAIL: Page contains "阶段池状态 OFFLINE"');
      process.exit(1);
    }
    
    console.log('\n=== Summary ===');
    console.log('✅ All frontend status verification passed!');
    
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
