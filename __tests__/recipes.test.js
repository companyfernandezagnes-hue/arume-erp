// __tests__/recipes.test.js
// Unit tests for recipe cost calculation

const { calculateRecipeCost } = require('../src/logic/recipes');

describe('calculateRecipeCost', () => {
    const mockIngredients = [
        { id: 'ing1', n: 'Tomate', cost: 2.5, yield: 0.9, unit: 'kg' },
        { id: 'ing2', n: 'Cebolla', cost: 1.8, yield: 0.85, unit: 'kg' },
        { id: 'ing3', n: 'Aceite', cost: 5.0, yield: 1.0, unit: 'l' },
        { id: 'ing4', n: 'Sal', cost: 0.5, yield: 1.0, unit: 'kg' }
    ];

    test('should calculate cost correctly with basic recipe', () => {
        const recipe = {
            id: 'r1',
            n: 'Salsa de Tomate',
            items: [
                { id: 'ing1', q: 1.0 },  // 1 kg tomate
                { id: 'ing2', q: 0.5 },  // 0.5 kg cebolla
                { id: 'ing3', q: 0.1 }   // 0.1 l aceite
            ],
            time: 30  // 30 minutes
        };

        const result = calculateRecipeCost(recipe, mockIngredients, { COST_HOUR: 15 });

        // Material cost: (1.0/0.9)*2.5 + (0.5/0.85)*1.8 + (0.1/1.0)*5.0
        // = 2.778 + 1.059 + 0.5 = 4.337
        // Labor cost: (30/60) * 15 = 7.5
        // Total: 4.337 + 7.5 = 11.837

        expect(result.mat).toBeCloseTo(4.337, 2);
        expect(result.mo).toBeCloseTo(7.5, 2);
        expect(result.total).toBeCloseTo(11.837, 2);
    });

    test('should handle recipe with yield factor of 1', () => {
        const recipe = {
            id: 'r2',
            n: 'Simple Recipe',
            items: [
                { id: 'ing3', q: 0.2 }  // 0.2 l aceite (yield = 1)
            ],
            time: 15
        };

        const result = calculateRecipeCost(recipe, mockIngredients, { COST_HOUR: 15 });

        expect(result.mat).toBeCloseTo(1.0, 2);  // 0.2 * 5.0
        expect(result.mo).toBeCloseTo(3.75, 2);  // (15/60) * 15
        expect(result.total).toBeCloseTo(4.75, 2);
    });

    test('should handle recipe with yield/merma correctly', () => {
        const recipe = {
            id: 'r3',
            n: 'Tomate Limpio',
            items: [
                { id: 'ing1', q: 1.0 }  // 1 kg tomate with 10% loss (yield = 0.9)
            ],
            time: 10
        };

        const result = calculateRecipeCost(recipe, mockIngredients, { COST_HOUR: 15 });

        // Cost should be higher due to yield: (1.0/0.9) * 2.5 = 2.778
        expect(result.mat).toBeCloseTo(2.778, 2);
        expect(result.mo).toBeCloseTo(2.5, 2);  // (10/60) * 15
    });

    test('should handle empty recipe', () => {
        const recipe = {
            id: 'r4',
            n: 'Empty',
            items: [],
            time: 0
        };

        const result = calculateRecipeCost(recipe, mockIngredients);

        expect(result.mat).toBe(0);
        expect(result.mo).toBe(0);
        expect(result.total).toBe(0);
    });

    test('should handle null/undefined recipe', () => {
        const result = calculateRecipeCost(null, mockIngredients);

        expect(result.mat).toBe(0);
        expect(result.mo).toBe(0);
        expect(result.total).toBe(0);
    });

    test('should handle missing ingredients gracefully', () => {
        const recipe = {
            id: 'r5',
            n: 'Recipe with missing ingredient',
            items: [
                { id: 'ing1', q: 1.0 },
                { id: 'ing_nonexistent', q: 2.0 }  // This ingredient doesn't exist
            ],
            time: 20
        };

        const result = calculateRecipeCost(recipe, mockIngredients, { COST_HOUR: 15 });

        // Should only count existing ingredient
        expect(result.mat).toBeCloseTo(2.778, 2);  // Only tomate
        expect(result.mo).toBeCloseTo(5.0, 2);     // (20/60) * 15
        expect(result.total).toBeCloseTo(7.778, 2);
    });

    test('should use default cost per hour if not provided', () => {
        const recipe = {
            id: 'r6',
            n: 'Recipe with default cost',
            items: [],
            time: 60  // 1 hour
        };

        const result = calculateRecipeCost(recipe, mockIngredients);

        expect(result.mo).toBe(15);  // Default COST_HOUR is 15
        expect(result.total).toBe(15);
    });

    test('should handle recipe scaling (double quantities)', () => {
        const recipe = {
            id: 'r7',
            n: 'Double Recipe',
            items: [
                { id: 'ing1', q: 2.0 },  // 2 kg tomate (double)
                { id: 'ing2', q: 1.0 }   // 1 kg cebolla (double)
            ],
            time: 40
        };

        const result = calculateRecipeCost(recipe, mockIngredients, { COST_HOUR: 15 });

        // Material: (2.0/0.9)*2.5 + (1.0/0.85)*1.8 = 5.556 + 2.118 = 7.674
        expect(result.mat).toBeCloseTo(7.674, 2);
        expect(result.mo).toBeCloseTo(10.0, 2);  // (40/60) * 15
    });

    test('should handle zero yield as 1 (fallback)', () => {
        const ingredientsWithZeroYield = [
            { id: 'ing1', n: 'Test', cost: 10, yield: 0, unit: 'kg' }
        ];

        const recipe = {
            id: 'r8',
            n: 'Zero Yield Recipe',
            items: [{ id: 'ing1', q: 2.0 }],
            time: 0
        };

        const result = calculateRecipeCost(recipe, ingredientsWithZeroYield);

        // Should treat yield as 1: 2.0 * 10 = 20
        expect(result.mat).toBe(20);
    });

    test('should handle missing yield property', () => {
        const ingredientsNoYield = [
            { id: 'ing1', n: 'Test', cost: 10, unit: 'kg' }  // No yield property
        ];

        const recipe = {
            id: 'r9',
            n: 'No Yield Recipe',
            items: [{ id: 'ing1', q: 3.0 }],
            time: 0
        };

        const result = calculateRecipeCost(recipe, ingredientsNoYield);

        // Should treat yield as 1: 3.0 * 10 = 30
        expect(result.mat).toBe(30);
    });
});
