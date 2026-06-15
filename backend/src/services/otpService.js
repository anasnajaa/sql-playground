'use strict';

// In-memory OTP store: email → { otp, expiresAt, attempts }
const otpStore = new Map();

const OTP_TTL_MS    = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS  = 3;

function _randomDigits(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

/**
 * Generate and store an OTP for the given email.
 * Returns the OTP plaintext (for sending via email).
 */
function generateOtp(email) {
  const otp = _randomDigits(6);
  otpStore.set(email.toLowerCase(), {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts:  0,
  });
  return otp;
}

/**
 * Verify an OTP for the given email.
 * Returns true if valid, false otherwise.
 * Clears the OTP after success or after max attempts.
 */
function verifyOtp(email, provided) {
  const key    = email.toLowerCase();
  const record = otpStore.get(key);

  if (!record) return false;
  if (Date.now() > record.expiresAt) { otpStore.delete(key); return false; }

  record.attempts += 1;

  if (record.otp !== String(provided).trim()) {
    if (record.attempts >= MAX_ATTEMPTS) otpStore.delete(key);
    return false;
  }

  otpStore.delete(key); // single-use
  return true;
}

module.exports = { generateOtp, verifyOtp };
