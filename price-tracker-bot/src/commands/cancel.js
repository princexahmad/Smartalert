const subscriptionQueries = require('../database/queries/subscriptions');
const logger = require('../utils/logger');
const logQueries = require('../database/queries/logs');

async function cancelCommand(ctx) {
  try {
    const activeSub = await subscriptionQueries.getActiveSubscription(ctx.user.id);
    if (!activeSub) {
      return ctx.reply('You do not have an active subscription to cancel.');
    }

    await subscriptionQueries.cancel(activeSub.id);
    await logQueries.log(ctx.user.id, 'cancel_subscription', 'subscription', activeSub.id, {});

    await ctx.reply(
      '*✅ Subscription Cancelled*\n\n' +
      `Your ${activeSub.plan_name} subscription has been cancelled.\n` +
      'You will continue to have access until the current billing period ends.\n\n' +
      `Expires: ${new Date(activeSub.end_date).toLocaleDateString('en-IN')}\n\n` +
      'You can re-subscribe anytime with /upgrade.',
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    logger.error('Error cancelling subscription', { error: error.message });
    await ctx.reply('Failed to cancel subscription. Please try again.');
  }
}

module.exports = cancelCommand;
