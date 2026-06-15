'use strict';

const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 10;

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';

/**
 * Generate a random 10-character password.
 */
function generatePassword() {
  let pw = '';
  for (let i = 0; i < 10; i++) {
    pw += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return pw;
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
