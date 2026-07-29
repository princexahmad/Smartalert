const config = require('../config');
const userQueries = require('../database/queries/users');
const subscriptionQueries = require('../database/queries/subscriptions');
const productQueries = require('../database/queries/products');

const subscriptionService = {
  async getUserPlan(userId) {
    const activeSub = await subscriptionQueries.getActiveSubscription(userId);
    if (activeSub) {
      const productCount = await productQueries.getUserProductCount(userId);
      return {
        ...activeSub,
        product_count: productCount,
      };
    }

    const [freePlan, productCount] = await Promise.all([
      subscriptionQueries.getActiveSubscription(userId).catch(() => null),
      productQueries.getUserProductCount(userId),
    ]);

    return {
      plan_name: 'Free',
      plan_code: 'free',
      product_limit: config.plans.free.productLimit,
      monitor_interval_minutes: config.plans.free.monitorInterval,
      status: 'active',
      product_count: productCount,
      features: {
        max_products: config.plans.free.productLimit,
        price_alerts: true,
        stock_alerts: true,
        delivery_alerts: false,
        api_access: false,
        priority_support: false,
      },
    };
  },

  async canAddProduct(userId) {
    const plan = await this.getUserPlan(userId);
    return plan.product_count < plan.product_limit;
  },

  async getProductLimit(userId) {
    const plan = await this.getUserPlan(userId);
    return plan.product_limit;
  },

  async getMonitorInterval(userId) {
    const plan = await this.getUserPlan(userId);
    return plan.monitor_interval_minutes || config.plans.free.monitorInterval;
  },
};

module.exports = subscriptionService;
