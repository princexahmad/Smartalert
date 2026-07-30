const logger = require('../utils/logger');
const { formatPrice } = require('../utils/helpers');
const { Markup } = require('telegraf');

function buildPriceAlertMessage(product, changes) {
  const platformEmoji = product.platform === 'amazon' ? '' : '';
  const priceDrop = changes.currentPrice < (changes.previousPrice || changes.currentPrice);
  const discount = changes.previousPrice && changes.currentPrice < changes.previousPrice
    ? Math.round(((changes.previousPrice - changes.currentPrice) / changes.previousPrice) * 100)
    : 0;

  let title = '';
  let icon = '';
  let message = '';

  if (changes.priceChanged && priceDrop) {
    title = ' PRICE DROP ALERT';
    icon = '';
    message = `Price dropped from ${formatPrice(changes.previousPrice)} to ${formatPrice(changes.currentPrice)}`;
  } else if (changes.priceChanged && !priceDrop) {
    title = ' PRICE INCREASE';
    icon = '';
    message = `Price increased from ${formatPrice(changes.previousPrice)} to ${formatPrice(changes.currentPrice)}`;
  } else if (changes.stockChanged && changes.inStock) {
    title = ' BACK IN STOCK';
    icon = '';
    message = 'Product is now available!';
  } else if (changes.stockChanged && !changes.inStock) {
    title = ' OUT OF STOCK';
    icon = '';
    message = 'Product is currently out of stock';
  } else if (changes.deliveryChanged && changes.deliveryAvailable) {
    title = ' DELIVERY AVAILABLE';
    icon = '';
    message = 'Delivery is now available for this product';
  } else if (changes.deliveryChanged && !changes.deliveryAvailable) {
    title = ' DELIVERY UNAVAILABLE';
    icon = '';
    message = 'Delivery is currently unavailable';
  } else if (changes.titleChanged) {
    title = ' TITLE CHANGED';
    icon = '';
    message = 'Product title has been updated';
  } else if (changes.sellerChanged) {
    title = ' SELLER CHANGED';
    icon = '';
    message = `Seller changed from ${changes.oldSeller} to ${changes.newSeller}`;
  } else {
    title = ' PRICE UPDATE';
    icon = '';
    message = 'Product price has been updated';
  }

  const text = [
    `${icon} *${title}*`,
    '',
    `${platformEmoji} *${changes.title || 'Product'}*`,
    '',
    `💰 *Current Price:* ${formatPrice(changes.currentPrice)}`,
    changes.previousPrice ? `📉 *Previous Price:* ${formatPrice(changes.previousPrice)}` : null,
    `🎯 *Target Price:* ${formatPrice(changes.targetPrice)}`,
    discount > 0 ? `🏷️ *Discount:* ${discount}% OFF` : null,
    ``,
    `📦 *Stock:* ${changes.inStock ? '✅ Available' : '❌ Out of Stock'}`,
    `🚚 *Delivery:* ${changes.deliveryAvailable ? '✅ Available' : '❌ Unavailable'}`,
    changes.sellerName ? `🏪 *Seller:* ${changes.sellerName}` : null,
    ``,
    `📝 ${message}`,
    ``,
    `🕐 *Last Updated:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
  ]
    .filter(Boolean)
    .join('\n');

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.url(' Buy Now', product.url)],
    [
      Markup.button.callback(' Refresh', `refresh_${product.id}`),
      Markup.button.callback(' Remove', `remove_${product.id}`),
    ],
  ]);

  return { text, keyboard };
}

function buildProductInfoMessage(product) {
  const platformEmoji = product.platform === 'amazon' ? '' : '';
  const discount = product.current_price && product.previous_price && product.current_price < product.previous_price
    ? Math.round(((product.previous_price - product.current_price) / product.previous_price) * 100)
    : 0;

  const text = [
    `${platformEmoji} *${product.title || 'Product'}*`,
    '',
    `💰 *Current Price:* ${formatPrice(product.current_price)}`,
    product.previous_price ? `📉 *Previous Price:* ${formatPrice(product.previous_price)}` : null,
    `🎯 *Target Price:* ${formatPrice(product.target_price)}`,
    discount > 0 ? `🏷️ *Discount:* ${discount}% OFF` : null,
    ``,
    `📦 *Stock:* ${product.in_stock ? '✅ Available' : '❌ Out of Stock'}`,
    `🚚 *Delivery:* ${product.delivery_available ? '✅ Available' : '❌ Unavailable'}`,
    product.seller_name ? `🏪 *Seller:* ${product.seller_name}` : null,
    ``,
    `🕐 *Last Checked:* ${product.last_checked_at ? new Date(product.last_checked_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Not checked yet'}`,
    product.last_price_change_at ? `📅 *Last Price Change:* ${new Date(product.last_price_change_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}` : null,
    product.error_count > 0 ? `⚠️ *Errors:* ${product.error_count}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return text;
}

function buildProductListMessage(products, page, totalPages) {
  if (products.length === 0) {
    return 'You have no tracked products yet. Use /add to start tracking a product.';
  }

  const lines = [
    `*📋 Your Tracked Products (Page ${page}/${totalPages})*`,
    '',
  ];

  products.forEach((p, i) => {
    const platformIcon = p.platform === 'amazon' ? '' : '';
    lines.push(
      `${i + 1}. ${platformIcon} *${(p.title || 'Product').substring(0, 40)}*`,
      `   💰 ${formatPrice(p.current_price)} | 🎯 ${formatPrice(p.target_price)}`,
      `   📦 ${p.in_stock ? '✅' : '❌'} Stock | 🚚 ${p.delivery_available ? '✅' : '❌'} Delivery`,
      `   🕐 ${p.last_checked_at ? new Date(p.last_checked_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}`,
      '',
    );
  });

  return lines.join('\n');
}

function buildHelpMessage() {
  return [
    '* YSF Smart Alert - Help*',
    '',
    'Track prices on Amazon.in and Flipkart.com and get instant alerts!',
    '',
    '*How to use:*',
    '',
    '1. Tap "Create Alert" button',
    '2. Select website (Amazon/Flipkart)',
    '3. Paste product URL',
    '4. Choose alert name',
    '5. Select alert type (Price Drop, Stock, Pincode, Offers)',
    '6. Set target price / pincode',
    '7. Confirm and done!',
    '',
    '*Features:*',
    '',
    ' Create Alert - Add products to track',
    ' My Alerts - View all your tracked products',
    ' Alert History - Past alert notifications',
    ' Product Status - Real-time product info',
    ' My Plan - View your subscription',
    ' Upgrade Plan - Get more features',
    ' Settings - Configure preferences',
    '',
    '*Plans:*',
    '',
    'Free: 5 alerts, 30min checks',
    'Monthly (\u20B9499): 100 alerts, 10min checks',
    'Premium (\u20B9999): Unlimited alerts, 5min checks',
    '',
    'Tap Upgrade Plan to subscribe!',
  ].join('\n');
}

function buildAboutMessage() {
  return [
    '* YSF Smart Alert*',
    '',
    'Your intelligent product price & availability tracker.',
    'Monitor Amazon.in and Flipkart.com in real-time.',
    '',
    '*Features:*',
    ' Real-time price monitoring',
    ' Price drop & increase alerts',
    ' Stock availability tracking',
    ' Pincode delivery status',
    ' Offer & deal detection',
    ' 10-minute summary reports',
    '',
    '*Platform Support:*',
    ' Amazon India',
    ' Flipkart',
    '',
    '*Version:* 2.0.0',
    '*Contact:* faizan.mech.fk@gmail.com',
  ].join('\n');
}

function buildPlanMessage(user, subscription, plan) {
  const daysLeft = subscription && subscription.end_date
    ? Math.ceil((new Date(subscription.end_date) - new Date()) / (1000 * 60 * 60 * 24))
    : 0;

  const productCount = subscription?.product_count || 0;

  const statusEmoji = {
    active: '✅',
    pending: '⏳',
    expired: '❌',
    cancelled: '🚫',
    rejected: '⛔',
  };

  return [
    '*📊 Your Plan*',
    '',
    `*Plan:* ${plan?.name || 'Free'}`,
    `*Status:* ${statusEmoji[subscription?.status] || '✅'} ${subscription?.status || 'Active'}`,
    subscription?.end_date ? `*Expires:* ${new Date(subscription.end_date).toLocaleDateString('en-IN')} (${daysLeft} days left)` : null,
    '',
    `*Limits:*`,
    `• Products: ${productCount}/${plan?.product_limit || 5} used`,
    `• Check Interval: Every ${plan?.monitor_interval_minutes || 30} minutes`,
    '',
    `*Features:*`,
    plan?.features ? Object.entries(plan.features).map(([key, val]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return `• ${val ? '✅' : '❌'} ${label}`;
    }).join('\n') : '• ✅ Price Alerts\n• ✅ Stock Alerts',
    '',
    user?.is_approved ? '' : '\n⚠️ Your account is pending admin approval.',
    '',
    'Use /upgrade to upgrade your plan!',
  ].filter(Boolean).join('\n');
}

async function sendAlert(bot, telegramId, product, changes) {
  const { text, keyboard } = buildPriceAlertMessage(product, changes);
  try {
    const kb = require('../bot/keyboard');
    const notifKb = kb.alertNotificationKeyboard(product.id, product.url);
    await bot.telegram.sendMessage(telegramId, text, {
      parse_mode: 'Markdown',
      reply_markup: notifKb.reply_markup,
      disable_web_page_preview: false,
    });
    logger.info('Alert sent', { telegramId, productId: product.id, type: changes.type });
    return true;
  } catch (error) {
    logger.error('Failed to send alert', { telegramId, productId: product.id, error: error.message });
    return false;
  }
}

function buildSummaryMessage(products) {
  if (!products || products.length === 0) return null;
  const lines = [
    'Your Active Alerts Summary',
    '',
    ...products.map((p, i) => {
      const icon = p.platform === 'amazon' ? '' : '';
      const priceChange = p.previous_price && p.current_price !== p.previous_price
        ? ` (${p.current_price < p.previous_price ? '' : ''}${Math.round(((p.current_price - p.previous_price) / p.previous_price) * 100)}%)`
        : '';
      return [
        `${i + 1}. ${icon} ${p.title || 'Product'}`,
        `   Price: ${formatPrice(p.current_price)}${priceChange}`,
        `   Stock: ${p.in_stock ? 'Available' : 'Out of Stock'}`,
        p.delivery_available !== null ? `   Delivery: ${p.delivery_available ? 'Yes' : 'No'}` : null,
        `   Target: ${formatPrice(p.target_price)}`,
      ].filter(Boolean).join('\n');
    }),
    '',
    'Check /list for details.',
  ].join('\n');
  return lines;
}

async function sendSummary(bot, telegramId, products) {
  const msg = buildSummaryMessage(products);
  if (!msg) return;
  try {
    await bot.telegram.sendMessage(telegramId, msg, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  } catch (error) {
    logger.error('Failed to send summary', { telegramId, error: error.message });
  }
}

async function sendEnhancedIndividualAlert(bot, telegramId, product, changes) {
  const platformEmoji = product.platform === 'amazon' ? '' : '';
  const discount = changes.previousPrice && changes.currentPrice < changes.previousPrice
    ? Math.round(((changes.previousPrice - changes.currentPrice) / changes.previousPrice) * 100)
    : 0;

  const text = [
    ` Product Update`,
    '',
    `${platformEmoji} *${changes.title || product.title || 'Product'}*`,
    '',
    `Current Price: ${formatPrice(changes.currentPrice)}`,
    changes.previousPrice ? `Old Price: ${formatPrice(changes.previousPrice)}` : null,
    discount > 0 ? `Discount: ${discount}% OFF` : null,
    `Target: ${formatPrice(changes.targetPrice)}`,
    '',
    `Stock: ${changes.inStock ? 'Available' : 'Out of Stock'}`,
    changes.deliveryAvailable !== null ? `Pincode Status: ${changes.deliveryAvailable ? 'Delivery Available' : 'Delivery Unavailable'}` : null,
    '',
    `Website: ${product.platform}`,
    `Updated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
  ].filter(Boolean).join('\n');

  try {
    const kb = require('../bot/keyboard');
    const notifKb = kb.alertNotificationKeyboard(product.id, product.url);
    await bot.telegram.sendMessage(telegramId, text, {
      parse_mode: 'Markdown',
      reply_markup: notifKb.reply_markup,
      disable_web_page_preview: true,
    });
    return true;
  } catch (error) {
    logger.error('Failed enhanced alert', { telegramId, error: error.message });
    return false;
  }
}

module.exports = {
  buildPriceAlertMessage,
  buildProductInfoMessage,
  buildProductListMessage,
  buildHelpMessage,
  buildAboutMessage,
  buildPlanMessage,
  sendAlert,
  buildSummaryMessage,
  sendSummary,
  sendEnhancedIndividualAlert,
};
