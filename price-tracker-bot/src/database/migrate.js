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

    if (/create\s+(or\s+replace\s+)?function/i.test(stmt)) {
      while (i + 1 < statements.length) {
        const next = statements[i + 1];
        stmt += ';' + next;
        i++;
        if (/language\s+\w+\s*;?\s*$/i.test(next.replace(/\$\$/g, '').trim()) ||
            /end\s*;?\s*$/i.test(next.trim())) {
          break;
        }
      }
    }

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
