'use strict';

const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 10;

/**
 * Generate a random 5-digit numeric password.
 */
function generatePassword() {
  // 5 digits: 10000–99999
  return String(Math.floor(10000 + Math.random() * 90000));
}

/** Hash a plaintext password with bcrypt. */
async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Compare plaintext against a bcrypt hash. */
async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { generatePassword, hashPassword, verifyPassword };
