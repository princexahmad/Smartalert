const fs = require('fs');
const path = require('path');
const db = require('./connection');
const logger = require('../utils/logger');

async function runMigrations() {
  logger.info('Running database migrations...');

  const schemaPath = path.join(__dirname, '../../sql/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    let stmt = statements[i];

    stmt = stmt.trim();
    if (!stmt) continue;

    try {
      await db.query(stmt.endsWith(';') ? stmt : stmt + ';');
    } catch (error) {
      logger.warn('Migration skipped', {
        error: error.message.substring(0, 100),
        stmt: stmt.replace(/\s+/g, ' ').substring(0, 80),
      });
    }
  }

  const extraStatements = [
    `CREATE OR REPLACE FUNCTION update_updated_at_column()
     RETURNS TRIGGER AS $func$
     BEGIN
         NEW.updated_at = NOW();
         RETURN NEW;
     END;
     $func$ language 'plpgsql'`,

    `CREATE TRIGGER update_users_updated_at
     BEFORE UPDATE ON users FOR EACH ROW
     EXECUTE FUNCTION update_updated_at_column()`,

    `CREATE TRIGGER update_subscriptions_updated_at
     BEFORE UPDATE ON subscriptions FOR EACH ROW
     EXECUTE FUNCTION update_updated_at_column()`,

    `CREATE TRIGGER update_products_updated_at
     BEFORE UPDATE ON products FOR EACH ROW
     EXECUTE FUNCTION update_updated_at_column()`,
  ];

  for (const stmt of extraStatements) {
    try {
      await db.query(stmt);
    } catch (error) {
      logger.warn('Extra statement skipped', { error: error.message.substring(0, 100) });
    }
  }

  logger.info('Database migrations completed');
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
