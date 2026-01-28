// src/logic/backup.js
// Backup export and import logic

/**
 * Export database to JSON string
 * @param {Object} data - Database object to export
 * @returns {string} - JSON string representation of the data
 */
function exportBackup(data) {
    if (!data) {
        throw new Error('No data provided for backup');
    }
    
    // Create a backup object with version and timestamp
    const backup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: data
    };
    
    return JSON.stringify(backup, null, 2);
}

/**
 * Import database from JSON string
 * @param {string} jsonString - JSON string to import
 * @returns {Object} - Parsed database object
 * @throws {Error} - If JSON is invalid or data structure is incorrect
 */
function importBackup(jsonString) {
    if (!jsonString || typeof jsonString !== 'string') {
        throw new Error('Invalid backup data: must be a non-empty string');
    }

    let parsed;
    try {
        parsed = JSON.parse(jsonString);
    } catch (err) {
        throw new Error('Invalid JSON format: ' + err.message);
    }

    // Check if it's a new format backup (with version and data wrapper)
    let data;
    if (parsed.version && parsed.data) {
        data = parsed.data;
    } else {
        // Legacy format - direct data object
        data = parsed;
    }

    // Validate required fields
    if (!data.users || !Array.isArray(data.users)) {
        throw new Error('Invalid backup: missing or invalid users array');
    }
    if (!data.ingredientes || !Array.isArray(data.ingredientes)) {
        throw new Error('Invalid backup: missing or invalid ingredientes array');
    }
    if (!data.recetas || !Array.isArray(data.recetas)) {
        throw new Error('Invalid backup: missing or invalid recetas array');
    }

    return data;
}

module.exports = {
    exportBackup,
    importBackup
};
