'use strict';

const crypto = require('crypto');

// In-memory store: token → { email, org, expiresAt }
const resetStore = new Map();

const TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Generate and store a password reset token for the given email+org.
 * Returns the token string.
 */
function generateResetToken(email, org) {
  // Invalidate any existing token for this email+org
  for (const [tok, val] of resetStore.entries()) {
    if (val.email === email && val.org === org) resetStore.delete(tok);
  }
  const token = crypto.randomBytes(32).toString('hex');
  resetStore.set(token, { email, org, expiresAt: Date.now() + TTL_MS });
  return token;
}

/**
 * Verify and consume a reset token.
 * Returns { email, org } on success, null on failure.
 */
function consumeResetToken(token) {
  const entry = resetStore.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    resetStore.delete(token);
    return null;
  }
  resetStore.delete(token); // single-use
  return { email: entry.email, org: entry.org };
}

module.exports = { generateResetToken, consumeResetToken };
