// __tests__/auth.test.js
// Unit tests for authentication (PIN hashing and verification)

const { hashPin, verifyPin } = require('../src/logic/auth');

describe('hashPin', () => {
    test('should hash a PIN correctly', async () => {
        const pin = '1234';
        const hash = await hashPin(pin);

        expect(hash).toBeDefined();
        expect(typeof hash).toBe('string');
        expect(hash.length).toBe(64);  // SHA-256 produces 64 hex characters
    });

    test('should produce consistent hashes for same PIN', async () => {
        const pin = '5678';
        const hash1 = await hashPin(pin);
        const hash2 = await hashPin(pin);

        expect(hash1).toBe(hash2);
    });

    test('should produce different hashes for different PINs', async () => {
        const hash1 = await hashPin('1234');
        const hash2 = await hashPin('5678');

        expect(hash1).not.toBe(hash2);
    });

    test('should handle numeric PIN input', async () => {
        const pin = 1234;
        const hash = await hashPin(pin);

        expect(hash).toBeDefined();
        expect(hash.length).toBe(64);
    });

    test('should throw error for empty PIN', async () => {
        await expect(hashPin('')).rejects.toThrow('PIN is required');
    });

    test('should throw error for null PIN', async () => {
        await expect(hashPin(null)).rejects.toThrow('PIN is required');
    });

    test('should throw error for undefined PIN', async () => {
        await expect(hashPin(undefined)).rejects.toThrow('PIN is required');
    });

    test('should handle PIN with leading zeros', async () => {
        const pin = '0123';
        const hash = await hashPin(pin);

        expect(hash).toBeDefined();
        expect(hash.length).toBe(64);
    });

    test('should produce different hash for PIN with/without leading zero', async () => {
        const hash1 = await hashPin('0123');
        const hash2 = await hashPin('123');

        expect(hash1).not.toBe(hash2);
    });

    test('should handle longer PINs', async () => {
        const pin = '123456789';
        const hash = await hashPin(pin);

        expect(hash).toBeDefined();
        expect(hash.length).toBe(64);
    });

    test('should produce only hexadecimal characters', async () => {
        const pin = '9999';
        const hash = await hashPin(pin);

        expect(hash).toMatch(/^[0-9a-f]+$/);
    });
});

describe('verifyPin', () => {
    test('should verify correct PIN', async () => {
        const pin = '1234';
        const hash = await hashPin(pin);

        const isValid = await verifyPin(pin, hash);

        expect(isValid).toBe(true);
    });

    test('should reject incorrect PIN', async () => {
        const correctPin = '1234';
        const incorrectPin = '5678';
        const hash = await hashPin(correctPin);

        const isValid = await verifyPin(incorrectPin, hash);

        expect(isValid).toBe(false);
    });

    test('should return false for empty PIN', async () => {
        const hash = await hashPin('1234');
        const isValid = await verifyPin('', hash);

        expect(isValid).toBe(false);
    });

    test('should return false for null PIN', async () => {
        const hash = await hashPin('1234');
        const isValid = await verifyPin(null, hash);

        expect(isValid).toBe(false);
    });

    test('should return false for null hash', async () => {
        const isValid = await verifyPin('1234', null);

        expect(isValid).toBe(false);
    });

    test('should return false for invalid hash format', async () => {
        const isValid = await verifyPin('1234', 'invalid_hash');

        expect(isValid).toBe(false);
    });

    test('should handle numeric PIN input in verification', async () => {
        const pin = 1234;
        const hash = await hashPin(pin);

        const isValid = await verifyPin(1234, hash);

        expect(isValid).toBe(true);
    });

    test('should be case-sensitive for hash', async () => {
        const pin = '1234';
        const hash = await hashPin(pin);
        const uppercaseHash = hash.toUpperCase();

        const isValid = await verifyPin(pin, uppercaseHash);

        expect(isValid).toBe(false);
    });

    test('should verify PIN with leading zeros correctly', async () => {
        const pin = '0150';
        const hash = await hashPin(pin);

        const isValid = await verifyPin('0150', hash);

        expect(isValid).toBe(true);
    });

    test('should not match PIN without leading zero to hash with leading zero', async () => {
        const pinWithZero = '0150';
        const hashWithZero = await hashPin(pinWithZero);

        const isValid = await verifyPin('150', hashWithZero);

        expect(isValid).toBe(false);
    });

    test('should handle verification roundtrip', async () => {
        const pins = ['1234', '0000', '9999', '0123', '5678'];

        for (const pin of pins) {
            const hash = await hashPin(pin);
            const isValid = await verifyPin(pin, hash);
            expect(isValid).toBe(true);
        }
    });

    test('should reject all incorrect PINs', async () => {
        const correctPin = '1234';
        const hash = await hashPin(correctPin);
        const incorrectPins = ['1233', '1235', '0000', '5678', '4321'];

        for (const pin of incorrectPins) {
            const isValid = await verifyPin(pin, hash);
            expect(isValid).toBe(false);
        }
    });
});

describe('auth integration', () => {
    test('should simulate user authentication flow', async () => {
        // Simulate creating a user with hashed PIN
        const userPin = '1234';
        const hashedPin = await hashPin(userPin);

        const user = {
            id: 'u1',
            n: 'Admin',
            pinHash: hashedPin,
            role: 'admin'
        };

        // Simulate login attempt with correct PIN
        const loginAttempt1 = await verifyPin('1234', user.pinHash);
        expect(loginAttempt1).toBe(true);

        // Simulate login attempt with incorrect PIN
        const loginAttempt2 = await verifyPin('5678', user.pinHash);
        expect(loginAttempt2).toBe(false);
    });

    test('should handle multiple users with different PINs', async () => {
        const user1 = {
            id: 'u1',
            n: 'Admin',
            pinHash: await hashPin('0150')
        };

        const user2 = {
            id: 'u2',
            n: 'Staff',
            pinHash: await hashPin('1111')
        };

        // Verify user1 PIN
        expect(await verifyPin('0150', user1.pinHash)).toBe(true);
        expect(await verifyPin('1111', user1.pinHash)).toBe(false);

        // Verify user2 PIN
        expect(await verifyPin('1111', user2.pinHash)).toBe(true);
        expect(await verifyPin('0150', user2.pinHash)).toBe(false);
    });
});
