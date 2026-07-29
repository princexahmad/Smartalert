const AmazonScraper = require('./amazon');
const FlipkartScraper = require('./flipkart');
const { extractPlatform } = require('../utils/helpers');
const logger = require('../utils/logger');

const scrapers = {
  amazon: new AmazonScraper(),
  flipkart: new FlipkartScraper(),
};

async function scrapeProduct(url) {
  const platform = extractPlatform(url);
  if (!platform) {
    throw new Error(`Unsupported platform or invalid URL: ${url}`);
  }

  const scraper = scrapers[platform];
  if (!scraper) {
    throw new Error(`No scraper available for platform: ${platform}`);
  }

  return scraper.scrape(url);
}

async function closeAll() {
  for (const [platform, scraper] of Object.entries(scrapers)) {
    try {
      await scraper.close();
      logger.info(`Closed scraper for ${platform}`);
    } catch (error) {
      logger.error(`Error closing scraper for ${platform}`, { error: error.message });
    }
  }
}

module.exports = {
  scrapeProduct,
  closeAll,
  scrapers,
};
