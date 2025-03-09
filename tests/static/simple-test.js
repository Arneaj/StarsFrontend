// Simple test framework that can run in the browser

// Simple assertion functions
function assert(condition, message) {
  if (!condition) {
    console.error(`ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✓ ${message}`);
  return true;
}

function assertEqual(actual, expected, message) {
  return assert(actual === expected, `${message}: expected ${expected}, got ${actual}`);
}

function assertDeepEqual(actual, expected, message) {
  return assert(JSON.stringify(actual) === JSON.stringify(expected), 
    `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// Test runner
async function runTests(tests) {
  console.log("Running tests...");
  let passed = 0;
  let failed = 0;
  
  for (const [name, testFn] of Object.entries(tests)) {
    try {
      console.log(`\nTest: ${name}`);
      await testFn();
      console.log(`✅ Test passed: ${name}`);
      passed++;
    } catch (error) {
      console.error(`❌ Test failed: ${name}`);
      console.error(error);
      failed++;
    }
  }
  
  console.log(`\n--------------------`);
  console.log(`Tests completed: ${passed + failed} tests`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  return { passed, failed };
}

// Export the test utilities
window.TestUtils = {
  assert,
  assertEqual,
  assertDeepEqual,
  runTests
}; 