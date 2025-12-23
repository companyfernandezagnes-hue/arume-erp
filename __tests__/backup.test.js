// __tests__/backup.test.js
// Unit tests for backup export and import

const { exportBackup, importBackup } = require('../src/logic/backup');

describe('exportBackup', () => {
    test('should export valid JSON with version and timestamp', () => {
        const testData = {
            users: [{ id: 'u1', n: 'Admin', pin: '1234', role: 'admin' }],
            ingredientes: [{ id: 'i1', n: 'Tomate', cost: 2.0 }],
            recetas: [{ id: 'r1', n: 'Salsa' }],
            proveedores: [{ n: 'Makro' }],
            albaranes: [],
            facturas: [],
            diario: [],
            mermas: [],
            lastSync: 0
        };

        const result = exportBackup(testData);

        // Parse to verify it's valid JSON
        const parsed = JSON.parse(result);
        
        expect(parsed.version).toBe('1.0');
        expect(parsed.timestamp).toBeDefined();
        expect(parsed.data).toEqual(testData);
    });

    test('should create properly formatted JSON string', () => {
        const testData = {
            users: [],
            ingredientes: [],
            recetas: []
        };

        const result = exportBackup(testData);
        
        // Should be formatted with 2 spaces
        expect(result).toContain('\n');
        expect(result).toContain('  ');
    });

    test('should throw error for null data', () => {
        expect(() => exportBackup(null)).toThrow('No data provided for backup');
    });

    test('should throw error for undefined data', () => {
        expect(() => exportBackup(undefined)).toThrow('No data provided for backup');
    });

    test('should handle complex nested data', () => {
        const complexData = {
            users: [
                { 
                    id: 'u1', 
                    n: 'Admin', 
                    role: 'admin',
                    settings: { notifications: true, theme: 'dark' }
                }
            ],
            ingredientes: [
                { 
                    id: 'i1', 
                    n: 'Tomate', 
                    cost: 2.5,
                    aller: ['gluten', 'lactose'],
                    suppliers: [
                        { name: 'Supplier1', lastPrice: 2.3 }
                    ]
                }
            ],
            recetas: []
        };

        const result = exportBackup(complexData);
        const parsed = JSON.parse(result);
        
        expect(parsed.data).toEqual(complexData);
        expect(parsed.data.users[0].settings.theme).toBe('dark');
        expect(parsed.data.ingredientes[0].aller).toEqual(['gluten', 'lactose']);
    });
});

describe('importBackup', () => {
    test('should import valid backup with new format', () => {
        const backupString = JSON.stringify({
            version: '1.0',
            timestamp: '2024-01-01T00:00:00.000Z',
            data: {
                users: [{ id: 'u1', n: 'Admin' }],
                ingredientes: [{ id: 'i1', n: 'Tomate' }],
                recetas: [{ id: 'r1', n: 'Salsa' }]
            }
        });

        const result = importBackup(backupString);

        expect(result.users).toHaveLength(1);
        expect(result.ingredientes).toHaveLength(1);
        expect(result.recetas).toHaveLength(1);
    });

    test('should import legacy format (direct data object)', () => {
        const legacyBackup = JSON.stringify({
            users: [{ id: 'u1', n: 'Admin' }],
            ingredientes: [],
            recetas: []
        });

        const result = importBackup(legacyBackup);

        expect(result.users).toHaveLength(1);
        expect(result.ingredientes).toBeDefined();
        expect(result.recetas).toBeDefined();
    });

    test('should perform roundtrip export/import correctly', () => {
        const originalData = {
            users: [
                { id: 'u1', n: 'Admin', pin: '1234', role: 'admin' },
                { id: 'u2', n: 'Staff', pin: '5678', role: 'staff' }
            ],
            ingredientes: [
                { id: 'i1', n: 'Tomate', cost: 2.5, stock: 10 },
                { id: 'i2', n: 'Cebolla', cost: 1.8, stock: 5 }
            ],
            recetas: [
                { id: 'r1', n: 'Salsa', items: [{ id: 'i1', q: 2 }] }
            ],
            proveedores: [{ n: 'Makro' }],
            albaranes: [],
            facturas: [],
            diario: [],
            mermas: [],
            lastSync: 12345
        };

        const exported = exportBackup(originalData);
        const imported = importBackup(exported);

        expect(imported).toEqual(originalData);
    });

    test('should throw error for invalid JSON', () => {
        const invalidJson = 'not a valid json{';

        expect(() => importBackup(invalidJson)).toThrow('Invalid JSON format');
    });

    test('should throw error for empty string', () => {
        expect(() => importBackup('')).toThrow('Invalid backup data');
    });

    test('should throw error for null input', () => {
        expect(() => importBackup(null)).toThrow('Invalid backup data');
    });

    test('should throw error for missing users array', () => {
        const invalidBackup = JSON.stringify({
            ingredientes: [],
            recetas: []
        });

        expect(() => importBackup(invalidBackup)).toThrow('Invalid backup: missing or invalid users array');
    });

    test('should throw error for missing ingredientes array', () => {
        const invalidBackup = JSON.stringify({
            users: [],
            recetas: []
        });

        expect(() => importBackup(invalidBackup)).toThrow('Invalid backup: missing or invalid ingredientes array');
    });

    test('should throw error for missing recetas array', () => {
        const invalidBackup = JSON.stringify({
            users: [],
            ingredientes: []
        });

        expect(() => importBackup(invalidBackup)).toThrow('Invalid backup: missing or invalid recetas array');
    });

    test('should throw error if users is not an array', () => {
        const invalidBackup = JSON.stringify({
            users: 'not an array',
            ingredientes: [],
            recetas: []
        });

        expect(() => importBackup(invalidBackup)).toThrow('Invalid backup: missing or invalid users array');
    });

    test('should accept empty arrays for valid structure', () => {
        const minimalBackup = JSON.stringify({
            users: [],
            ingredientes: [],
            recetas: []
        });

        const result = importBackup(minimalBackup);

        expect(result.users).toEqual([]);
        expect(result.ingredientes).toEqual([]);
        expect(result.recetas).toEqual([]);
    });

    test('should preserve additional fields in import', () => {
        const dataWithExtras = {
            users: [],
            ingredientes: [],
            recetas: [],
            proveedores: [{ n: 'Supplier1' }],
            customField: 'custom value',
            lastSync: 99999
        };

        const exported = exportBackup(dataWithExtras);
        const imported = importBackup(exported);

        expect(imported.proveedores).toEqual([{ n: 'Supplier1' }]);
        expect(imported.customField).toBe('custom value');
        expect(imported.lastSync).toBe(99999);
    });
});
