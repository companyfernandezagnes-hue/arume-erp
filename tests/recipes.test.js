/**
 * Tests for recipes.js
 */

const { calculateRecipeCost } = require('../src/logic/recipes');

describe('calculateRecipeCost', () => {
  const mockIngredients = [
    { id: 'ing1', n: 'Tomate', cost: 2.5, yield: 0.9 },
    { id: 'ing2', n: 'Aceite', cost: 5.0, yield: 1.0 },
    { id: 'ing3', n: 'Sal', cost: 0.5, yield: 1.0 }
  ];

  test('should calculate recipe cost correctly with multiple ingredients', () => {
    const recipe = {
      n: 'Salsa de tomate',
      time: 30, // minutes
      items: [
        { id: 'ing1', q: 2 },  // 2 units of tomato
        { id: 'ing2', q: 0.5 }, // 0.5 units of oil
        { id: 'ing3', q: 0.1 }  // 0.1 units of salt
      ]
    };

    const result = calculateRecipeCost(recipe, mockIngredients, { COST_HOUR: 15 });

    // Material cost: (2/0.9)*2.5 + (0.5/1.0)*5.0 + (0.1/1.0)*0.5
    // = 5.556 + 2.5 + 0.05 = 8.106
    // Labor cost: (30/60) * 15 = 7.5
    // Total: 15.606

    expect(result.mat).toBeCloseTo(8.106, 2);
    expect(result.mo).toBe(7.5);
    expect(result.total).toBeCloseTo(15.606, 2);
  });

  test('should handle recipe with no ingredients', () => {
    const recipe = {
      n: 'Empty recipe',
      time: 10,
      items: []
    };

    const result = calculateRecipeCost(recipe, mockIngredients);

    expect(result.mat).toBe(0);
    expect(result.mo).toBe(2.5); // (10/60) * 15
    expect(result.total).toBe(2.5);
  });

  test('should return zero costs for invalid recipe', () => {
    const result = calculateRecipeCost(null, mockIngredients);

    expect(result.mat).toBe(0);
    expect(result.mo).toBe(0);
    expect(result.total).toBe(0);
  });

  test('should return zero costs for invalid ingredients array', () => {
    const recipe = {
      n: 'Test',
      time: 10,
      items: [{ id: 'ing1', q: 1 }]
    };

    const result = calculateRecipeCost(recipe, null);

    expect(result.mat).toBe(0);
    expect(result.mo).toBe(2.5);
    expect(result.total).toBe(2.5);
  });

  test('should handle missing ingredient in database', () => {
    const recipe = {
      n: 'Test',
      time: 0,
      items: [
        { id: 'nonexistent', q: 5 }
      ]
    };

    const result = calculateRecipeCost(recipe, mockIngredients);

    expect(result.mat).toBe(0);
    expect(result.mo).toBe(0);
    expect(result.total).toBe(0);
  });

  test('should use default COST_HOUR when not provided', () => {
    const recipe = {
      n: 'Test',
      time: 60,
      items: []
    };

    const result = calculateRecipeCost(recipe, mockIngredients);

    expect(result.mo).toBe(15); // 60/60 * 15 (default)
  });

  test('should handle custom COST_HOUR', () => {
    const recipe = {
      n: 'Test',
      time: 60,
      items: []
    };

    const result = calculateRecipeCost(recipe, mockIngredients, { COST_HOUR: 20 });

    expect(result.mo).toBe(20); // 60/60 * 20
  });

  test('should handle ingredient with default yield factor', () => {
    const ingredients = [
      { id: 'ing1', n: 'Test', cost: 10 } // no yield specified
    ];

    const recipe = {
      n: 'Test',
      time: 0,
      items: [{ id: 'ing1', q: 2 }]
    };

    const result = calculateRecipeCost(recipe, ingredients);

    expect(result.mat).toBe(20); // 2 * 10 / 1 (default yield)
  });

  test('should handle zero yield gracefully', () => {
    const ingredients = [
      { id: 'ing1', n: 'Test', cost: 10, yield: 0 }
    ];

    const recipe = {
      n: 'Test',
      time: 0,
      items: [{ id: 'ing1', q: 2 }]
    };

    const result = calculateRecipeCost(recipe, ingredients);

    expect(result.mat).toBe(20); // Uses default yield of 1
  });
});
