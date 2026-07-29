const BaseScraper = require('./base');
const logger = require('../utils/logger');
const { sanitizeText } = require('../utils/helpers');

class AmazonScraper extends BaseScraper {
  constructor() {
    super('amazon');
  }

  async waitForProductPage(page) {
    await page.waitForSelector('#productTitle, #titleSection, .a-section.a-spacing-none', {
      timeout: 15000,
    }).catch(() => {
      logger.warn('Amazon: Product title selector not found, continuing');
    });
  }

  async extractProductData(page, url) {
    const data = await page.evaluate(() => {
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.textContent.trim() : null;
      };

      const title = getText('#productTitle') || getText('#titleSection') ||
                    document.title?.replace('Amazon.in: ', '').replace(': ', '').trim() || null;

      const imageEl = document.querySelector('#imgTagWrapperId img, #landingImage, .imgTagWrapper img, #main-image');
      const imageUrl = imageEl ? (imageEl.getAttribute('src') || imageEl.getAttribute('data-old-hires') || null) : null;

      const priceEl = document.querySelector('.a-price-whole, .a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, .a-price .a-text-price span.a-offscreen');
      let currentPrice = null;
      if (priceEl) {
        const priceText = priceEl.textContent.trim().replace(/[^0-9.]/g, '');
        currentPrice = parseFloat(priceText) || null;
      }

      const stockEl = document.querySelector('#availability span, #availability_feature_div .a-size-medium');
      const stockText = stockEl ? stockEl.textContent.trim().toLowerCase() : '';
      const inStock = !stockText.includes('out of stock') && !stockText.includes('currently unavailable');

      const deliveryEl = document.querySelector('#deliveryMessageInTitle, #ddpDeliveryMessage, #fast-track-message, .a-row.delivery-message');
      const deliveryText = deliveryEl ? deliveryEl.textContent.trim().toLowerCase() : '';
      const deliveryAvailable = deliveryText.includes('delivery') || deliveryText.includes('shipping');

      const sellerEl = document.querySelector('#sellerInfoTrigger, #sellerName, .tabular-buybox-text .a-link-normal, #merchant-info .a-link-normal');
      const sellerName = sellerEl ? sellerEl.textContent.trim() : null;

      const ratingEl = document.querySelector('.a-icon-alt, #averageCustomerReviews .a-icon-alt');
      const ratingText = ratingEl ? ratingEl.textContent.trim() : '';
      const rating = ratingText ? parseFloat(ratingText.split(' out')[0]) : null;

      const reviewEl = document.querySelector('#acrCustomerReviewText, .a-size-base .a-link-normal');
      const reviewsText = reviewEl ? reviewEl.textContent.trim().replace(/[^0-9]/g, '') : '0';
      const totalReviews = parseInt(reviewsText, 10) || 0;

      const categoryEl = document.querySelector('#wayfinding-breadcrumbs_feature_div .a-link-normal, .a-breadcrumb .a-link-normal');
      const category = categoryEl ? categoryEl.textContent.trim() : null;

      const brandEl = document.querySelector('#bylineInfo, #productOverview_feature_div .a-size-small');
      const brand = brandEl ? brandEl.textContent.trim() : null;

      return {
        title,
        imageUrl,
        currentPrice,
        inStock,
        stockStatus: inStock ? 'available' : 'out_of_stock',
        deliveryAvailable,
        sellerName,
        rating,
        totalReviews,
        category,
        brand,
      };
    });

    data.title = sanitizeText(data.title);
    data.platform = 'amazon';
    data.url = url;

    return data;
  }
}

module.exports = AmazonScraper;
