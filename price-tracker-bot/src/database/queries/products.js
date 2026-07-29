const db = require('../connection');

const productQueries = {
  async create(userId, data) {
    const result = await db.query(
      `INSERT INTO products (
        user_id, url, platform, platform_product_id, title, image_url,
        current_price, target_price, currency, in_stock, stock_status,
        delivery_available, seller_name, rating, category, brand
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (user_id, url)
      DO UPDATE SET
        target_price = COALESCE($8, products.target_price),
        is_active = true,
        updated_at = NOW()
      RETURNING *`,
      [
        userId, data.url, data.platform, data.platformProductId,
        data.title, data.imageUrl, data.currentPrice, data.targetPrice,
        data.currency || 'INR', data.inStock, data.stockStatus,
        data.deliveryAvailable, data.sellerName, data.rating,
        data.category, data.brand,
      ]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query('SELECT * FROM products WHERE id = $1', [id]);
    return result.rows[0];
  },

  async findByUserAndUrl(userId, url) {
    const result = await db.query(
      'SELECT * FROM products WHERE user_id = $1 AND url = $2',
      [userId, url]
    );
    return result.rows[0];
  },

  async findByUser(userId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [itemsResult, countResult] = await Promise.all([
      db.query(
        'SELECT * FROM products WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [userId, limit, offset]
      ),
      db.query(
        'SELECT COUNT(*) FROM products WHERE user_id = $1 AND is_active = true',
        [userId]
      ),
    ]);
    return {
      products: itemsResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      totalPages: Math.ceil(parseInt(countResult.rows[0].count, 10) / limit),
    };
  },

  async getUserProductCount(userId) {
    const result = await db.query(
      'SELECT COUNT(*) FROM products WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  },

  async updatePrice(id, priceData) {
    const result = await db.query(
      `UPDATE products SET
        current_price = $2,
        previous_price = COALESCE(current_price, $2),
        in_stock = $3,
        stock_status = $4,
        delivery_available = $5,
        seller_name = COALESCE($6, seller_name),
        title = COALESCE($7, title),
        image_url = COALESCE($8, image_url),
        discount_percentage = $9,
        last_checked_at = NOW(),
        next_check_at = NOW() + INTERVAL '10 minutes',
        price_change_count = CASE WHEN current_price IS NOT NULL AND current_price != $2 THEN price_change_count + 1 ELSE price_change_count END,
        last_price_change_at = CASE WHEN current_price IS NOT NULL AND current_price != $2 THEN NOW() ELSE last_price_change_at END,
        error_count = 0,
        last_error_message = NULL,
        updated_at = NOW()
      WHERE id = $1 RETURNING *`,
      [
        id, priceData.currentPrice, priceData.inStock, priceData.stockStatus,
        priceData.deliveryAvailable, priceData.sellerName, priceData.title,
        priceData.imageUrl, priceData.discountPercentage,
      ]
    );
    return result.rows[0];
  },

  async markError(id, errorMessage) {
    await db.query(
      `UPDATE products SET
        error_count = error_count + 1,
        last_error_message = $2,
        last_checked_at = NOW(),
        next_check_at = NOW() + INTERVAL '30 minutes',
        updated_at = NOW()
      WHERE id = $1`,
      [id, errorMessage]
    );
  },

  async deactivate(id) {
    const result = await db.query(
      'UPDATE products SET is_active = false WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  },

  async remove(id, userId) {
    const result = await db.query(
      'DELETE FROM products WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    return result.rows[0];
  },

  async getProductsDueForCheck(limit = 10) {
    const result = await db.query(
      `SELECT p.*, u.telegram_id,
              COALESCE(s.end_date > NOW(), false) as is_premium,
              COALESCE(pl.monitor_interval_minutes, 30) as interval_minutes
       FROM products p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
       LEFT JOIN plans pl ON COALESCE(s.plan_id, (SELECT id FROM plans WHERE code = 'free')) = pl.id
       WHERE p.is_active = true
         AND (p.next_check_at IS NULL OR p.next_check_at <= NOW())
       ORDER BY p.next_check_at ASC NULLS FIRST
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  },

  async getAllActiveProducts() {
    const result = await db.query(
      `SELECT p.*, u.telegram_id
       FROM products p
       JOIN users u ON p.user_id = u.id
       WHERE p.is_active = true AND u.is_active = true`
    );
    return result.rows;
  },

  async getProductCountByPlatform() {
    const result = await db.query(`
      SELECT platform, COUNT(*) as count
      FROM products WHERE is_active = true
      GROUP BY platform
    `);
    return result.rows;
  },
};

module.exports = productQueries;
