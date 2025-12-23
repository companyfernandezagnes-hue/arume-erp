/**
 * Tests for stock.js
 */

const { updateStockOnReceive, calculatePMP, generateID } = require('../src/logic/stock');

describe('calculatePMP', () => {
  test('should calculate weighted average price correctly', () => {
    const currentStock = { stock: 10, cost: 5.0 };
    const incoming = { quantity: 5, cost: 6.0 };

    const result = calculatePMP(currentStock, incoming);

    // (10 * 5.0 + 5 * 6.0) / 15 = 80 / 15 = 5.333...
    expect(result).toBeCloseTo(5.333, 2);
  });

  test('should handle zero current stock', () => {
    const currentStock = { stock: 0, cost: 5.0 };
    const incoming = { quantity: 10, cost: 8.0 };

    const result = calculatePMP(currentStock, incoming);

    expect(result).toBe(8.0);
  });

  test('should handle zero incoming quantity', () => {
    const currentStock = { stock: 10, cost: 5.0 };
    const incoming = { quantity: 0, cost: 8.0 };

    const result = calculatePMP(currentStock, incoming);

    expect(result).toBe(5.0);
  });

  test('should handle both zero quantities', () => {
    const currentStock = { stock: 0, cost: 5.0 };
    const incoming = { quantity: 0, cost: 8.0 };

    const result = calculatePMP(currentStock, incoming);

    expect(result).toBe(8.0);
  });

  test('should handle missing values gracefully', () => {
    const currentStock = {};
    const incoming = { quantity: 5, cost: 10 };

    const result = calculatePMP(currentStock, incoming);

    expect(result).toBe(10);
  });
});

describe('updateStockOnReceive', () => {
  test('should add new ingredient when not in stock', () => {
    const receiveLines = [
      { n: 'Tomate', q: 10, p: 2.5, d: 0, iva: 10 }
    ];
    const currentStock = [];

    const result = updateStockOnReceive(receiveLines, currentStock);

    expect(result).toHaveLength(1);
    expect(result[0].n).toBe('Tomate');
    expect(result[0].stock).toBe(10);
    expect(result[0].cost).toBeCloseTo(0.25, 2); // (2.5 * (1-0)) / 10
  });

  test('should update existing ingredient with weighted average', () => {
    const receiveLines = [
      { n: 'Tomate', q: 5, p: 3.0, d: 10, iva: 10 }
    ];
    const currentStock = [
      { id: 'ing1', n: 'Tomate', stock: 10, cost: 2.0, min: 5, unit: 'kg' }
    ];

    const result = updateStockOnReceive(receiveLines, currentStock);

    expect(result).toHaveLength(1);
    expect(result[0].stock).toBe(15); // 10 + 5
    // New cost: ((10 * 2.0) + (5 * (3.0 * 0.9 / 5))) / 15
    // = (20 + 2.7) / 15 = 1.513...
    expect(result[0].cost).toBeCloseTo(1.513, 2);
  });

  test('should handle case-insensitive and whitespace variations', () => {
    const receiveLines = [
      { n: '  TOMATE  ', q: 5, p: 2.0, d: 0, iva: 10 }
    ];
    const currentStock = [
      { id: 'ing1', n: 'tomate', stock: 10, cost: 1.5 }
    ];

    const result = updateStockOnReceive(receiveLines, currentStock);

    expect(result).toHaveLength(1);
    expect(result[0].stock).toBe(15);
  });

  test('should handle multiple items in one receive', () => {
    const receiveLines = [
      { n: 'Tomate', q: 5, p: 2.0, d: 0, iva: 10 },
      { n: 'Aceite', q: 2, p: 8.0, d: 5, iva: 10 }
    ];
    const currentStock = [];

    const result = updateStockOnReceive(receiveLines, currentStock);

    expect(result).toHaveLength(2);
    expect(result[0].n).toBe('Tomate');
    expect(result[1].n).toBe('Aceite');
  });

  test('should apply discount correctly', () => {
    const receiveLines = [
      { n: 'Test', q: 10, p: 100, d: 20, iva: 10 } // 20% discount
    ];
    const currentStock = [];

    const result = updateStockOnReceive(receiveLines, currentStock);

    // Unit net cost: (100 * (1 - 0.2)) / 10 = 80 / 10 = 8
    expect(result[0].cost).toBe(8);
  });

  test('should handle invalid inputs gracefully', () => {
    const result1 = updateStockOnReceive(null, []);
    expect(result1).toEqual([]);

    const result2 = updateStockOnReceive([], null);
    expect(result2).toEqual([]);

    const result3 = updateStockOnReceive(null, null);
    expect(result3).toEqual([]);
  });

  test('should preserve original stock array', () => {
    const receiveLines = [
      { n: 'New Item', q: 5, p: 2.0, d: 0, iva: 10 }
    ];
    const currentStock = [
      { id: 'ing1', n: 'Existing', stock: 10, cost: 1.0 }
    ];

    const result = updateStockOnReceive(receiveLines, currentStock);

    expect(currentStock).toHaveLength(1); // Original unchanged
    expect(result).toHaveLength(2); // New array with added item
  });

  test('should handle default quantity of 1 when q is missing', () => {
    const receiveLines = [
      { n: 'Test', p: 10, d: 0, iva: 10 }
    ];
    const currentStock = [];

    const result = updateStockOnReceive(receiveLines, currentStock);

    expect(result[0].stock).toBe(1);
  });
});

describe('generateID', () => {
  test('should generate unique IDs', () => {
    const id1 = generateID();
    const id2 = generateID();

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  test('should return a string', () => {
    const id = generateID();
    expect(typeof id).toBe('string');
  });
});
