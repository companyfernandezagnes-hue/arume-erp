/**
 * recipes.js - Recipe cost calculation logic
 * Extracted from index.html for testability
 */

/**
 * Calculate the cost of a recipe
 * @param {Object} recipe - Recipe object with items array
 * @param {Array} ingredients - Array of all available ingredients
 * @param {Object} options - Configuration options (e.g., COST_HOUR)
 * @returns {Object} Cost breakdown: { mat, mo, total }
 */
function calculateRecipeCost(recipe, ingredients, options = {}) {
  if (!recipe || !Array.isArray(ingredients)) {
    return { mat: 0, mo: 0, total: 0 };
  }

  const COST_HOUR = options.COST_HOUR || 15;
  let materialCost = 0;

  // Calculate material cost
  const recipeItems = recipe.items || [];
  recipeItems.forEach(item => {
    const ingredient = ingredients.find(ing => ing.id === item.id);
    if (ingredient) {
      const quantity = Number(item.q) || 0;
      const cost = Number(ingredient.cost) || 0;
      const yieldFactor = (ingredient.yield && ingredient.yield > 0) ? ingredient.yield : 1;
      materialCost += (quantity / yieldFactor) * cost;
    }
  });

  // Calculate labor cost (time in minutes converted to hours * hourly rate)
  const time = Number(recipe.time) || 0;
  const laborCost = (time / 60) * COST_HOUR;

  const totalCost = materialCost + laborCost;

  return {
    mat: materialCost,
    mo: laborCost,
    total: totalCost
  };
}

// Export for use in browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calculateRecipeCost };
}
