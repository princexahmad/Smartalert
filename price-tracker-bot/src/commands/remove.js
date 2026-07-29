const logger = require('../utils/logger');
const productQueries = require('../database/queries/products');
const logQueries = require('../database/queries/logs');

async function removeCommand(ctx) {
  const text = ctx.message?.text?.trim();
  if (!text || text === '/remove') {
    return ctx.reply(
      'Usage: `/remove <product_id>`\n\n' +
      'Use /list to find the product ID.',
      { parse_mode: 'Markdown' }
    );
  }

  const productId = parseInt(text.replace('/remove', '').trim(), 10);
  if (isNaN(productId)) {
    return ctx.reply('Please provide a valid product ID (number).');
  }

  try {
    const product = await productQueries.findById(productId);
    if (!product) {
      return ctx.reply('Product not found.');
    }

    if (product.user_id !== ctx.user.id && !ctx.user.is_admin) {
      return ctx.reply('This product does not belong to you.');
    }

    await productQueries.remove(productId, product.user_id);
    await logQueries.log(ctx.user.id, 'remove_product', 'product', productId, { title: product.title });

    await ctx.reply(
      `*✅ Product Removed*\n\n` +
      `${product.title || 'Product'} has been removed from tracking.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    logger.error('Error removing product', { error: error.message, productId });
    await ctx.reply('Failed to remove product. Please try again.');
  }
}

module.exports = removeCommand;
