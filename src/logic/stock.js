/**
 * stock.js - Stock management and weighted average price calculation
 * Extracted from index.html for testability
 */

/**
 * Update stock levels when receiving merchandise
 * @param {Array} receiveLines - Array of items received (with n, q, p, d, iva)
 * @param {Array} currentStock - Current stock array
 * @returns {Array} Updated stock array
 */
function updateStockOnReceive(receiveLines, currentStock) {
  if (!Array.isArray(receiveLines) || !Array.isArray(currentStock)) {
    return currentStock || [];
  }

  const updatedStock = [...currentStock];

  receiveLines.forEach(item => {
    const quantity = Number(item.q) || 1;
    const price = Number(item.p) || 0;
    const discount = Number(item.d) || 0;
    
    // Calculate unit net cost (without VAT, with discount applied)
    const unitNetCost = quantity > 0 
      ? ((price * (1 - discount / 100)) / quantity) 
      : (price * (1 - discount / 100));

    // Find existing ingredient
    const existingIndex = updatedStock.findIndex(
      ing => (ing.n || '').toLowerCase().trim() === (item.n || '').toLowerCase().trim()
    );

    if (existingIndex >= 0) {
      // Update existing ingredient with weighted average
      const existing = updatedStock[existingIndex];
      const prevStock = Number(existing.stock) || 0;
      const prevCost = Number(existing.cost) || 0;
      
      const newStock = prevStock + quantity;
      const newCost = calculatePMP({ stock: prevStock, cost: prevCost }, { quantity, cost: unitNetCost });
      
      updatedStock[existingIndex] = {
        ...existing,
        stock: newStock,
        cost: newCost
      };
    } else {
      // Add new ingredient
      updatedStock.push({
        id: generateID(),
        n: item.n,
        stock: quantity,
        cost: unitNetCost || 0,
        min: 0,
        unit: 'ud',
        yield: 1,
        aller: []
      });
    }
  });

  return updatedStock;
}

/**
 * Calculate Weighted Average Price (PMP - Precio Medio Ponderado)
 * @param {Object} currentStock - Current stock info { stock, cost }
 * @param {Object} incoming - Incoming stock { quantity, cost }
 * @returns {number} New weighted average cost
 */
function calculatePMP(currentStock, incoming) {
  const prevStock = Number(currentStock.stock) || 0;
  const prevCost = Number(currentStock.cost) || 0;
  const incomingQty = Number(incoming.quantity) || 0;
  const incomingCost = Number(incoming.cost) || 0;

  const prevTotal = prevStock * prevCost;
  const addedTotal = incomingQty * incomingCost;
  const newStock = prevStock + incomingQty;

  if (newStock <= 0) {
    return incomingCost;
  }

  return (prevTotal + addedTotal) / newStock;
}

/**
 * Generate a unique ID (using crypto.randomUUID if available)
 * @returns {string} Unique identifier
 */
function generateID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString() + Math.random().toString(36).substring(2);
}

// Export for use in browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { updateStockOnReceive, calculatePMP, generateID };
}
