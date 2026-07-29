const fs = require('fs');
const path = require('path');
const db = require('./connection');
const logger = require('../utils/logger');

async function runMigrations() {
  logger.info('Running database migrations...');

  const schemaPath = path.join(__dirname, '../../sql/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  try {
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement) {
        try {
          await db.query(statement + ';');
        } catch (error) {
          if (error.code !== '42P07' && error.code !== '42710' &&
              error.code !== '23505' && !error.message.includes('already exists')) {
            throw error;
          }
          logger.debug('Skipping existing object', { statement: statement.substring(0, 50) });
        }
      }
    }

    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed', { error: error.message });
    throw error;
  }
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  runMigrations()
    .then(() => {
      logger.info('Migrations complete');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Migration error', { error: err.message });
      process.exit(1);
    });
}

module.exports = { runMigrations };
