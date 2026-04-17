const Redis = require('ioredis');

// Prevent crashing if REDIS_URL isn't strictly set in local dev testing
let redisClient = null;
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL);
}

/**
 * Creates an Express middleware that enforces a sliding-window rate limit using Redis.
 * Falls back to allowing traffic if Redis is unavailable.
 */
exports.createRateLimiter = (prefix, maxRequests, windowMs) => {
  return async (req, res, next) => {
    if (!redisClient) return next();

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    let key = `${prefix}:${ip}`;
    
    // Specifically block brute forcing on individual emails if applicable
    if (req.body && req.body.email) {
      key = `${prefix}:${req.body.email.toLowerCase()}`;
    }

    try {
      const current = await redisClient.incr(key);
      if (current === 1) {
        await redisClient.pexpire(key, windowMs); // Set TTL on first request
      }
      
      if (current > maxRequests) {
        return res.status(429).json({ 
          success: false, 
          message: 'Too many requests, please try again later.' 
        });
      }
      
      next();
    } catch (error) {
      // Fail-open for graceful degradation if Redis fails
      next();
    }
  };
};

// =======================
// Derived Limiters
// =======================
exports.loginLimiter = exports.createRateLimiter('rl:login', 5, 15 * 60 * 1000);
exports.globalAuthLimiter = exports.createRateLimiter('rl:auth', 100, 15 * 60 * 1000);
exports.mfaLimiter = exports.createRateLimiter('rl:mfa', 3, 5 * 60 * 1000);
