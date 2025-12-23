// src/index.js
// Main entry point that exports all logic modules

// Import logic modules
const { calculateRecipeCost } = require('./logic/recipes');
const { updateStockOnReceive, calculatePMP } = require('./logic/stock');
const { exportBackup, importBackup } = require('./logic/backup');
const { hashPin, verifyPin } = require('./logic/auth');

// Re-export all functions
module.exports = {
    // Recipe functions
    calculateRecipeCost,
    
    // Stock functions
    updateStockOnReceive,
    calculatePMP,
    
    // Backup functions
    exportBackup,
    importBackup,
    
    // Auth functions
    hashPin,
    verifyPin
};
