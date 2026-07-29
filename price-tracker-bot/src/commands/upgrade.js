const db = require('../database/connection');
const logger = require('../utils/logger');
const logQueries = require('../database/queries/logs');
const { upgradeKeyboard } = require('../bot/keyboard');

async function upgradeCommand(ctx) {
  try {
    const plans = await db.query(
      'SELECT * FROM plans WHERE is_active = true ORDER BY price_inr ASC'
    );

    const message = [
      '* Upgrade Your Plan*',
      '',
      'Unlock more features and track more products!',
      '',
      ...plans.rows.map((plan, i) => {
        const features = plan.features || {};
        const featureList = Object.entries(features)
          .map(([key, val]) => `  ${val ? '✅' : '❌'} ${key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`)
          .join('\n');

        return [
          `*${i + 1}. ${plan.name}*`,
          `   Price: ₹${plan.price_inr}${plan.duration_days > 0 ? `/${plan.duration_days} days` : ''}`,
          `   Products: Up to ${plan.product_limit}`,
          `   Check Interval: Every ${plan.monitor_interval_minutes} minutes`,
          '',
          featureList,
        ].join('\n');
      }),
      '',
      'To upgrade, click on a plan below and an admin will approve your subscription.',
    ].join('\n');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: upgradeKeyboard().reply_markup,
    });
  } catch (error) {
    logger.error('Error showing upgrade options', { error: error.message });
    await ctx.reply('Failed to load upgrade options. Please try again.');
  }
}

module.exports = upgradeCommand;
