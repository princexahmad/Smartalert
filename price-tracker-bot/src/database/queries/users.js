const db = require('../connection');

const userQueries = {
  async findById(id) {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  },

  async findByTelegramId(telegramId) {
    const result = await db.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
    return result.rows[0];
  },

  async create(telegramId, username, firstName, lastName, languageCode) {
    const result = await db.query(
      `INSERT INTO users (telegram_id, username, first_name, last_name, language_code)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (telegram_id)
       DO UPDATE SET
         username = COALESCE($2, users.username),
         first_name = COALESCE($3, users.first_name),
         last_name = COALESCE($4, users.last_name),
         language_code = COALESCE($5, users.language_code),
         is_active = true,
         last_active_at = NOW()
       RETURNING *`,
      [telegramId, username, firstName, lastName, languageCode]
    );
    return result.rows[0];
  },

  async updateActivity(telegramId) {
    await db.query(
      'UPDATE users SET last_active_at = NOW() WHERE telegram_id = $1',
      [telegramId]
    );
  },

  async getAllUsers(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [usersResult, countResult] = await Promise.all([
      db.query(
        'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      ),
      db.query('SELECT COUNT(*) FROM users'),
    ]);
    return {
      users: usersResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      totalPages: Math.ceil(parseInt(countResult.rows[0].count, 10) / limit),
    };
  },

  async getUserStats() {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN is_active THEN 1 END) as active_users,
        COUNT(CASE WHEN is_approved THEN 1 END) as approved_users,
        COUNT(CASE WHEN is_admin THEN 1 END) as admin_users
      FROM users
    `);
    return result.rows[0];
  },

  async approveUser(userId, adminId) {
    const result = await db.query(
      `UPDATE users SET is_approved = true, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [userId]
    );
    return result.rows[0];
  },

  async toggleAdmin(userId) {
    const result = await db.query(
      `UPDATE users SET is_admin = NOT is_admin, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [userId]
    );
    return result.rows[0];
  },

  async deactivateUser(userId) {
    const result = await db.query(
      `UPDATE users SET is_active = false, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [userId]
    );
    return result.rows[0];
  },
};

module.exports = userQueries;
