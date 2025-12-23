// jest.setup.js
// Setup file for Jest tests - provides Web Crypto API polyfill for Node.js

const { webcrypto } = require('crypto');

// Make crypto available globally for tests
if (!global.crypto) {
  global.crypto = webcrypto;
}

// Ensure TextEncoder is available
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder;
}
