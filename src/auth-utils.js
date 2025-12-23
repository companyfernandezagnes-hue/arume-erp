// src/auth-utils.js
// Utilities for PIN hashing and migration (Node / Jest friendly)

async function sha256Hex(str) {
  const s = String(str || '');
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function verifyPinAttempt(db, pin, saveFn) {
  if (!db || !Array.isArray(db.users)) return null;
  const h = await sha256Hex(pin);

  // try match by pinHash
  const byHash = db.users.find(u => u.pinHash && u.pinHash === h);
  if (byHash) return byHash;

  // fallback: match by legacy plain pin
  const legacy = db.users.find(u => u.pin && u.pin === pin);
  if (legacy) {
    legacy.pinHash = h;
    legacy.pinLegacy = true;
    if (typeof saveFn === 'function') saveFn("Usuario migrado a pinHash");
    return legacy;
  }

  return null;
}

async function updateUserPinHash(user, pin, saveFn) {
  if (!user) return null;
  user.pinHash = await sha256Hex(pin);
  user.pinLegacy = true;
  if (typeof saveFn === 'function') saveFn("PinHash actualizado");
  return user;
}

async function performEmergencyReset(db, userId, pin, saveFn, CONFIG) {
  const user = (db.users || []).find(u => u.id === userId);
  if (!user) throw new Error("Usuario no encontrado");
  user.pin = String(pin);
  if (CONFIG && CONFIG.PIN_HASH_MIGRATION) {
    user.pinHash = await sha256Hex(pin);
    user.pinLegacy = true;
  }
  if (typeof saveFn === 'function') saveFn("PIN forzado por admin");
  return user;
}

module.exports = { sha256Hex, verifyPinAttempt, updateUserPinHash, performEmergencyReset };
