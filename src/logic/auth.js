/**
 * auth.js - Authentication utilities with PIN hashing
 * Using Web Crypto API with SHA-256 for secure PIN storage
 */

/**
 * Hash a PIN using SHA-256
 * @param {string} pin - PIN to hash
 * @returns {Promise<string>} Hex-encoded hash
 */
async function hashPin(pin) {
  if (!pin || typeof pin !== 'string') {
    throw new Error('PIN must be a non-empty string');
  }

  try {
    // Check if we're in Node.js environment (for testing)
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      // Use Node.js crypto module
      const nodeCrypto = require('crypto');
      return nodeCrypto.createHash('sha256').update(pin).digest('hex');
    }
    
    // Use Web Crypto API (available in modern browsers and Node.js 15+)
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(pin);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      
      // Convert to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } else {
      throw new Error('Web Crypto API not available');
    }
  } catch (error) {
    throw new Error('Failed to hash PIN: ' + error.message);
  }
}

/**
 * Verify a PIN against a stored hash
 * @param {string} pin - PIN to verify
 * @param {string} storedHash - Previously stored hash
 * @returns {Promise<boolean>} True if PIN matches hash
 */
async function verifyPin(pin, storedHash) {
  if (!pin || typeof pin !== 'string') {
    return false;
  }
  
  if (!storedHash || typeof storedHash !== 'string') {
    return false;
  }

  try {
    const pinHash = await hashPin(pin);
    return pinHash === storedHash;
  } catch (error) {
    console.error('Error verifying PIN:', error);
    return false;
  }
}

/**
 * Verify PIN with migration support for legacy plain-text PINs
 * @param {Array} users - Array of user objects
 * @param {string} pin - PIN to verify
 * @returns {Promise<Object|null>} User object if authenticated, null otherwise
 */
async function verifyPinWithMigration(users, pin) {
  if (!Array.isArray(users) || !pin) {
    return null;
  }

  const pinHash = await hashPin(pin);

  // Try to find user by pinHash first (new method)
  const userByHash = users.find(u => u.pinHash && u.pinHash === pinHash);
  if (userByHash) {
    return userByHash;
  }

  // Fallback: check legacy plain-text PIN
  const userByPlainPin = users.find(u => u.pin && u.pin === pin);
  if (userByPlainPin) {
    // Mark for migration
    return {
      ...userByPlainPin,
      needsMigration: true,
      pinHash: pinHash
    };
  }

  return null;
}

// Export for use in browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { hashPin, verifyPin, verifyPinWithMigration };
}
