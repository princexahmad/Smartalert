const { isValidUrl, isAmazonUrl, isFlipkartUrl } = require('./helpers');

function validateAddProductInput(url, targetPrice) {
  const errors = [];

  if (!url || typeof url !== 'string') {
    errors.push('Please provide a valid product URL.');
  } else if (!isValidUrl(url)) {
    errors.push('The URL provided is not valid. Please provide a complete URL starting with http:// or https://');
  } else if (!isAmazonUrl(url) && !isFlipkartUrl(url)) {
    errors.push('Only Amazon.in and Flipkart.com product URLs are supported.');
  }

  if (targetPrice === undefined || targetPrice === null) {
    errors.push('Please provide a target price.');
  } else {
    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) {
      errors.push('Target price must be a positive number.');
    } else if (price > 9999999) {
      errors.push('Target price is too high. Maximum allowed is ₹99,99,999.');
    }
  }

  return errors;
}

function validatePagination(page, limit) {
  const errors = [];
  const p = parseInt(page, 10);
  const l = parseInt(limit, 10);

  if (page !== undefined && (isNaN(p) || p < 1)) {
    errors.push('Page must be a positive number.');
  }
  if (limit !== undefined && (isNaN(l) || l < 1 || l > 100)) {
    errors.push('Limit must be between 1 and 100.');
  }

  return errors;
}

function validateUserInput(input, maxLength = 1000) {
  const errors = [];
  if (!input || typeof input !== 'string') {
    errors.push('Invalid input.');
  } else if (input.length > maxLength) {
    errors.push(`Input is too long. Maximum ${maxLength} characters.`);
  } else if (/[<>&"']/.test(input)) {
    errors.push('Input contains invalid characters.');
  }
  return errors;
}

module.exports = {
  validateAddProductInput,
  validatePagination,
  validateUserInput,
};
