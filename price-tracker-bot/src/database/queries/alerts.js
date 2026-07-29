const db = require('../connection');

const alertQueries = {
  async create(userId, productId, type, oldValue, newValue, messageText) {
    const result = await db.query(
      `INSERT INTO alerts (user_id, product_id, alert_type, old_value, new_value, message_text)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, productId, type, String(oldValue || ''), String(newValue || ''), messageText]
    );
    return result.rows[0];
  },

  async markAsSent(alertId) {
    await db.query(
      'UPDATE alerts SET is_sent = true, sent_at = NOW() WHERE id = $1',
      [alertId]
    );
  },

  async getUnsentAlerts() {
    const result = await db.query(
      `SELECT a.*, p.title as product_title, p.url, p.image_url,
              u.telegram_id
       FROM alerts a
       JOIN products p ON a.product_id = p.id
       JOIN users u ON a.user_id = u.id
       WHERE a.is_sent = false
       ORDER BY a.created_at ASC`
    );
    return result.rows;
  },

  async getByUser(userId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [itemsResult, countResult] = await Promise.all([
      db.query(
        `SELECT a.*, p.title as product_title
         FROM alerts a
         JOIN products p ON a.product_id = p.id
         WHERE a.user_id = $1
         ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      db.query('SELECT COUNT(*) FROM alerts WHERE user_id = $1', [userId]),
    ]);
    return {
      alerts: itemsResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      totalPages: Math.ceil(parseInt(countResult.rows[0].count, 10) / limit),
    };
  },
};

module.exports = alertQueries;
