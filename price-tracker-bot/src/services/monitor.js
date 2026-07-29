const cron = require('node-cron');
const logger = require('../utils/logger');
const config = require('../config');
const productQueries = require('../database/queries/products');
const alertQueries = require('../database/queries/alerts');
const subscriptionQueries = require('../database/queries/subscriptions');
const notificationService = require('./notification');
const { scrapeProduct } = require('../scraper');

let monitoringActive = false;
let monitorInterval = null;

async function checkProductPrice(product) {
  try {
    logger.info('Checking product price', { productId: product.id, platform: product.platform });

    const scrapedData = await scrapeProduct(product.url);

    const changes = {
      productId: product.id,
      title: scrapedData.title || product.title,
      currentPrice: scrapedData.currentPrice,
      previousPrice: product.current_price,
      targetPrice: product.target_price,
      inStock: scrapedData.inStock,
      deliveryAvailable: scrapedData.deliveryAvailable,
      sellerName: scrapedData.sellerName,
      type: null,
      priceChanged: false,
      stockChanged: false,
      deliveryChanged: false,
      titleChanged: false,
      sellerChanged: false,
      oldSeller: product.seller_name,
      newSeller: scrapedData.sellerName,
    };

    if (scrapedData.currentPrice !== null &&
        product.current_price !== null &&
        Math.abs(scrapedData.currentPrice - product.current_price) > 0.01) {
      changes.priceChanged = true;
    }

    if (scrapedData.inStock !== product.in_stock) {
      changes.stockChanged = true;
    }

    if (scrapedData.deliveryAvailable !== product.delivery_available) {
      changes.deliveryChanged = true;
    }

    if (scrapedData.title && product.title && scrapedData.title !== product.title) {
      changes.titleChanged = true;
      changes.title = scrapedData.title;
    }

    if (scrapedData.sellerName && product.seller_name && scrapedData.sellerName !== product.seller_name) {
      changes.sellerChanged = true;
    }

    if (changes.priceChanged) {
      if (scrapedData.currentPrice < product.current_price) {
        changes.type = 'price_drop';
      } else {
        changes.type = 'price_increase';
      }
    } else if (changes.stockChanged) {
      changes.type = scrapedData.inStock ? 'back_in_stock' : 'out_of_stock';
    } else if (changes.deliveryChanged) {
      changes.type = scrapedData.deliveryAvailable ? 'delivery_available' : 'delivery_unavailable';
    } else if (changes.titleChanged) {
      changes.type = 'title_change';
    } else if (changes.sellerChanged) {
      changes.type = 'seller_change';
    }

    const shouldAlert =
      changes.priceChanged ||
      changes.stockChanged ||
      changes.deliveryChanged ||
      changes.titleChanged ||
      changes.sellerChanged;

    if (shouldAlert) {
      await alertQueries.create(
        product.user_id,
        product.id,
        changes.type,
        JSON.stringify({
          price: changes.previousPrice,
          stock: product.in_stock,
          delivery: product.delivery_available,
          title: product.title,
          seller: product.seller_name,
        }),
        JSON.stringify({
          price: changes.currentPrice,
          stock: changes.inStock,
          delivery: changes.deliveryAvailable,
          title: changes.title,
          seller: changes.newSeller,
        }),
        null
      );

      if (changes.type === 'price_drop' && scrapedData.currentPrice <= product.target_price) {
        await notificationService.sendAlert(null, product.telegram_id, product, changes);
        logger.info('Price alert triggered', { productId: product.id, price: scrapedData.currentPrice });
      } else if (changes.stockChanged || changes.deliveryChanged || changes.titleChanged || changes.sellerChanged) {
        await notificationService.sendAlert(null, product.telegram_id, product, changes);
      }
    }

    await productQueries.updatePrice(product.id, {
      currentPrice: scrapedData.currentPrice,
      inStock: scrapedData.inStock,
      stockStatus: scrapedData.stockStatus,
      deliveryAvailable: scrapedData.deliveryAvailable,
      sellerName: scrapedData.sellerName,
      title: scrapedData.title,
      imageUrl: scrapedData.imageUrl,
      discountPercentage: scrapedData.currentPrice && product.current_price
        ? Math.round(((product.current_price - scrapedData.currentPrice) / product.current_price) * 100)
        : null,
    });

    return { success: true, changes };
  } catch (error) {
    logger.error('Error checking product price', {
      productId: product.id,
      error: error.message,
    });

    await productQueries.markError(product.id, error.message);
    return { success: false, error: error.message };
  }
}

async function runMonitoringCycle() {
  if (monitoringActive) {
    logger.debug('Monitoring cycle already in progress, skipping');
    return;
  }

  monitoringActive = true;
  logger.info('Starting monitoring cycle');

  try {
    const products = await productQueries.getProductsDueForCheck(config.monitor.batchSize);
    logger.info(`Found ${products.length} products due for check`);

    if (products.length === 0) {
      monitoringActive = false;
      return;
    }

    const results = await Promise.allSettled(
      products.map(product => checkProductPrice(product))
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

    logger.info('Monitoring cycle completed', {
      total: products.length,
      success: successCount,
      failed: failCount,
    });
  } catch (error) {
    logger.error('Monitoring cycle error', { error: error.message });
  } finally {
    monitoringActive = false;
  }
}

async function handleExpiredSubscriptions() {
  try {
    const expired = await subscriptionQueries.getExpiredSubscriptions();
    for (const sub of expired) {
      await subscriptionQueries.expireSubscription(sub.id);
      logger.info('Subscription expired', { subscriptionId: sub.id, userId: sub.user_id });
    }
  } catch (error) {
    logger.error('Error handling expired subscriptions', { error: error.message });
  }
}

function startMonitor(bot) {
  logger.info(`Starting price monitor (every ${config.monitor.intervalMinutes} minutes)`);

  const cronExpression = `*/${config.monitor.intervalMinutes} * * * *`;

  monitorInterval = cron.schedule(cronExpression, async () => {
    await runMonitoringCycle();
    await handleExpiredSubscriptions();
  });

  runMonitoringCycle();

  logger.info('Price monitor started');
}

function stopMonitor() {
  if (monitorInterval) {
    monitorInterval.stop();
    monitorInterval = null;
    logger.info('Price monitor stopped');
  }
}

module.exports = {
  startMonitor,
  stopMonitor,
  runMonitoringCycle,
  checkProductPrice,
};
