// src/logic/auth.js
// Authentication logic with PIN hashing using Web Crypto API

/**
 * Hash a PIN using SHA-256
 * @param {string} pin - PIN to hash
 * @returns {Promise<string>} - Hex string of the hash
 */
async function hashPin(pin) {
    if (!pin) {
        throw new Error('PIN is required');
    }

    const pinString = String(pin);
    
    // Use Web Crypto API (available in browsers and Node.js with crypto polyfill)
    if (typeof crypto === 'undefined' || !crypto.subtle) {
        throw new Error('Web Crypto API is not available');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(pinString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert buffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
}

/**
 * Verify a PIN against a stored hash
 * @param {string} pin - PIN to verify
 * @param {string} storedHash - Stored hash to compare against
 * @returns {Promise<boolean>} - True if PIN matches, false otherwise
 */
async function verifyPin(pin, storedHash) {
    if (!pin || !storedHash) {
        return false;
    }

    try {
        const hash = await hashPin(pin);
        return hash === storedHash;
    } catch (err) {
        console.error('Error verifying PIN:', err);
        return false;
    }
}

module.exports = {
    hashPin,
    verifyPin
};
