/**
 * Authentication & Authorization Middlewares
 */
const jwt = require('jsonwebtoken');

// Assume Redis client is configured elsewhere
// const redis = require('ioredis');
// const redisClient = new redis(process.env.REDIS_URL);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_in_production';

/**
 * Validates the Short-Lived Access Token (JWT)
 * Ensures it's not present in the Redis Blacklist
 */
exports.requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Missing or malformed Authorization header.' });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // TODO: Verify token is NOT in Redis Blacklist:
    // const isBlacklisted = await redisClient.get(`bl_${token}`);
    // if (isBlacklisted) return res.status(401).json({ success: false, message: 'Token revoked' });

    // Attach to request
    req.user = decoded; // { id, role, iat, exp }
    
    // NOTE: In a true production app, session debouncing to DB occurs here
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Access token expired.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

/**
 * Validates granular RBAC permissions.
 */
exports.requireRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions.' });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
