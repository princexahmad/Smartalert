const db = require('../connection');

const subscriptionQueries = {
  async create(userId, planId, paymentMethod = null, paymentId = null) {
    const plan = await db.query('SELECT * FROM plans WHERE id = $1', [planId]);
    if (!plan.rows[0]) throw new Error('Invalid plan');

    const result = await db.query(
      `INSERT INTO subscriptions (user_id, plan_id, status, payment_method, payment_id, payment_amount, payment_currency)
       VALUES ($1, $2, 'pending', $3, $4, $5, 'INR')
       RETURNING *`,
      [userId, planId, paymentMethod, paymentId, plan.rows[0].price_inr]
    );
    return result.rows[0];
  },

  async approve(subscriptionId, adminId) {
    const sub = await db.query('SELECT * FROM subscriptions WHERE id = $1', [subscriptionId]);
    if (!sub.rows[0]) throw new Error('Subscription not found');

    const plan = await db.query('SELECT * FROM plans WHERE id = $1', [sub.rows[0].plan_id]);

    const result = await db.query(
      `UPDATE subscriptions SET
        status = 'active',
        start_date = NOW(),
        end_date = NOW() + INTERVAL '1 day' * $2,
        approved_by = $3,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = $1 RETURNING *`,
      [subscriptionId, plan.rows[0].duration_days, adminId]
    );

    await db.query(
      'UPDATE users SET is_approved = true WHERE id = $1',
      [sub.rows[0].user_id]
    );

    return result.rows[0];
  },

  async reject(subscriptionId, adminId, reason) {
    const result = await db.query(
      `UPDATE subscriptions SET
        status = 'rejected',
        notes = $3,
        approved_by = $4,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = $1 RETURNING *`,
      [subscriptionId, adminId, reason]
    );
    return result.rows[0];
  },

  async cancel(subscriptionId) {
    const result = await db.query(
      `UPDATE subscriptions SET
        status = 'cancelled',
        end_date = NOW(),
        updated_at = NOW()
      WHERE id = $1 RETURNING *`,
      [subscriptionId]
    );
    return result.rows[0];
  },

  async getActiveSubscription(userId) {
    const result = await db.query(
      `SELECT s.*, p.name as plan_name, p.code as plan_code,
              p.product_limit, p.monitor_interval_minutes, p.features
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.user_id = $1
         AND s.status = 'active'
         AND s.end_date > NOW()
       ORDER BY s.end_date DESC
       LIMIT 1`,
      [userId]
    );
    return result.rows[0];
  },

  async getPendingSubscriptions() {
    const result = await db.query(
      `SELECT s.*, u.telegram_id, u.username, u.first_name, u.last_name,
              p.name as plan_name, p.price_inr
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       JOIN plans p ON s.plan_id = p.id
       WHERE s.status = 'pending'
       ORDER BY s.created_at DESC`
    );
    return result.rows[0];
  },

  async getExpiringSoon(days = 3) {
    const result = await db.query(
      `SELECT s.*, u.telegram_id, u.username, p.name as plan_name
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       JOIN plans p ON s.plan_id = p.id
       WHERE s.status = 'active'
         AND s.end_date BETWEEN NOW() AND NOW() + INTERVAL '1 day' * $1`,
      [days]
    );
    return result.rows;
  },

  async getExpiredSubscriptions() {
    const result = await db.query(
      `SELECT s.*, u.telegram_id, p.name as plan_name
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       JOIN plans p ON s.plan_id = p.id
       WHERE s.status = 'active' AND s.end_date <= NOW()`
    );
    return result.rows;
  },

  async expireSubscription(id) {
    await db.query(
      `UPDATE subscriptions SET status = 'expired', updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  },

  async getSubscriptionStats() {
    const result = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
      FROM subscriptions
    `);
    return result.rows[0];
  },
};

module.exports = subscriptionQueries;
