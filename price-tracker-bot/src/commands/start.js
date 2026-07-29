const { mainKeyboard } = require('../bot/keyboard');
const notificationService = require('../services/notification');
const subscriptionService = require('../services/subscription');

async function startCommand(ctx) {
  const user = ctx.user;
  const plan = await subscriptionService.getUserPlan(user.id);

  const welcomeText = [
    `*Welcome to Price Tracker Bot, ${user.first_name || 'User'}!*`,
    '',
    'I help you track prices on Amazon India and Flipkart.',
    'Get instant alerts when prices drop to your target!',
    '',
    `*Your Plan:* ${plan.plan_name}`,
    `*Products:* ${plan.product_count}/${plan.product_limit}`,
    '',
    'Send /help to see all commands.',
    'Send /add <url> <price> to start tracking a product.',
  ].join('\n');

  await ctx.replyWithPhoto(
    { url: 'https://img.freepik.com/free-vector/price-tag-concept-illustration_114360-3194.jpg' },
    {
      caption: welcomeText,
      parse_mode: 'Markdown',
      reply_markup: mainKeyboard().reply_markup,
    }
  );
}

module.exports = startCommand;
