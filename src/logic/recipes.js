// src/logic/recipes.js
// Recipe cost calculation logic

/**
 * Calculate the cost of a recipe based on its ingredients
 * @param {Object} recipe - Recipe object with items array and time
 * @param {Array} ingredients - Array of ingredient objects with id, cost, and yield
 * @param {Object} options - Configuration options (e.g., COST_HOUR)
 * @returns {Object} - Object with mat (material cost), mo (labor cost), and total
 */
function calculateRecipeCost(recipe, ingredients = [], options = {}) {
    if (!recipe) {
        return { mat: 0, mo: 0, total: 0 };
    }

    const costPerHour = options.COST_HOUR || 15;
    let materialCost = 0;

    // Calculate material cost
    const recipeItems = recipe.items || [];
    recipeItems.forEach(item => {
        const ingredient = ingredients.find(i => i.id === item.id);
        if (ingredient) {
            const yieldFactor = (ingredient.yield && ingredient.yield > 0) ? ingredient.yield : 1;
            const quantity = Number(item.q) || 0;
            const cost = Number(ingredient.cost) || 0;
            materialCost += (quantity / yieldFactor) * cost;
        }
    });

    // Calculate labor cost (time in minutes / 60 * cost per hour)
    const timeInMinutes = Number(recipe.time) || 0;
    const laborCost = (timeInMinutes / 60) * costPerHour;

    const totalCost = materialCost + laborCost;

    return {
        mat: materialCost,
        mo: laborCost,
        total: totalCost
    };
}

module.exports = {
    calculateRecipeCost
};
