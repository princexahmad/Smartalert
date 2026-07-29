const { Markup } = require('telegraf');
const logger = require('../utils/logger');
const helpers = require('../utils/helpers');
const validators = require('../utils/validators');
const config = require('../config');
const productQueries = require('../database/queries/products');
const subscriptionService = require('../services/subscription');
const { scrapeProduct } = require('../scraper');
const logQueries = require('../database/queries/logs');

async function addCommand(ctx) {
  const text = ctx.message?.text?.trim();
  if (!text || text === '/add') {
    return ctx.reply(
      'Please provide a product URL and target price.\n\n' +
      'Usage: `/add <product_url> <target_price>`\n\n' +
      'Example: `/add https://amazon.in/dp/B0XXXXXXXX 15000`',
      { parse_mode: 'Markdown' }
    );
  }

  const args = text.replace('/add', '').trim().split(/\s+/);
  const url = args[0];
  const targetPrice = args[1];

  const validationErrors = validators.validateAddProductInput(url, targetPrice);
  if (validationErrors.length > 0) {
    return ctx.reply(
      '❌ *Validation Errors:*\n' + validationErrors.map(e => `• ${e}`).join('\n'),
      { parse_mode: 'Markdown' }
    );
  }

  const existingProduct = await productQueries.findByUserAndUrl(ctx.user.id, url);
  if (existingProduct) {
    return ctx.reply(
      'You are already tracking this product!\n\n' +
      `Current Price: ${helpers.formatPrice(existingProduct.current_price)}\n` +
      `Target Price: ${helpers.formatPrice(existingProduct.target_price)}\n` +
      `Status: ${existingProduct.in_stock ? '✅ In Stock' : '❌ Out of Stock'}`,
      { parse_mode: 'Markdown' }
    );
  }

  const canAdd = await subscriptionService.canAddProduct(ctx.user.id);
  if (!canAdd) {
    const plan = await subscriptionService.getUserPlan(ctx.user.id);
    return ctx.reply(
      `You have reached the limit of ${plan.product_limit} products on your ${plan.plan_name} plan.\n\n` +
      'Upgrade to Premium to track more products!\n' +
      'Use /upgrade to see available plans.',
      { parse_mode: 'Markdown' }
    );
  }

  const statusMsg = await ctx.reply(' Fetching product details...');

  try {
    const productData = await scrapeProduct(url);

    if (!productData.title) {
      return ctx.editMessageText(
        'Could not extract product details. The URL might be invalid or the page structure has changed.'
      );
    }

    const product = await productQueries.create(ctx.user.id, {
      url,
      platform: helpers.extractPlatform(url),
      platformProductId: helpers.extractProductId(url, helpers.extractPlatform(url)),
      title: productData.title,
      imageUrl: productData.imageUrl,
      currentPrice: productData.currentPrice,
      targetPrice: parseFloat(targetPrice),
      inStock: productData.inStock,
      stockStatus: productData.stockStatus,
      deliveryAvailable: productData.deliveryAvailable,
      sellerName: productData.sellerName,
      rating: productData.rating,
      category: productData.category,
      brand: productData.brand,
    });

    await logQueries.log(ctx.user.id, 'add_product', 'product', product.id, { url, platform: product.platform });

    const message = [
      `*✅ Product Added Successfully*`,
      '',
      `*Product:* ${productData.title.substring(0, 100)}`,
      `*Platform:* ${helpers.getPlatformIcon(product.platform)} ${product.platform.charAt(0).toUpperCase() + product.platform.slice(1)}`,
      `*Current Price:* ${helpers.formatPrice(productData.currentPrice)}`,
      `*Target Price:* ${helpers.formatPrice(parseFloat(targetPrice))}`,
      `*Stock:* ${productData.inStock ? '✅ Available' : '❌ Out of Stock'}`,
      productData.deliveryAvailable !== undefined ? `*Delivery:* ${productData.deliveryAvailable ? '✅ Available' : '❌ Unavailable'}` : null,
      ``,
      `You will be notified when the price drops to or below your target!`,
    ].filter(Boolean).join('\n');

    await ctx.deleteMessage(statusMsg.message_id);

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url(' View Product', url)],
      [Markup.button.callback(' Refresh Now', `refresh_${product.id}`)],
    ]);

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup,
      disable_web_page_preview: true,
    });
  } catch (error) {
    logger.error('Error adding product', { error: error.message, url });

    await ctx.deleteMessage(statusMsg.message_id).catch(() => {});

    await ctx.reply(
      '❌ *Failed to add product*\n\n' +
      `Error: ${error.message}\n\n` +
      'Please check the URL and try again. If the problem persists, the product page might be blocking automated access.',
      { parse_mode: 'Markdown' }
    );
  }
}

module.exports = addCommand;
