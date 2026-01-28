// __tests__/stock.test.js
// Unit tests for stock management and PMP calculation

const { updateStockOnReceive, calculatePMP } = require('../src/logic/stock');

describe('calculatePMP', () => {
    test('should calculate weighted average price correctly', () => {
        const currentStock = {
            n: 'Tomate',
            stock: 10,
            cost: 2.0
        };

        const incoming = {
            quantity: 5,
            unitCost: 2.5
        };

        const result = calculatePMP(currentStock, incoming);

        // Previous total: 10 * 2.0 = 20
        // New total: 5 * 2.5 = 12.5
        // Combined: 32.5 / 15 = 2.167
        expect(result.newStock).toBe(15);
        expect(result.newCost).toBeCloseTo(2.167, 2);
    });

    test('should handle adding to empty stock', () => {
        const currentStock = {
            n: 'New Product',
            stock: 0,
            cost: 0
        };

        const incoming = {
            quantity: 10,
            unitCost: 3.0
        };

        const result = calculatePMP(currentStock, incoming);

        expect(result.newStock).toBe(10);
        expect(result.newCost).toBe(3.0);
    });

    test('should handle price increase', () => {
        const currentStock = {
            n: 'Aceite',
            stock: 20,
            cost: 4.0
        };

        const incoming = {
            quantity: 10,
            unitCost: 5.0
        };

        const result = calculatePMP(currentStock, incoming);

        // (20 * 4.0 + 10 * 5.0) / 30 = (80 + 50) / 30 = 4.333
        expect(result.newStock).toBe(30);
        expect(result.newCost).toBeCloseTo(4.333, 2);
    });

    test('should handle price decrease', () => {
        const currentStock = {
            n: 'Aceite',
            stock: 20,
            cost: 5.0
        };

        const incoming = {
            quantity: 10,
            unitCost: 4.0
        };

        const result = calculatePMP(currentStock, incoming);

        // (20 * 5.0 + 10 * 4.0) / 30 = (100 + 40) / 30 = 4.667
        expect(result.newStock).toBe(30);
        expect(result.newCost).toBeCloseTo(4.667, 2);
    });

    test('should handle null/undefined input', () => {
        const result = calculatePMP(null, null);

        expect(result.newStock).toBe(0);
        expect(result.newCost).toBe(0);
    });

    test('should handle missing properties gracefully', () => {
        const currentStock = {};
        const incoming = {};

        const result = calculatePMP(currentStock, incoming);

        expect(result.newStock).toBe(0);
        expect(result.newCost).toBe(0);
    });
});

describe('updateStockOnReceive', () => {
    test('should update existing stock item with PMP', () => {
        const currentStock = [
            { id: 'i1', n: 'Tomate', stock: 10, cost: 2.0, min: 5, unit: 'kg', yield: 1, aller: [] }
        ];

        const receiveLines = [
            { n: 'Tomate', q: 5, p: 2.5, d: 0, iva: 10 }
        ];

        const result = updateStockOnReceive(receiveLines, currentStock);

        expect(result.length).toBe(1);
        expect(result[0].stock).toBe(15);
        expect(result[0].cost).toBeCloseTo(2.167, 2);
    });

    test('should add new item to stock', () => {
        const currentStock = [
            { id: 'i1', n: 'Tomate', stock: 10, cost: 2.0, min: 5, unit: 'kg', yield: 1, aller: [] }
        ];

        const receiveLines = [
            { n: 'Cebolla', q: 8, p: 1.5, d: 0, iva: 10 }
        ];

        const result = updateStockOnReceive(receiveLines, currentStock);

        expect(result.length).toBe(2);
        expect(result[1].n).toBe('Cebolla');
        expect(result[1].stock).toBe(8);
        expect(result[1].cost).toBeCloseTo(1.5, 3);  // Unit price is 1.5
    });

    test('should handle discount in unit cost calculation', () => {
        const currentStock = [];

        const receiveLines = [
            { n: 'Aceite', q: 10, p: 50, d: 10, iva: 10 }  // 10% discount
        ];

        const result = updateStockOnReceive(receiveLines, currentStock);

        expect(result.length).toBe(1);
        expect(result[0].n).toBe('Aceite');
        expect(result[0].stock).toBe(10);
        // Unit cost: 50 * 0.9 = 45 per unit
        expect(result[0].cost).toBeCloseTo(45, 2);
    });

    test('should handle multiple items in one receive', () => {
        const currentStock = [
            { id: 'i1', n: 'Tomate', stock: 10, cost: 2.0, min: 5, unit: 'kg', yield: 1, aller: [] }
        ];

        const receiveLines = [
            { n: 'Tomate', q: 5, p: 2.5, d: 0, iva: 10 },
            { n: 'Cebolla', q: 3, p: 1.8, d: 0, iva: 10 },
            { n: 'Aceite', q: 2, p: 10, d: 5, iva: 21 }
        ];

        const result = updateStockOnReceive(receiveLines, currentStock);

        expect(result.length).toBe(3);
        
        // Tomate updated
        expect(result[0].stock).toBe(15);
        
        // Cebolla added
        const cebolla = result.find(i => i.n === 'Cebolla');
        expect(cebolla.stock).toBe(3);
        
        // Aceite added with discount
        const aceite = result.find(i => i.n === 'Aceite');
        expect(aceite.stock).toBe(2);
        expect(aceite.cost).toBeCloseTo(9.5, 2);  // 10 * 0.95 per unit
    });

    test('should be case-insensitive for product names', () => {
        const currentStock = [
            { id: 'i1', n: 'Tomate', stock: 10, cost: 2.0, min: 5, unit: 'kg', yield: 1, aller: [] }
        ];

        const receiveLines = [
            { n: 'TOMATE', q: 5, p: 2.5, d: 0, iva: 10 }  // Uppercase
        ];

        const result = updateStockOnReceive(receiveLines, currentStock);

        expect(result.length).toBe(1);  // Should update existing, not add new
        expect(result[0].stock).toBe(15);
    });

    test('should trim whitespace from product names', () => {
        const currentStock = [
            { id: 'i1', n: 'Tomate', stock: 10, cost: 2.0, min: 5, unit: 'kg', yield: 1, aller: [] }
        ];

        const receiveLines = [
            { n: '  Tomate  ', q: 5, p: 2.5, d: 0, iva: 10 }
        ];

        const result = updateStockOnReceive(receiveLines, currentStock);

        expect(result.length).toBe(1);  // Should update existing, not add new
        expect(result[0].stock).toBe(15);
    });

    test('should handle empty receive lines', () => {
        const currentStock = [
            { id: 'i1', n: 'Tomate', stock: 10, cost: 2.0, min: 5, unit: 'kg', yield: 1, aller: [] }
        ];

        const result = updateStockOnReceive([], currentStock);

        expect(result.length).toBe(1);
        expect(result[0].stock).toBe(10);  // Unchanged
    });

    test('should handle invalid input types', () => {
        const result = updateStockOnReceive(null, null);
        expect(result).toBeNull();
    });

    test('should calculate unit cost correctly when quantity > 1', () => {
        const currentStock = [];

        const receiveLines = [
            { n: 'Product', q: 4, p: 20, d: 0, iva: 10 }  // 4 units at 20€ per unit
        ];

        const result = updateStockOnReceive(receiveLines, currentStock);

        // Unit cost should be 20 (the price per unit)
        expect(result[0].cost).toBe(20);
    });

    test('should handle zero discount', () => {
        const currentStock = [];

        const receiveLines = [
            { n: 'Product', q: 2, p: 10, d: 0, iva: 10 }
        ];

        const result = updateStockOnReceive(receiveLines, currentStock);

        expect(result[0].cost).toBe(10);  // 10 per unit, no discount applied
    });

    test('should handle high discount percentage', () => {
        const currentStock = [];

        const receiveLines = [
            { n: 'Product', q: 5, p: 100, d: 50, iva: 10 }  // 50% discount
        ];

        const result = updateStockOnReceive(receiveLines, currentStock);

        // Unit cost: 100 * 0.5 = 50 per unit
        expect(result[0].cost).toBe(50);
    });
});
