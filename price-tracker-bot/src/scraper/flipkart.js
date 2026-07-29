const BaseScraper = require('./base');
const logger = require('../utils/logger');
const { sanitizeText } = require('../utils/helpers');

class FlipkartScraper extends BaseScraper {
  constructor() {
    super('flipkart');
  }

  async waitForProductPage(page) {
    await page.waitForSelector('.B_NuCI, .productTitle, .aMaAEs, h1 span, .VU-ZEz', {
      timeout: 15000,
    }).catch(() => {
      logger.warn('Flipkart: Product title selector not found, continuing');
    });
  }

  async extractProductData(page, url) {
    const data = await page.evaluate(() => {
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.textContent.trim() : null;
      };

      const title = getText('.B_NuCI') || getText('.VU-ZEz') ||
                    getText('h1 span') || document.title?.replace(' Flipkart', '').trim() || null;

      const imageEl = document.querySelector('._396cs4 img, ._2r_T1I img, [class*="image"] img, .CXW8mj img');
      const imageUrl = imageEl ? (imageEl.getAttribute('src') || imageEl.getAttribute('data-src')) : null;

      const priceEl = document.querySelector('._30jeq3, ._16Jk6d, ._1_WHN1');
      let currentPrice = null;
      if (priceEl) {
        const priceText = priceEl.textContent.trim().replace(/[^0-9.]/g, '');
        currentPrice = parseFloat(priceText) || null;
      }

      const stockEl = document.querySelector('.._1sHnRq, ._1JU98V, ._1sHnRq');
      const stockText = stockEl ? stockEl.textContent.trim().toLowerCase() : '';
      const outOfStock = stockText.includes('out of stock') || stockText.includes('currently unavailable');

      const deliveryEl = document.querySelector('._3LgYP8, ._1h4CvN, ._2I3_fL, .row ._3n5OQx');
      const deliveryText = deliveryEl ? deliveryEl.textContent.trim().toLowerCase() : '';
      const deliveryAvailable = deliveryText.includes('delivery') || deliveryText.includes('shipping') || deliveryText.includes('pincode');

      const sellerEl = document.querySelector('._1RLviY, ._3F1LxS, .sellerName, ._3g2J8m');
      const sellerName = sellerEl ? sellerEl.textContent.trim() : null;

      const ratingEl = document.querySelector('._3LWZlK, ._2d4LTz, .hGSR34');
      const ratingText = ratingEl ? ratingEl.textContent.trim() : '';
      const rating = ratingText ? parseFloat(ratingText) : null;

      const reviewEl = document.querySelector('._2_R_DZ, ._3UAT2v span, ._1sYo6q');
      const reviewsText = reviewEl ? reviewEl.textContent.trim().replace(/[^0-9]/g, '') : '0';
      const totalReviews = parseInt(reviewsText, 10) || 0;

      const categoryEl = document.querySelector('.R0cyWM, ._3ZJ2-i, ._2whKao');
      const category = categoryEl ? categoryEl.textContent.trim() : null;

      const brandEl = document.querySelector('.CXW8mj ._3o3r66, .gE4Huh, ._3e7dJX');
      const brand = brandEl ? brandEl.textContent.trim() : null;

      return {
        title,
        imageUrl,
        currentPrice,
        inStock: !outOfStock,
        stockStatus: outOfStock ? 'out_of_stock' : 'available',
        deliveryAvailable,
        sellerName,
        rating,
        totalReviews,
        category,
        brand,
      };
    });

    data.title = sanitizeText(data.title);
    data.platform = 'flipkart';
    data.url = url;

    return data;
  }
}

module.exports = FlipkartScraper;
