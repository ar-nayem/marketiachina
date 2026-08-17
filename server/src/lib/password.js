const crypto = require('node:crypto');

const KEY_LEN = 64;

function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainPassword, salt, KEY_LEN).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(plainPassword, stored) {
  const [scheme, salt, derivedHex] = String(stored).split(':');
  if (scheme !== 'scrypt' || !salt || !derivedHex) return false;
  const derived = crypto.scryptSync(plainPassword, salt, KEY_LEN);
  const stored_ = Buffer.from(derivedHex, 'hex');
  if (derived.length !== stored_.length) return false;
  return crypto.timingSafeEqual(derived, stored_);
}

module.exports = { hashPassword, verifyPassword };
