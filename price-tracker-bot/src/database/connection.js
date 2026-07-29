const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: config.database.url,
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      min: config.database.poolMin,
      max: config.database.poolMax,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', { error: err.message });
    });

    pool.on('connect', () => {
      logger.debug('New database client connected');
    });
  }
  return pool;
}

async function query(text, params) {
  const client = await getPool().connect();
  try {
    const start = Date.now();
    const result = await client.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Query executed', { text: text.substring(0, 80), duration, rows: result.rowCount });
    return result;
  } finally {
    client.release();
  }
}

async function transaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function healthCheck() {
  try {
    const result = await query('SELECT NOW()');
    return { status: 'healthy', timestamp: result.rows[0].now };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}

module.exports = {
  getPool,
  query,
  transaction,
  healthCheck,
  close,
};
