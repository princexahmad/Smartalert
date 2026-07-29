const logger = require('../utils/logger');
const productQueries = require('../database/queries/products');
const { buildProductInfoMessage } = require('../services/notification');
const { productActionsKeyboard } = require('../bot/keyboard');
const helpers = require('../utils/helpers');

async function statusCommand(ctx) {
  const text = ctx.message?.text?.trim();
  if (!text || text === '/status') {
    return ctx.reply(
      'Usage: `/status <product_id>`\n\n' +
      'Use /list to find the product ID.',
      { parse_mode: 'Markdown' }
    );
  }

  const productId = parseInt(text.replace('/status', '').trim(), 10);
  if (isNaN(productId)) {
    return ctx.reply('Please provide a valid product ID.');
  }

  try {
    const product = await productQueries.findById(productId);
    if (!product || product.user_id !== ctx.user.id) {
      return ctx.reply('Product not found.');
    }

    const message = buildProductInfoMessage(product);
    const keyboard = productActionsKeyboard(product.id, product.url);

    if (product.image_url) {
      await ctx.replyWithPhoto(
        { url: product.image_url },
        {
          caption: message,
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup,
        }
      );
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup,
      });
    }
  } catch (error) {
    logger.error('Error getting product status', { error: error.message, productId });
    await ctx.reply('Failed to get product status.');
  }
}

module.exports = statusCommand;
