const fs = require('fs');
const path = require('path');
const db = require('./connection');
const logger = require('../utils/logger');
const { Pool } = require('pg');
const config = require('../config');

async function runMigrations() {
  logger.info('Running database migrations...');

  const schemaPath = path.join(__dirname, '../../sql/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  const pool = new Pool({
    connectionString: config.database.url,
  });

  const client = await pool.connect();
  try {
    const lines = schema.split('\n').filter(l => l.trim() && !l.trim().startsWith('--'));
    const schemaClean = lines.join('\n');

    await client.query(schemaClean);
    logger.info('Core schema created');

    const extra = [
      `CREATE OR REPLACE FUNCTION update_updated_at_column()
       RETURNS TRIGGER AS $func$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $func$ language 'plpgsql'`,
      `CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
      `CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
    ];

    for (const stmt of extra) {
      try {
        await client.query(stmt);
      } catch (e) {
        logger.warn('Extra skipped: ' + e.message.substring(0, 80));
      }
    }

    logger.info('Database migrations completed');
  } catch (error) {
    logger.error('Migration failed', { error: error.message });
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Migration error', { error: err.message });
      process.exit(1);
    });
}

module.exports = { runMigrations };
