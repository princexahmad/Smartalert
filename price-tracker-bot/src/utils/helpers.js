const config = require('../config');

function extractPlatform(url) {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.includes('amazon.in') || lower.includes('amazon.com') || lower.includes('amzn')) return 'amazon';
  if (lower.includes('flipkart.com') || lower.includes('flipkart')) return 'flipkart';
  return null;
}

function extractProductId(url, platform) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (platform === 'amazon') {
      const match = parsed.pathname.match(/\/(?:dp|product)\/([A-Z0-9]{10})/i);
      return match ? match[1] : null;
    }
    if (platform === 'flipkart') {
      const match = parsed.pathname.match(/\/product\/([a-zA-Z0-9]+)/);
      return match ? match[1] : null;
    }
  } catch {
    return null;
  }
  return null;
}

function formatPrice(price, currency = 'INR') {
  if (price === null || price === undefined) return 'N/A';
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return formatter.format(price);
}

function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(date) {
  if (!date) return 'N/A';
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function calculateDiscount(currentPrice, previousPrice) {
  if (!currentPrice || !previousPrice || previousPrice === 0) return 0;
  return Math.round(((previousPrice - currentPrice) / previousPrice) * 100);
}

function sanitizeText(text, maxLength = 200) {
  if (!text) return '';
  return String(text)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, maxLength);
}

function generateIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getPlatformIcon(platform) {
  const icons = {
    amazon: '',
    flipkart: '',
  };
  return icons[platform] || '';
}

function escapeMarkdown(text) {
  if (!text) return '';
  return String(text)
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/`/g, '\\`');
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isAmazonUrl(url) {
  return /^https?:\/\/(www\.)?(amazon\.(in|com)|amzn\.in)\//i.test(url);
}

function isFlipkartUrl(url) {
  return /^https?:\/\/(www\.)?flipkart\.com\//i.test(url);
}

module.exports = {
  extractPlatform,
  extractProductId,
  formatPrice,
  formatDate,
  formatRelativeTime,
  calculateDiscount,
  sanitizeText,
  generateIdempotencyKey,
  chunkArray,
  sleep,
  getPlatformIcon,
  escapeMarkdown,
  isValidUrl,
  isAmazonUrl,
  isFlipkartUrl,
};
