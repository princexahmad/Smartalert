const { Telegraf, session } = require('telegraf');
const config = require('../config');
const logger = require('../utils/logger');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');
const { errorHandler } = require('../middleware/errorHandler');

const startCommand = require('../commands/start');
const helpCommand = require('../commands/help');
const addCommand = require('../commands/add');
const removeCommand = require('../commands/remove');
const listCommand = require('../commands/list');
const statusCommand = require('../commands/status');
const myplanCommand = require('../commands/myplan');
const upgradeCommand = require('../commands/upgrade');
const cancelCommand = require('../commands/cancel');
const settingsCommand = require('../commands/settings');
const aboutCommand = require('../commands/about');

const monitor = require('../services/monitor');
const adminService = require('../services/admin');
const productQueries = require('../database/queries/products');
const subscriptionQueries = require('../database/queries/subscriptions');
const db = require('../database/connection');
const userQueries = require('../database/queries/users');
const logQueries = require('../database/queries/logs');
const notificationService = require('../services/notification');

const helpers = require('../utils/helpers');
const { mainKeyboard, adminKeyboard, confirmKeyboard, backKeyboard } = require('./keyboard');

function createBot() {
  const bot = new Telegraf(config.bot.token);

  bot.use(session({}));
  bot.use(rateLimiter);
  bot.use(authMiddleware);

  bot.catch(errorHandler);

  // ---- Commands ----
  bot.command('start', startCommand);
  bot.command('help', helpCommand);
  bot.command('add', addCommand);
  bot.command('remove', removeCommand);
  bot.command('list', listCommand);
  bot.command('status', statusCommand);
  bot.command('myplan', myplanCommand);
  bot.command('upgrade', upgradeCommand);
  bot.command('cancel', cancelCommand);
  bot.command('settings', settingsCommand);
  bot.command('about', aboutCommand);

  // ---- Text Handlers ----
  bot.hears(' Add Product', addCommand);
  bot.hears('  My Products', listCommand);
  bot.hears(' My Plan', myplanCommand);
  bot.hears('  Settings', settingsCommand);
  bot.hears(' Help', helpCommand);
  bot.hears(' About', aboutCommand);
  bot.hears(' Cancel', async (ctx) => {
    await ctx.reply('Action cancelled.', { reply_markup: mainKeyboard().reply_markup });
  });

  bot.hears('Main Menu', async (ctx) => {
    await ctx.reply('Main Menu', { reply_markup: mainKeyboard().reply_markup });
  });

  // ---- Admin Handlers ----
  bot.hears(' Users', async (ctx) => {
    if (!adminService.isAdmin(ctx.from.id)) return;
    const stats = await adminService.getDashboardStats();
    const msg = [
      '*Users Dashboard*',
      '',
      `Total Users: ${stats.users.total_users}`,
      `Active Users: ${stats.users.active_users}`,
      `Approved Users: ${stats.users.approved_users}`,
      `Admin Users: ${stats.users.admin_users}`,
      '',
      `Total Products: ${stats.products.total}`,
      `Amazon Products: ${stats.products.byPlatform?.amazon || 0}`,
      `Flipkart Products: ${stats.products.byPlatform?.flipkart || 0}`,
      '',
      `Active Subs: ${stats.subscriptions.active}`,
      `Pending Subs: ${stats.subscriptions.pending}`,
    ].join('\n');
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  });

  bot.hears(' Pending Approvals', async (ctx) => {
    if (!adminService.isAdmin(ctx.from.id)) return;
    const pending = await adminService.getPendingApprovals();
    if (pending.length === 0) {
      return ctx.reply('No pending approvals.');
    }
    for (const sub of pending) {
      const msg = [
        `*Pending Subscription*`,
        `User: ${sub.first_name || sub.username || 'Unknown'} (@${sub.username || 'N/A'})`,
        `Plan: ${sub.plan_name} (₹${sub.price_inr})`,
        `Date: ${helpers.formatDate(sub.created_at)}`,
      ].join('\n');
      await ctx.reply(msg, {
        parse_mode: 'Markdown',
        reply_markup: confirmKeyboard(`approve_${sub.id}`, sub.id).reply_markup,
      });
    }
  });

  bot.hears('Broadcast', async (ctx) => {
    if (!adminService.isAdmin(ctx.from.id)) return;
    ctx.session.awaitingBroadcast = true;
    await ctx.reply('Send the message you want to broadcast to all users:');
  });

  bot.hears('Stats', async (ctx) => {
    if (!adminService.isAdmin(ctx.from.id)) return;
    const stats = await adminService.getDashboardStats();
    const msg = [
      '*System Statistics*',
      '',
      `*Users:*`,
      `  Total: ${stats.users.total_users}`,
      `  Active: ${stats.users.active_users}`,
      `  Approved: ${stats.users.approved_users}`,
      '',
      `*Products:*`,
      `  Total: ${stats.products.total}`,
      `  Amazon: ${stats.products.byPlatform?.amazon || 0}`,
      `  Flipkart: ${stats.products.byPlatform?.flipkart || 0}`,
      '',
      `*Subscriptions:*`,
      `  Active: ${stats.subscriptions.active}`,
      `  Pending: ${stats.subscriptions.pending}`,
      `  Expired: ${stats.subscriptions.expired}`,
      '',
      `*24h Logs:*`,
      `  Total: ${stats.logs.total_logs}`,
      `  Errors: ${stats.logs.error_count}`,
    ].join('\n');
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  });

  bot.hears('Logs', async (ctx) => {
    if (!adminService.isAdmin(ctx.from.id)) return;
    const result = await logQueries.getLogs(1, 10);
    if (result.logs.length === 0) {
      return ctx.reply('No logs found.');
    }
    const msg = result.logs.map(log =>
      `[${helpers.formatDate(log.created_at)}] [${log.level.toUpperCase()}] ${log.action}${log.username ? ' by @' + log.username : ''}`
    ).join('\n');
    await ctx.reply(`*Recent Logs:*\n\n${msg}`, { parse_mode: 'Markdown' });
  });

  bot.hears('Plans', async (ctx) => {
    if (!adminService.isAdmin(ctx.from.id)) return;
    const plans = await db.query('SELECT * FROM plans ORDER BY price_inr');
    const msg = plans.rows.map(p =>
      `*${p.name}* (${p.code})\n  Price: ₹${p.price_inr} | Products: ${p.product_limit} | Interval: ${p.monitor_interval_minutes}m\n  Active: ${p.is_active ? '✅' : '❌'}`
    ).join('\n\n');
    await ctx.reply(`*Available Plans:*\n\n${msg}`, { parse_mode: 'Markdown' });
  });

  // ---- Broadcast text capture ----
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.awaitingBroadcast && adminService.isAdmin(ctx.from.id)) {
      ctx.session.awaitingBroadcast = false;
      const result = await adminService.broadcastMessage(bot, ctx.message.text, ctx.user.id);
      await ctx.reply(
        `Broadcast sent!\n✅ Sent: ${result.sent}\n❌ Failed: ${result.failed}\n👥 Total: ${result.total}`
      );
      return;
    }
    return next();
  });

  // ---- Callback Queries ----
  bot.action(/refresh_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery('Refreshing product data...');
    const productId = parseInt(ctx.match[1], 10);
    const product = await productQueries.findById(productId);
    if (!product) return ctx.editMessageText('Product not found.');

    const { checkProductPrice } = require('../services/monitor');
    const result = await checkProductPrice(product);
    if (result.success) {
      const updated = await productQueries.findById(productId);
      const msg = notificationService.buildProductInfoMessage(updated);
      const keyboard = require('./keyboard').productActionsKeyboard(productId, updated.url);
      await ctx.editMessageCaption(msg, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup,
      }).catch(() => ctx.editMessageText(msg, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup,
      }));
    } else {
      await ctx.reply('Failed to refresh product data. Please try again later.');
    }
  });

  bot.action(/remove_(\d+)/, async (ctx) => {
    const productId = parseInt(ctx.match[1], 10);
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: confirmKeyboard(`confirm_remove_${productId}`, productId).reply_markup });
  });

  bot.action(/confirm_remove_yes_(\d+)/, async (ctx) => {
    const productId = parseInt(ctx.match[1], 10);
    await productQueries.remove(productId, ctx.user.id);
    await logQueries.log(ctx.user.id, 'remove_product', 'product', productId, {});
    await ctx.editMessageText('✅ Product removed from tracking.');
  });

  bot.action(/confirm_remove_no_(\d+)/, async (ctx) => {
    await ctx.editMessageText('Removal cancelled.');
  });

  bot.action(/set_target_(\d+)/, async (ctx) => {
    const productId = parseInt(ctx.match[1], 10);
    ctx.session.settingTargetFor = productId;
    await ctx.reply('Please enter the new target price:');
  });

  bot.action(/page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1], 10);
    await ctx.answerCbQuery(`Page ${page}`);
    const result = await productQueries.findByUser(ctx.user.id, page, 10);
    const msg = notificationService.buildProductListMessage(result.products, page, result.totalPages);
    const keyboard = require('./keyboard').productListKeyboard(result.products, page, result.totalPages);
    await ctx.editMessageText(msg, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup,
    });
  });

  bot.action(/view_(\d+)/, async (ctx) => {
    const productId = parseInt(ctx.match[1], 10);
    await ctx.answerCbQuery();
    const product = await productQueries.findById(productId);
    if (!product) return ctx.reply('Product not found.');
    const msg = notificationService.buildProductInfoMessage(product);
    const keyboard = require('./keyboard').productActionsKeyboard(productId, product.url);
    if (product.image_url) {
      await ctx.replyWithPhoto({ url: product.image_url }, {
        caption: msg,
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup,
      });
    } else {
      await ctx.reply(msg, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup,
      });
    }
  });

  bot.action(/approve_(\d+)_yes_(\d+)/, async (ctx) => {
    if (!adminService.isAdmin(ctx.from.id)) return;
    const subId = parseInt(ctx.match[1], 10);
    await adminService.approveSubscription(subId, ctx.user.id);
    await ctx.editMessageText('✅ Subscription approved!');
  });

  bot.action(/approve_(\d+)_no_(\d+)/, async (ctx) => {
    if (!adminService.isAdmin(ctx.from.id)) return;
    const subId = parseInt(ctx.match[1], 10);
    await adminService.rejectSubscription(subId, ctx.user.id, 'Rejected by admin');
    await ctx.editMessageText('❌ Subscription rejected.');
  });

  bot.action('toggle_notifications', async (ctx) => {
    await ctx.answerCbQuery('Toggling notifications...');
    const newVal = !ctx.user.notification_enabled;
    await db.query('UPDATE users SET notification_enabled = $1 WHERE id = $2', [newVal, ctx.user.id]);
    ctx.user.notification_enabled = newVal;
    await ctx.editMessageText(
      `Notifications ${newVal ? 'enabled' : 'disabled'}.`,
      { reply_markup: require('./keyboard').settingsKeyboard().reply_markup }
    );
  });

  bot.action('back_main', async (ctx) => {
    await ctx.deleteMessage();
    await ctx.reply('Main Menu', { reply_markup: mainKeyboard().reply_markup });
  });

  bot.action('noop', async (ctx) => {
    await ctx.answerCbQuery();
  });

  bot.action(/upgrade_premium_monthly/, async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const plans = await db.query("SELECT * FROM plans WHERE code = 'premium_monthly'");
      if (plans.rows.length === 0) {
        return ctx.reply('Premium plan not found. Please contact admin.');
      }
      const plan = plans.rows[0];
      await subscriptionQueries.create(ctx.user.id, plan.id);
      await logQueries.log(ctx.user.id, 'request_upgrade', 'subscription', null, { plan: plan.code });
      await ctx.reply(
        '*⏳ Upgrade Request Submitted*\n\n' +
        'Your request for Premium Monthly has been submitted.\n' +
        'An admin will review and approve your subscription shortly.\n\n' +
        'You will be notified once approved.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      await ctx.reply('Failed to process upgrade request. Please try again.');
    }
  });

  // ---- Text target price capture ----
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.settingTargetFor) {
      const productId = ctx.session.settingTargetFor;
      ctx.session.settingTargetFor = null;
      const price = parseFloat(ctx.message.text.replace(/[^0-9.]/g, ''));
      if (isNaN(price) || price <= 0) {
        return ctx.reply('Please enter a valid price.');
      }
      await db.query('UPDATE products SET target_price = $1 WHERE id = $2 AND user_id = $3',
        [price, productId, ctx.user.id]);
      await ctx.reply(`✅ Target price updated to ${helpers.formatPrice(price)}`);
      return;
    }
    return next();
  });

  // ---- Error logging ----
  bot.on('polling_error', (err) => {
    logger.error('Polling error', { error: err.message });
  });

  return bot;
}

module.exports = { createBot };
