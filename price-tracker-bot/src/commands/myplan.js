const subscriptionService = require('../services/subscription');
const userQueries = require('../database/queries/users');
const { buildPlanMessage } = require('../services/notification');

async function myplanCommand(ctx) {
  try {
    const plan = await subscriptionService.getUserPlan(ctx.user.id);
    const user = ctx.user;

    await ctx.reply(buildPlanMessage(user, plan, plan), {
      parse_mode: 'Markdown',
    });
  } catch (error) {
    await ctx.reply('Failed to fetch your plan details. Please try again.');
  }
}

module.exports = myplanCommand;
