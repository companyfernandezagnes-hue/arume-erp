/**
 * Tests for backup.js
 */

const { exportBackup, importBackup, validateBackup } = require('../src/logic/backup');

describe('exportBackup', () => {
  test('should export valid data as JSON string', () => {
    const data = {
      users: [{ id: 'u1', n: 'Admin' }],
      ingredientes: [{ id: 'i1', n: 'Tomate' }],
      recetas: [{ id: 'r1', n: 'Salsa' }],
      proveedores: []
    };

    const result = exportBackup(data);

    expect(typeof result).toBe('string');
    expect(JSON.parse(result)).toEqual(data);
  });

  test('should format JSON with indentation', () => {
    const data = {
      users: [],
      ingredientes: [],
      recetas: []
    };

    const result = exportBackup(data);

    expect(result).toContain('\n'); // Has newlines
    expect(result).toContain('  '); // Has indentation
  });

  test('should throw error for null data', () => {
    expect(() => exportBackup(null)).toThrow('Invalid data: must be an object');
  });

  test('should throw error for undefined data', () => {
    expect(() => exportBackup(undefined)).toThrow('Invalid data: must be an object');
  });

  test('should throw error for non-object data', () => {
    expect(() => exportBackup('string')).toThrow('Invalid data: must be an object');
    expect(() => exportBackup(123)).toThrow('Invalid data: must be an object');
  });

  test('should handle complex nested objects', () => {
    const data = {
      users: [{ id: 'u1', n: 'Admin', meta: { role: 'admin', permissions: ['read', 'write'] } }],
      ingredientes: [],
      recetas: []
    };

    const result = exportBackup(data);
    expect(JSON.parse(result)).toEqual(data);
  });
});

describe('importBackup', () => {
  test('should import valid JSON backup', () => {
    const jsonString = JSON.stringify({
      users: [{ id: 'u1', n: 'Admin' }],
      ingredientes: [{ id: 'i1', n: 'Tomate' }],
      recetas: [{ id: 'r1', n: 'Salsa' }]
    });

    const result = importBackup(jsonString);

    expect(result).toHaveProperty('users');
    expect(result).toHaveProperty('ingredientes');
    expect(result).toHaveProperty('recetas');
    expect(Array.isArray(result.users)).toBe(true);
  });

  test('should throw error for invalid JSON', () => {
    expect(() => importBackup('{ invalid json')).toThrow('Failed to parse JSON');
  });

  test('should throw error for empty string', () => {
    expect(() => importBackup('')).toThrow('Invalid input: must be a non-empty string');
  });

  test('should throw error for whitespace-only string', () => {
    expect(() => importBackup('   ')).toThrow('Invalid input: must be a non-empty string');
  });

  test('should throw error for non-string input', () => {
    expect(() => importBackup(null)).toThrow('Invalid input: must be a non-empty string');
    expect(() => importBackup(undefined)).toThrow('Invalid input: must be a non-empty string');
    expect(() => importBackup(123)).toThrow('Invalid input: must be a non-empty string');
  });

  test('should throw error for missing required fields', () => {
    const incomplete = JSON.stringify({
      users: [],
      ingredientes: []
      // missing recetas
    });

    expect(() => importBackup(incomplete)).toThrow('missing required fields: recetas');
  });

  test('should throw error when users is not an array', () => {
    const invalid = JSON.stringify({
      users: 'not-an-array',
      ingredientes: [],
      recetas: []
    });

    expect(() => importBackup(invalid)).toThrow('users must be an array');
  });

  test('should throw error when ingredientes is not an array', () => {
    const invalid = JSON.stringify({
      users: [],
      ingredientes: 'not-an-array',
      recetas: []
    });

    expect(() => importBackup(invalid)).toThrow('ingredientes must be an array');
  });

  test('should throw error when recetas is not an array', () => {
    const invalid = JSON.stringify({
      users: [],
      ingredientes: [],
      recetas: 'not-an-array'
    });

    expect(() => importBackup(invalid)).toThrow('recetas must be an array');
  });

  test('should accept backup with additional optional fields', () => {
    const jsonString = JSON.stringify({
      users: [],
      ingredientes: [],
      recetas: [],
      proveedores: [],
      albaranes: [],
      facturas: [],
      diario: []
    });

    const result = importBackup(jsonString);

    expect(result).toHaveProperty('proveedores');
    expect(result).toHaveProperty('albaranes');
  });

  test('should throw error for non-object JSON', () => {
    expect(() => importBackup('[]')).toThrow('Invalid backup: must be an object');
    expect(() => importBackup('"string"')).toThrow('Invalid backup: must be an object');
    expect(() => importBackup('123')).toThrow('Invalid backup: must be an object');
  });
});

describe('validateBackup', () => {
  test('should return true for valid backup data', () => {
    const validData = {
      users: [],
      ingredientes: [],
      recetas: []
    };

    expect(validateBackup(validData)).toBe(true);
  });

  test('should return false for invalid backup data', () => {
    const invalidData = {
      users: [],
      // missing ingredientes and recetas
    };

    expect(validateBackup(invalidData)).toBe(false);
  });

  test('should return false for null', () => {
    expect(validateBackup(null)).toBe(false);
  });

  test('should return false for non-object', () => {
    expect(validateBackup('string')).toBe(false);
    expect(validateBackup(123)).toBe(false);
  });
});

describe('exportBackup and importBackup integration', () => {
  test('should be able to export and import the same data', () => {
    const originalData = {
      users: [{ id: 'u1', n: 'Admin', pin: '1234' }],
      ingredientes: [{ id: 'i1', n: 'Tomate', cost: 2.5, stock: 10 }],
      recetas: [{ id: 'r1', n: 'Salsa', items: [{ id: 'i1', q: 2 }] }],
      proveedores: [{ n: 'Makro' }],
      lastSync: 1234567890
    };

    const exported = exportBackup(originalData);
    const imported = importBackup(exported);

    expect(imported).toEqual(originalData);
  });
});
