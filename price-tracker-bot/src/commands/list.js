const logger = require('../utils/logger');
const productQueries = require('../database/queries/products');
const { buildProductListMessage } = require('../services/notification');
const { productListKeyboard } = require('../bot/keyboard');

async function listCommand(ctx) {
  try {
    const result = await productQueries.findByUser(ctx.user.id, 1, 10);

    const message = buildProductListMessage(result.products, 1, result.totalPages);
    const keyboard = productListKeyboard(result.products, 1, result.totalPages);

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup,
    });
  } catch (error) {
    logger.error('Error listing products', { error: error.message });
    await ctx.reply('Failed to fetch your products. Please try again.');
  }
}

module.exports = listCommand;
