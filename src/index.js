/**
 * src/index.js - Main application entry point
 * Imports logic modules and exposes them globally for index.html
 * Maintains backward compatibility with existing code
 */

// Import logic modules
// Note: In browser context, these will need to be loaded via script tags
// For now, we export functions that can be called from index.html

(function(global) {
  'use strict';

  // Make functions available globally for index.html to use
  // This maintains backward compatibility while organizing code

  // Re-export functions to global scope if they're loaded as modules
  if (typeof global.calculateRecipeCost === 'undefined') {
    // Functions will be available via script tags in index.html
    // This file serves as documentation and future module loader
  }

  // Configuration
  global.ARUME_CONFIG = {
    VERSION: 'V52',
    MODULES_LOADED: {
      recipes: typeof global.calculateRecipeCost !== 'undefined',
      stock: typeof global.updateStockOnReceive !== 'undefined',
      backup: typeof global.exportBackup !== 'undefined',
      auth: typeof global.hashPin !== 'undefined'
    }
  };

  console.log('ARUME ERP Modules:', global.ARUME_CONFIG.MODULES_LOADED);

})(typeof window !== 'undefined' ? window : global);
