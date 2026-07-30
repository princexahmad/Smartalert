const { chromium } = require('playwright');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const { withRetry, isRetryableError } = require('../utils/retry');

if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
}

class BaseScraper {
  constructor(platform) {
    this.platform = platform;
    this.browser = null;
    this.context = null;
  }

  async getBrowser() {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({
        headless: config.scraper.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
        ],
      });
    }
    return this.browser;
  }

  async getContext() {
    const browser = await this.getBrowser();
    if (!this.context) {
      this.context = await browser.newContext({
        userAgent: config.scraper.userAgent,
        viewport: config.scraper.viewport,
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
        geolocation: { latitude: 28.6139, longitude: 77.2090 },
        permissions: ['geolocation'],
        extraHTTPHeaders: {
          'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
        },
      });
    }
    return this.context;
  }

  async newPage() {
    const context = await this.getContext();
    const page = await context.newPage();
    page.setDefaultTimeout(config.scraper.timeout);
    return page;
  }

  async scrape(url) {
    return withRetry(
      () => this._scrapeWithBrowser(url),
      {
        maxAttempts: config.monitor.retryAttempts,
        baseDelay: config.monitor.retryDelayMs,
        shouldRetry: isRetryableError,
        onRetry: ({ attempt, delay }) => {
          logger.warn(`Retry ${attempt} for ${this.platform}`, { url, delay });
        },
      }
    );
  }

  async _scrapeWithBrowser(url) {
    const page = await this.newPage();
    try {
      logger.info(`Scraping ${this.platform}`, { url });

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: config.scraper.timeout,
      });

      await this.waitForProductPage(page);

      const productData = await this.extractProductData(page, url);

      logger.info(`Scraped ${this.platform} product`, {
        title: productData.title?.substring(0, 50),
        price: productData.currentPrice,
      });

      return productData;
    } catch (error) {
      logger.error(`Error scraping ${this.platform}`, { url, error: error.message });
      throw error;
    } finally {
      await page.close();
    }
  }

  async waitForProductPage(page) {
    throw new Error('waitForProductPage must be implemented by subclass');
  }

  async extractProductData(page, url) {
    throw new Error('extractProductData must be implemented by subclass');
  }

  async close() {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = BaseScraper;
