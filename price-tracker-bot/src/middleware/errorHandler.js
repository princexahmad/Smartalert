const logger = require('../utils/logger');

async function errorHandler(err, ctx) {
  logger.error('Bot error', {
    error: err.message,
    stack: err.stack,
    chatId: ctx?.chat?.id,
    userId: ctx?.from?.id,
    command: ctx?.message?.text,
  });

  try {
    if (ctx && ctx.reply) {
      await ctx.reply(
        'An unexpected error occurred. Our team has been notified.\n' +
        'Please try again later or contact support.'
      ).catch(() => {});
    }
  } catch {
  }
}

module.exports = { errorHandler };
