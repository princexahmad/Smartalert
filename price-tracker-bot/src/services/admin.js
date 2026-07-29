const logger = require('../utils/logger');
const config = require('../config');
const db = require('../database/connection');
const userQueries = require('../database/queries/users');
const productQueries = require('../database/queries/products');
const subscriptionQueries = require('../database/queries/subscriptions');
const logQueries = require('../database/queries/logs');

const adminService = {
  async getDashboardStats() {
    const [userStats, productStats, subscriptionStats, logStats, productPlatformStats] = await Promise.all([
      userQueries.getUserStats(),
      db.query('SELECT COUNT(*) as total FROM products WHERE is_active = true'),
      subscriptionQueries.getSubscriptionStats(),
      logQueries.getLogStats(),
      productQueries.getProductCountByPlatform(),
    ]);

    return {
      users: userStats,
      products: {
        total: parseInt(productStats.rows[0].total, 10),
        byPlatform: productPlatformStats.reduce((acc, row) => {
          acc[row.platform] = parseInt(row.count, 10);
          return acc;
        }, {}),
      },
      subscriptions: subscriptionStats,
      logs: logStats,
    };
  },

  async getPendingApprovals() {
    const result = await db.query(
      `SELECT s.*, u.telegram_id, u.username, u.first_name, u.last_name,
              p.name as plan_name, p.price_inr, p.code as plan_code
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       JOIN plans p ON s.plan_id = p.id
       WHERE s.status = 'pending'
       ORDER BY s.created_at DESC`
    );
    return result.rows;
  },

  async approveSubscription(subscriptionId, adminId) {
    const sub = await subscriptionQueries.approve(subscriptionId, adminId);
    await logQueries.log(adminId, 'approve_subscription', 'subscription', subscriptionId, {
      userId: sub.user_id,
      planId: sub.plan_id,
    });
    logger.info('Subscription approved', { subscriptionId, adminId });
    return sub;
  },

  async rejectSubscription(subscriptionId, adminId, reason) {
    const sub = await subscriptionQueries.reject(subscriptionId, adminId, reason);
    await logQueries.log(adminId, 'reject_subscription', 'subscription', subscriptionId, {
      userId: sub.user_id,
      reason,
    });
    logger.info('Subscription rejected', { subscriptionId, adminId });
    return sub;
  },

  async broadcastMessage(bot, message, adminId) {
    const { users } = await userQueries.getAllUsers(1, 10000);
    let sent = 0;
    let failed = 0;

    for (const user of users) {
      if (!user.is_active) continue;
      try {
        await bot.telegram.sendMessage(user.telegram_id, message, {
          parse_mode: 'Markdown',
        });
        sent++;
      } catch (error) {
        failed++;
        logger.error('Broadcast failed', { userId: user.id, error: error.message });
      }
    }

    await logQueries.log(adminId, 'broadcast', 'message', null, {
      message: message.substring(0, 100),
      sent,
      failed,
    });

    return { sent, failed, total: users.length };
  },

  async getUserDetails(userId) {
    const user = await userQueries.findById(userId);
    if (!user) return null;

    const subscription = await subscriptionQueries.getActiveSubscription(userId);
    const products = await productQueries.findByUser(userId, 1, 100);

    return {
      ...user,
      subscription,
      products: products.products,
    };
  },

  getAdminIds() {
    return config.admin.ids;
  },

  isAdmin(telegramId) {
    return config.admin.ids.includes(Number(telegramId));
  },
};

module.exports = adminService;
