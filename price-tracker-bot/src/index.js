require('dotenv').config();

const logger = require('./utils/logger');
const config = require('./config');
const { runMigrations } = require('./database/migrate');
const { createBot } = require('./bot');
const { startMonitor, stopMonitor } = require('./services/monitor');
const { closeAll } = require('./scraper');
const db = require('./database/connection');

async function main() {
  logger.info('Starting Price Tracker Bot...');
  logger.info(`Environment: ${config.env}`);

  try {
    await runMigrations();
    logger.info('Database ready');
  } catch (error) {
    logger.error('Database migration failed', { error: error.message });
    process.exit(1);
  }

  const bot = createBot();

  startMonitor(bot);
  logger.info('Price monitor started');

  bot.launch({ dropPendingUpdates: true });
  logger.info('Bot launched successfully');

  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    stopMonitor();
    bot.stop(signal);
    await closeAll();
    await db.close();
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason: String(reason) });
  });
}

main();
