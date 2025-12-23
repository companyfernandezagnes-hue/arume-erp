// src/logic/stock.js
// Stock management and PMP (Precio Medio Ponderado) calculation logic

/**
 * Update stock based on received items using weighted average price (PMP)
 * @param {Array} receiveLines - Array of items received with {n: name, q: quantity, p: price, d: discount, iva: iva}
 * @param {Array} currentStock - Current stock array (will be modified in place)
 * @returns {Array} - Updated stock array
 */
function updateStockOnReceive(receiveLines = [], currentStock = []) {
    if (!Array.isArray(receiveLines) || !Array.isArray(currentStock)) {
        return currentStock;
    }

    receiveLines.forEach(item => {
        const qty = Number(item.q) || 1;
        const price = Number(item.p) || 0;
        const discount = Number(item.d) || 0;
        
        // Calculate unit net cost (price per unit after discount, without IVA)
        // Price is already per unit, so we just apply the discount
        const unitNetCost = price * (1 - discount / 100);
        
        // Find existing ingredient in stock
        const stockItem = currentStock.find(ing => 
            (ing.n || '').toLowerCase().trim() === (item.n || '').toLowerCase().trim()
        );

        if (stockItem) {
            // Update using weighted average (PMP)
            const result = calculatePMP(stockItem, { quantity: qty, unitCost: unitNetCost });
            stockItem.cost = result.newCost;
            stockItem.stock = result.newStock;
        } else {
            // Add new ingredient to stock
            const newItem = {
                id: generateID(),
                n: item.n,
                stock: qty,
                cost: unitNetCost || 0,
                min: 0,
                unit: 'ud',
                yield: 1,
                aller: []
            };
            currentStock.push(newItem);
        }
    });

    return currentStock;
}

/**
 * Calculate new weighted average price (Precio Medio Ponderado - PMP)
 * @param {Object} currentStock - Current stock item with stock and cost
 * @param {Object} incoming - Incoming item with quantity and unitCost
 * @returns {Object} - Object with newCost and newStock
 */
function calculatePMP(currentStock, incoming) {
    if (!currentStock || !incoming) {
        return { newCost: 0, newStock: 0 };
    }

    const prevStock = Number(currentStock.stock) || 0;
    const prevCost = Number(currentStock.cost) || 0;
    const incomingQty = Number(incoming.quantity) || 0;
    const incomingCost = Number(incoming.unitCost) || 0;

    const prevTotal = prevStock * prevCost;
    const addedTotal = incomingQty * incomingCost;
    const newStock = prevStock + incomingQty;

    const newCost = newStock > 0 ? ((prevTotal + addedTotal) / newStock) : incomingCost;

    return {
        newCost: newCost,
        newStock: newStock
    };
}

/**
 * Generate a unique ID (helper function)
 * @returns {string} - Unique identifier
 */
function generateID() {
    // Use crypto.randomUUID if available, otherwise fall back to timestamp + random
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID
    // Format: timestamp-random (similar to UUID structure)
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${randomPart}`;
}

module.exports = {
    updateStockOnReceive,
    calculatePMP
};
