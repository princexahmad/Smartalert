require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
  timezone: process.env.TIMEZONE || 'Asia/Kolkata',

  bot: {
    token: process.env.BOT_TOKEN,
    username: process.env.BOT_USERNAME || '@PriceTrackerBot',
  },

  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'price_tracker',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    poolMin: parseInt(process.env.DB_POOL_MIN, 10) || 2,
    poolMax: parseInt(process.env.DB_POOL_MAX, 10) || 10,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    enabled: process.env.REDIS_ENABLED === 'true',
  },

  admin: {
    ids: (process.env.ADMIN_IDS || '').split(',').map(Number).filter(Boolean),
    usernames: (process.env.ADMIN_USERNAMES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  },

  plans: {
    free: {
      productLimit: parseInt(process.env.FREE_PRODUCT_LIMIT, 10) || 5,
      monitorInterval: parseInt(process.env.FREE_MONITOR_INTERVAL, 10) || 30,
    },
    premium: {
      productLimit: parseInt(process.env.PREMIUM_PRODUCT_LIMIT, 10) || 100,
      monitorInterval: parseInt(process.env.PREMIUM_MONITOR_INTERVAL, 10) || 10,
      price: parseFloat(process.env.PREMIUM_PRICE) || 499,
    },
  },

  monitor: {
    intervalMinutes: parseInt(process.env.MONITOR_INTERVAL_MINUTES, 10) || 10,
    batchSize: parseInt(process.env.MONITOR_BATCH_SIZE, 10) || 10,
    retryAttempts: parseInt(process.env.MONITOR_RETRY_ATTEMPTS, 10) || 3,
    retryDelayMs: parseInt(process.env.MONITOR_RETRY_DELAY_MS, 10) || 5000,
  },

  scraper: {
    timeout: parseInt(process.env.SCRAPER_TIMEOUT, 10) || 30000,
    userAgent: process.env.SCRAPER_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    headless: process.env.SCRAPER_HEADLESS !== 'false',
    viewport: {
      width: parseInt(process.env.SCRAPER_VIEWPORT_WIDTH, 10) || 1280,
      height: parseInt(process.env.SCRAPER_VIEWPORT_HEIGHT, 10) || 720,
    },
  },

  api: {
    port: parseInt(process.env.API_PORT, 10) || 3000,
    host: process.env.API_HOST || '0.0.0.0',
    key: process.env.API_KEY || '',
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 20,
  },

  app: {
    maxProductTitleLength: parseInt(process.env.MAX_PRODUCT_TITLE_LENGTH, 10) || 200,
    priceAlertThreshold: parseFloat(process.env.PRICE_ALERT_THRESHOLD) || 0,
    logLevel: process.env.LOG_LEVEL || 'info',
  },
};

const requiredVars = ['BOT_TOKEN'];
for (const v of requiredVars) {
  if (!process.env[v]) {
    throw new Error(`Missing required environment variable: ${v}`);
  }
}

module.exports = config;
