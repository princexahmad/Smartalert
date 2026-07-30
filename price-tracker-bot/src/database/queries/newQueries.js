const db = require('../connection');

const newQueries = {
  // ===== USER PROFILES =====
  async getProfile(userId) {
    const result = await db.query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]);
    if (!result.rows[0]) {
      const created = await db.query(
        'INSERT INTO user_profiles (user_id) VALUES ($1) RETURNING *', [userId]
      );
      return created.rows[0];
    }
    return result.rows[0];
  },

  async updateProfile(userId, data) {
    const sets = []; const vals = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      sets.push(`${k} = $${idx++}`);
      vals.push(v);
    }
    vals.push(userId);
    const result = await db.query(
      `UPDATE user_profiles SET ${sets.join(', ')}, updated_at = NOW() WHERE user_id = $${idx} RETURNING *`,
      vals
    );
    return result.rows[0];
  },

  // ===== ALERT TYPES =====
  async getAlertTypes() {
    const result = await db.query('SELECT * FROM alert_types WHERE is_active = true');
    return result.rows;
  },

  // ===== PRODUCT ALERT TYPES =====
  async setProductAlertTypes(productId, alertTypes, targetPrice, pincode) {
    await db.query('DELETE FROM product_alert_types WHERE product_id = $1', [productId]);
    for (const at of alertTypes) {
      const atRow = await db.query("SELECT id FROM alert_types WHERE code = $1", [at]);
      if (atRow.rows[0]) {
        await db.query(
          `INSERT INTO product_alert_types (product_id, alert_type_id, target_price, pincode)
           VALUES ($1, $2, $3, $4)`,
          [productId, atRow.rows[0].id, at === 'price_drop' ? targetPrice : null, at === 'pincode' ? pincode : null]
        );
      }
    }
  },

  async getProductAlertTypes(productId) {
    const result = await db.query(
      `SELECT at.code, at.name, at.icon, pat.target_price, pat.pincode
       FROM product_alert_types pat
       JOIN alert_types at ON pat.alert_type_id = at.id
       WHERE pat.product_id = $1`,
      [productId]
    );
    return result.rows;
  },

  // ===== ALERT HISTORY =====
  async addAlertHistory(userId, productId, data) {
    const result = await db.query(
      `INSERT INTO alert_history (user_id, product_id, alert_type, title, message, old_value, new_value,
        current_price, previous_price, discount_percentage, in_stock, delivery_available)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [userId, productId, data.alertType, data.title, data.message, data.oldValue, data.newValue,
       data.currentPrice, data.previousPrice, data.discount, data.inStock, data.deliveryAvailable]
    );
    return result.rows[0];
  },

  async getAlertHistory(userId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const [items, count] = await Promise.all([
      db.query(
        `SELECT ah.*, p.title as product_title, p.url, p.image_url
         FROM alert_history ah
         LEFT JOIN products p ON ah.product_id = p.id
         WHERE ah.user_id = $1
         ORDER BY ah.created_at DESC LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      db.query('SELECT COUNT(*) FROM alert_history WHERE user_id = $1', [userId]),
    ]);
    return { alerts: items.rows, total: parseInt(count.rows[0].count), page, totalPages: Math.ceil(parseInt(count.rows[0].count) / limit) };
  },

  async markAlertRead(alertId) {
    await db.query('UPDATE alert_history SET is_read = true WHERE id = $1', [alertId]);
  },

  // ===== ADMIN PLANS =====
  async getAdminPlans() {
    const result = await db.query('SELECT * FROM admin_plans ORDER BY price_inr ASC');
    return result.rows;
  },

  async getAdminPlan(id) {
    const result = await db.query('SELECT * FROM admin_plans WHERE id = $1', [id]);
    return result.rows[0];
  },

  async createAdminPlan(data) {
    const result = await db.query(
      `INSERT INTO admin_plans (name, code, description, price_inr, duration_days, max_alerts, max_products, features)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [data.name, data.code, data.description, data.price, data.duration, data.maxAlerts, data.maxProducts, JSON.stringify(data.features)]
    );
    return result.rows[0];
  },

  async updateAdminPlan(id, data) {
    const sets = []; const vals = []; let idx = 1;
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) { sets.push(`${k} = $${idx++}`); vals.push(v); }
    }
    vals.push(id);
    const result = await db.query(
      `UPDATE admin_plans SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      vals
    );
    return result.rows[0];
  },

  async toggleAdminPlan(id) {
    const result = await db.query(
      'UPDATE admin_plans SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING *', [id]
    );
    return result.rows[0];
  },

  async deleteAdminPlan(id) {
    await db.query('DELETE FROM admin_plans WHERE id = $1 AND is_deletable = true', [id]);
  },

  // ===== ANALYTICS =====
  async incrementMetric(metric, by = 1) {
    await db.query(
      `INSERT INTO analytics (date, metric, value) VALUES (CURRENT_DATE, $1, $2)
       ON CONFLICT (date, metric) DO UPDATE SET value = analytics.value + $2`,
      [metric, by]
    );
  },

  async getAnalytics(days = 7) {
    const result = await db.query(
      `SELECT metric, SUM(value) as total FROM analytics
       WHERE date >= CURRENT_DATE - INTERVAL '1 day' * $1
       GROUP BY metric ORDER BY metric`,
      [days]
    );
    return result.rows;
  },
};

module.exports = newQueries;
