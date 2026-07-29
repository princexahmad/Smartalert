const { sleep } = require('./helpers');

async function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (error) => true,
    onRetry = null,
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      const jitter = Math.random() * 1000;

      if (onRetry) {
        onRetry({ attempt, maxAttempts, delay: delay + jitter, error });
      }

      await sleep(delay + jitter);
    }
  }

  throw lastError;
}

function isRetryableError(error) {
  const retryableMessages = [
    'timeout',
    'network',
    'econnrefused',
    'econnreset',
    'etimedout',
    'socket',
    'too many requests',
    '429',
    '503',
    '502',
    'service unavailable',
    'bad gateway',
    'internal server error',
    'rate limit',
  ];

  const message = (error.message || '').toLowerCase();
  return retryableMessages.some(msg => message.includes(msg));
}

module.exports = {
  withRetry,
  isRetryableError,
};
