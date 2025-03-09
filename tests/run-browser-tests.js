const puppeteer = require('puppeteer');
const path = require('path');

// Get the absolute path to the test HTML file
const testPath = path.resolve(__dirname, './static/browser-tests.html');
const testUrl = `file://${testPath}`;

async function runTests() {
  console.log('Starting browser tests using Puppeteer...');
  console.log(`Loading tests from: ${testUrl}`);

  // Launch a headless browser with enhanced options
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security'
    ],
    ignoreHTTPSErrors: true,
    timeout: 60000 // Increase timeout to 60 seconds
  });
  
  const page = await browser.newPage();
  
  // Setup console logging from the browser to Node.js console
  page.on('console', message => {
    const type = message.type();
    const text = message.text();
    
    if (type === 'error') {
      console.error(`Browser console error: ${text}`);
    } else if (text.includes('Test passed:') || text.includes('✅') || text.includes('✓')) {
      console.log(`\x1b[32m${text}\x1b[0m`); // Green text
    } else if (text.includes('Test failed:') || text.includes('❌')) {
      console.log(`\x1b[31m${text}\x1b[0m`); // Red text
    } else {
      console.log(`Browser console: ${text}`);
    }
  });

  try {
    // Navigate to the test file
    await page.goto(testUrl, { waitUntil: 'networkidle0' });
    
    // Wait for tests to be completed
    await page.waitForFunction(
      'document.querySelector("#log").textContent.includes("completed") || document.querySelector("#log").textContent.includes("Failed:")',
      { timeout: 30000 }
    );
    
    // Check if any tests failed
    const testResults = await page.evaluate(() => {
      const log = document.querySelector('#log').textContent;
      const failedMatch = log.match(/Failed: (\d+)/);
      const failedCount = failedMatch ? parseInt(failedMatch[1]) : 0;
      
      const passedMatch = log.match(/Passed: (\d+)/);
      const passedCount = passedMatch ? parseInt(passedMatch[1]) : 0;
      
      return { 
        failed: failedCount,
        passed: passedCount,
        text: log
      };
    });
    
    console.log('\n----------------------');
    console.log(`Tests completed: ${testResults.passed + testResults.failed} tests`);
    console.log(`Passed: ${testResults.passed}`);
    console.log(`Failed: ${testResults.failed}`);
    
    if (testResults.failed > 0) {
      console.error('\nSome tests have failed!');
      process.exit(1); // Exit with error code
    } else {
      console.log('\nAll tests passed successfully!');
    }
  } catch (error) {
    console.error('Error running tests:', error);
    process.exit(1); // Exit with error code
  } finally {
    await browser.close();
  }
}

// Run the tests
runTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
}); 