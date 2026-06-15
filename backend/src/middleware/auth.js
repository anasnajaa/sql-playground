'use strict';

const jwt = require('jsonwebtoken');

const SECRET = () => process.env.JWT_SECRET;

function _verify(req, res, next, requiredRole) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ ok: false, error: 'Authentication required.' });

  try {
    const decoded = jwt.verify(token, SECRET());
    if (requiredRole && decoded.role !== requiredRole) {
      return res.status(403).json({ ok: false, error: 'Insufficient permissions.' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Invalid or expired token.' });
  }
}

/** Requires a valid JWT with role === 'instructor'. */
function requireInstructorJwt(req, res, next) {
  _verify(req, res, next, 'instructor');
}

/** Requires a valid JWT with role === 'student'. */
function requireStudentJwt(req, res, next) {
  _verify(req, res, next, 'student');
}

/**
 * Attaches decoded JWT as req.user if a valid Bearer token is present.
 * Never rejects — lets the route handler decide what to do.
 */
function optionalJwt(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (token) {
    try {
      req.user = jwt.verify(token, SECRET());
    } catch (_) {
      // ignore invalid tokens — treat as guest
    }
  }
  next();
}

function signToken(payload) {
  return jwt.sign(payload, SECRET(), { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
}

module.exports = { requireInstructorJwt, requireStudentJwt, optionalJwt, signToken };
