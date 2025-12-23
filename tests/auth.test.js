/**
 * Tests for auth.js
 */

const { hashPin, verifyPin, verifyPinWithMigration } = require('../src/logic/auth');

describe('hashPin', () => {
  test('should hash a PIN to a hex string', async () => {
    const pin = '1234';
    const hash = await hashPin(pin);

    expect(typeof hash).toBe('string');
    expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 produces 64 hex chars
  });

  test('should produce consistent hashes for the same PIN', async () => {
    const pin = '1234';
    const hash1 = await hashPin(pin);
    const hash2 = await hashPin(pin);

    expect(hash1).toBe(hash2);
  });

  test('should produce different hashes for different PINs', async () => {
    const pin1 = '1234';
    const pin2 = '5678';
    const hash1 = await hashPin(pin1);
    const hash2 = await hashPin(pin2);

    expect(hash1).not.toBe(hash2);
  });

  test('should throw error for empty string', async () => {
    await expect(hashPin('')).rejects.toThrow('PIN must be a non-empty string');
  });

  test('should throw error for null', async () => {
    await expect(hashPin(null)).rejects.toThrow('PIN must be a non-empty string');
  });

  test('should throw error for undefined', async () => {
    await expect(hashPin(undefined)).rejects.toThrow('PIN must be a non-empty string');
  });

  test('should throw error for non-string input', async () => {
    await expect(hashPin(1234)).rejects.toThrow('PIN must be a non-empty string');
  });

  test('should handle string numbers correctly', async () => {
    const pin = '0150';
    const hash = await hashPin(pin);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe('03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4');
  });
});

describe('verifyPin', () => {
  test('should return true for matching PIN and hash', async () => {
    const pin = '1234';
    const hash = await hashPin(pin);
    const result = await verifyPin(pin, hash);

    expect(result).toBe(true);
  });

  test('should return false for non-matching PIN and hash', async () => {
    const pin = '1234';
    const hash = await hashPin('5678');
    const result = await verifyPin(pin, hash);

    expect(result).toBe(false);
  });

  test('should return false for empty PIN', async () => {
    const hash = await hashPin('1234');
    const result = await verifyPin('', hash);

    expect(result).toBe(false);
  });

  test('should return false for null PIN', async () => {
    const hash = await hashPin('1234');
    const result = await verifyPin(null, hash);

    expect(result).toBe(false);
  });

  test('should return false for empty hash', async () => {
    const result = await verifyPin('1234', '');

    expect(result).toBe(false);
  });

  test('should return false for null hash', async () => {
    const result = await verifyPin('1234', null);

    expect(result).toBe(false);
  });

  test('should handle verification errors gracefully', async () => {
    const result = await verifyPin('1234', 'invalid-hash');

    expect(result).toBe(false);
  });
});

describe('verifyPinWithMigration', () => {
  test('should authenticate user with pinHash', async () => {
    const pin = '1234';
    const hash = await hashPin(pin);
    const users = [
      { id: 'u1', n: 'Admin', pinHash: hash }
    ];

    const result = await verifyPinWithMigration(users, pin);

    expect(result).not.toBeNull();
    expect(result.id).toBe('u1');
    expect(result.needsMigration).toBeUndefined();
  });

  test('should authenticate user with legacy plain PIN', async () => {
    const pin = '1234';
    const users = [
      { id: 'u1', n: 'Admin', pin: '1234' }
    ];

    const result = await verifyPinWithMigration(users, pin);

    expect(result).not.toBeNull();
    expect(result.id).toBe('u1');
    expect(result.needsMigration).toBe(true);
    expect(result.pinHash).toBeDefined();
  });

  test('should prioritize pinHash over legacy pin', async () => {
    const pin = '1234';
    const hash = await hashPin(pin);
    const users = [
      { id: 'u1', n: 'User1', pin: '1234' },
      { id: 'u2', n: 'User2', pinHash: hash }
    ];

    const result = await verifyPinWithMigration(users, pin);

    expect(result.id).toBe('u2'); // Should match by hash first
  });

  test('should return null for non-matching PIN', async () => {
    const users = [
      { id: 'u1', n: 'Admin', pin: '1234' }
    ];

    const result = await verifyPinWithMigration(users, '9999');

    expect(result).toBeNull();
  });

  test('should return null for empty users array', async () => {
    const result = await verifyPinWithMigration([], '1234');

    expect(result).toBeNull();
  });

  test('should return null for null users', async () => {
    const result = await verifyPinWithMigration(null, '1234');

    expect(result).toBeNull();
  });

  test('should return null for empty PIN', async () => {
    const users = [
      { id: 'u1', n: 'Admin', pin: '1234' }
    ];

    const result = await verifyPinWithMigration(users, '');

    expect(result).toBeNull();
  });

  test('should handle users without pin or pinHash', async () => {
    const users = [
      { id: 'u1', n: 'NoAuth' }
    ];

    const result = await verifyPinWithMigration(users, '1234');

    expect(result).toBeNull();
  });

  test('should include computed pinHash for legacy user', async () => {
    const pin = '0150';
    const users = [
      { id: 'u1', n: 'Gerencia', pin: '0150' }
    ];

    const result = await verifyPinWithMigration(users, pin);

    expect(result.needsMigration).toBe(true);
    expect(result.pinHash).toBe('03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4');
  });
});
