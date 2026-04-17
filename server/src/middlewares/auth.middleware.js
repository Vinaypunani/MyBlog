/**
 * Authentication & Authorization Middlewares
 */

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

    // TODO: Verify JWT signature using RS256 Public Key (or JWKs)
    
    // TODO: Verify token is NOT in Redis Blacklist:
    // const isBlacklisted = await redisClient.get(`bl_${token_jti}`);
    // if (isBlacklisted) throw UnAuthorizedError
    
    // Stub payload binding
    req.user = { id: 'decoded_user_id', role: 'reader' };
    
    // TODO: Debounced update of Active Session logic in DB
    // e.g. update session.lastActiveAt if more than 5 minutes have passed

    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

/**
 * Validates granular RBAC permissions.
 * Reads user permissions optimally from Redis cache.
 */
exports.requirePermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated.' });
      }

      // TODO: Fetch user permissions from Redis cache (fallback to Mongo)
      // const permissions = await redisClient.smembers(`user:${req.user.id}:permissions`);
      const hasPermission = true; // Stub

      if (!hasPermission) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions.' });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
