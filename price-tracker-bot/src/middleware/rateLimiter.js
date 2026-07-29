const config = require('../config');
const logger = require('../utils/logger');

const userRequests = new Map();

function rateLimiter(ctx, next) {
  const userId = ctx.from?.id;
  if (!userId) return next();

  const now = Date.now();
  const windowMs = config.rateLimit.windowMs;
  const maxRequests = config.rateLimit.maxRequests;

  if (!userRequests.has(userId)) {
    userRequests.set(userId, []);
  }

  const timestamps = userRequests.get(userId).filter(t => now - t < windowMs);
  timestamps.push(now);
  userRequests.set(userId, timestamps);

  if (timestamps.length > maxRequests) {
    logger.warn('Rate limit exceeded', { userId, count: timestamps.length });
    return ctx.reply(
      'You are sending too many requests. Please wait a moment and try again.'
    );
  }

  return next();
}

function cleanupRateLimiter() {
  const now = Date.now();
  const windowMs = config.rateLimit.windowMs;
  for (const [userId, timestamps] of userRequests.entries()) {
    const valid = timestamps.filter(t => now - t < windowMs);
    if (valid.length === 0) {
      userRequests.delete(userId);
    } else {
      userRequests.set(userId, valid);
    }
  }
}

setInterval(cleanupRateLimiter, 60000);

module.exports = { rateLimiter };
