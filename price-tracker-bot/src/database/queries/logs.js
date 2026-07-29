const db = require('../connection');

const logQueries = {
  async log(userId, action, entityType, entityId, details, level = 'info') {
    const result = await db.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, level)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, action, entityType, entityId, JSON.stringify(details || {}), level]
    );
    return result.rows[0];
  },

  async getLogs(page = 1, limit = 50, filters = {}) {
    const offset = (page - 1) * limit;
    let whereClause = '1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.userId) {
      whereClause += ` AND user_id = $${paramIndex++}`;
      params.push(filters.userId);
    }
    if (filters.action) {
      whereClause += ` AND action = $${paramIndex++}`;
      params.push(filters.action);
    }
    if (filters.level) {
      whereClause += ` AND level = $${paramIndex++}`;
      params.push(filters.level);
    }
    if (filters.fromDate) {
      whereClause += ` AND created_at >= $${paramIndex++}`;
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      whereClause += ` AND created_at <= $${paramIndex++}`;
      params.push(filters.toDate);
    }

    params.push(limit, offset);
    const [itemsResult, countResult] = await Promise.all([
      db.query(
        `SELECT al.*, u.username, u.first_name
         FROM activity_logs al
         LEFT JOIN users u ON al.user_id = u.id
         WHERE ${whereClause}
         ORDER BY al.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        params
      ),
      db.query(
        `SELECT COUNT(*) FROM activity_logs WHERE ${whereClause}`,
        params.slice(0, -2)
      ),
    ]);

    return {
      logs: itemsResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      totalPages: Math.ceil(parseInt(countResult.rows[0].count, 10) / limit),
    };
  },

  async getLogStats() {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_logs,
        COUNT(CASE WHEN level = 'error' THEN 1 END) as error_count,
        COUNT(CASE WHEN level = 'warn' THEN 1 END) as warn_count,
        COUNT(DISTINCT action) as unique_actions
      FROM activity_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    return result.rows[0];
  },

  async cleanupOldLogs(daysToKeep = 30) {
    const result = await db.query(
      'DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL \'1 day\' * $1',
      [daysToKeep]
    );
    return result.rowCount;
  },
};

module.exports = logQueries;
