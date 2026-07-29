const express = require('express');
const router = express.Router();
const productQueries = require('../../src/database/queries/products');
const { scrapeProduct } = require('../../src/scraper');
const { extractPlatform } = require('../../src/utils/helpers');
const logger = require('../../src/utils/logger');

router.get('/:telegramId', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const user = await require('../../src/database/queries/users').findByTelegramId(req.params.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const result = await productQueries.findByUser(user.id, page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('API get products error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { telegramId, url, targetPrice } = req.body;
    if (!telegramId || !url || !targetPrice) {
      return res.status(400).json({ error: 'telegramId, url, and targetPrice required' });
    }

    const user = await require('../../src/database/queries/users').findByTelegramId(telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const productData = await scrapeProduct(url);
    const product = await productQueries.create(user.id, {
      url,
      platform: extractPlatform(url),
      title: productData.title,
      imageUrl: productData.imageUrl,
      currentPrice: productData.currentPrice,
      targetPrice: parseFloat(targetPrice),
      inStock: productData.inStock,
      stockStatus: productData.stockStatus,
      deliveryAvailable: productData.deliveryAvailable,
      sellerName: productData.sellerName,
    });

    res.status(201).json({ success: true, product });
  } catch (error) {
    logger.error('API add product error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:productId', async (req, res) => {
  try {
    const product = await productQueries.findById(req.params.productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    await productQueries.remove(product.id, product.user_id);
    res.json({ success: true });
  } catch (error) {
    logger.error('API remove product error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
