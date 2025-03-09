# Browser-Based Tests for Static Files

This directory contains simple browser-based tests for the JavaScript files in the `static` folder.

## Running the Tests

There are two ways to run the tests:

### 1. Using the test runner HTML page

1. Open `browser-tests.html` in a web browser.
2. The tests will run automatically when the page loads.
3. You can also click the buttons to run specific test suites or all tests.

### 2. Using individual test files

Each JavaScript module has its own test file:
- `music-simple.test.js` - Tests for music.js
- And other test files are incorporated into the main test runner

## How the Tests Work

These tests use a simple testing framework defined in `simple-test.js` that provides basic assertion functions and test running capabilities. The tests create simulated versions of the modules being tested to avoid actual side effects (like playing audio).

## Test Structure

- `simple-test.js` - The lightweight test framework
- `browser-tests.html` - The main test runner with all tests
- `music-simple.test.js` - Example of an individual test file

## Mocking

The test setup includes simple mocks for:
- Web Audio API (AudioContext, oscillators, etc.)
- Fetch API
- EventSource
- localStorage
- DOM elements

These mocks allow the tests to verify the logic of the code without depending on browser APIs or making actual network requests. 