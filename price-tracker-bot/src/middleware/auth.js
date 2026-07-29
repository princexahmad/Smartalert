const db = require('../database/connection');
const logger = require('../utils/logger');

async function authMiddleware(ctx, next) {
  if (!ctx.from) {
    return ctx.reply('Unable to identify you. Please try again.');
  }

  try {
    const user = await db.query(
      `INSERT INTO users (telegram_id, username, first_name, last_name, language_code)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (telegram_id)
       DO UPDATE SET
         username = COALESCE($2, users.username),
         first_name = COALESCE($3, users.first_name),
         last_name = COALESCE($4, users.last_name),
         language_code = COALESCE($5, users.language_code),
         is_active = true,
         last_active_at = NOW()
       RETURNING *`,
      [
        ctx.from.id,
        ctx.from.username || null,
        ctx.from.first_name || null,
        ctx.from.last_name || null,
        ctx.from.language_code || 'en',
      ]
    );

    ctx.user = user.rows[0];
    return next();
  } catch (error) {
    logger.error('Auth middleware error', { error: error.message, telegramId: ctx.from.id });
    return ctx.reply('An error occurred. Please try again later.');
  }
}

async function adminMiddleware(ctx, next) {
  if (!ctx.user || !ctx.user.is_admin) {
    return ctx.reply('This command is only available to administrators.');
  }
  return next();
}

async function approvedMiddleware(ctx, next) {
  if (!ctx.user || !ctx.user.is_approved) {
    return ctx.reply(
      'Your account is pending approval. Please wait for an administrator to approve your account.\n\n' +
      'If you have already upgraded to Premium, contact an admin to get approved.'
    );
  }
  return next();
}

module.exports = {
  authMiddleware,
  adminMiddleware,
  approvedMiddleware,
};
