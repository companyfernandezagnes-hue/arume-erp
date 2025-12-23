/**
 * backup.js - Data backup and restore functionality
 * Extracted from index.html for testability
 */

/**
 * Export backup data as JSON string
 * @param {Object} data - Database object to export
 * @returns {string} JSON string representation of data
 */
function exportBackup(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data: must be an object');
  }

  try {
    return JSON.stringify(data, null, 2);
  } catch (error) {
    throw new Error('Failed to serialize data: ' + error.message);
  }
}

/**
 * Import backup data from JSON string
 * @param {string} jsonString - JSON string to parse
 * @returns {Object} Parsed database object
 */
function importBackup(jsonString) {
  if (typeof jsonString !== 'string' || !jsonString.trim()) {
    throw new Error('Invalid input: must be a non-empty string');
  }

  try {
    const parsed = JSON.parse(jsonString);
    
    // Validate required structure
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid backup: must be an object');
    }

    // Check for required fields
    const requiredFields = ['users', 'ingredientes', 'recetas'];
    const missingFields = requiredFields.filter(field => !parsed.hasOwnProperty(field));
    
    if (missingFields.length > 0) {
      throw new Error(`Invalid backup: missing required fields: ${missingFields.join(', ')}`);
    }

    // Validate field types
    if (!Array.isArray(parsed.users)) {
      throw new Error('Invalid backup: users must be an array');
    }
    if (!Array.isArray(parsed.ingredientes)) {
      throw new Error('Invalid backup: ingredientes must be an array');
    }
    if (!Array.isArray(parsed.recetas)) {
      throw new Error('Invalid backup: recetas must be an array');
    }

    return parsed;
  } catch (error) {
    if (error.message.startsWith('Invalid backup:')) {
      throw error;
    }
    throw new Error('Failed to parse JSON: ' + error.message);
  }
}

/**
 * Validate backup data structure
 * @param {Object} data - Database object to validate
 * @returns {boolean} True if valid
 */
function validateBackup(data) {
  try {
    importBackup(exportBackup(data));
    return true;
  } catch (error) {
    return false;
  }
}

// Export for use in browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { exportBackup, importBackup, validateBackup };
}
