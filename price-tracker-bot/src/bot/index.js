const { Telegraf, session } = require('telegraf');
const config = require('../config');
const logger = require('../utils/logger');
const helpers = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');
const { errorHandler } = require('../middleware/errorHandler');
const kb = require('./keyboard');
const db = require('../database/connection');
const productQueries = require('../database/queries/products');
const subscriptionQueries = require('../database/queries/subscriptions');
const userQueries = require('../database/queries/users');
const logQueries = require('../database/queries/logs');
const newQueries = require('../database/queries/newQueries');
const notificationService = require('../services/notification');
const subscriptionService = require('../services/subscription');
const adminService = require('../services/admin');
const monitor = require('../services/monitor');
const { scrapeProduct } = require('../scraper');

async function showWelcome(ctx, message) {
  const user = ctx.user || ctx.session.user;
  const msg = message || [
    'Welcome to YSF Smart Alert!',
    '',
    'Your intelligent product price & availability tracker.',
    'Track prices on Amazon & Flipkart and get instant alerts.',
    '',
    'Select an option below to get started.',
  ].join('\n');
  ctx.session = { state: 'welcome' };
  await ctx.reply(msg, { reply_markup: kb.welcomeKeyboard().reply_markup });
}

function createBot() {
  const bot = new Telegraf(config.bot.token);

  bot.use(session({ defaultSession: () => ({ state: 'welcome', data: {} }) }));
  bot.use(rateLimiter);
  bot.use(authMiddleware);
  bot.catch(errorHandler);

  // =================== COMMANDS ===================
  bot.start(async (ctx) => {
    const plan = await subscriptionService.getUserPlan(ctx.user.id);
    const msg = [
      `*Welcome to YSF Smart Alert, ${ctx.user.first_name || 'User'}!*`,
      '',
      'Track prices on Amazon & Flipkart and get instant alerts.',
      '',
      `Your Plan: ${plan.plan_name}`,
      `Active Alerts: ${plan.product_count || 0}/${plan.product_limit}`,
      '',
      'Use the buttons below to navigate.',
    ].join('\n');
    await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb.welcomeKeyboard().reply_markup });
  });

  // =================== WELCOME BUTTONS ===================
  const welcomeActions = {
    'Create Alert': async (ctx) => {
      const canAdd = await subscriptionService.canAddProduct(ctx.user.id);
      if (!canAdd) {
        return ctx.reply('You have reached your alert limit. Upgrade your plan to add more.', { reply_markup: kb.upgradePlansKeyboard().reply_markup });
      }
      ctx.session.state = 'create_alert_site';
      ctx.session.data = {};
      await ctx.reply('Select the website:', { reply_markup: kb.websiteKeyboard().reply_markup });
    },
    'My Alerts': async (ctx) => bot.emit('myalerts', ctx),
    'Alert History': async (ctx) => bot.emit('alerthistory', ctx),
    'Product Status': async (ctx) => {
      const products = await productQueries.findByUser(ctx.user.id, 1, 100);
      if (products.products.length === 0) {
        return ctx.reply('You have no tracked products. Create an alert first!', { reply_markup: kb.backToWelcomeKeyboard().reply_markup });
      }
      ctx.session.state = 'product_status_list';
      await ctx.reply('Select a product to check status:', { reply_markup: kb.myAlertsListKeyboard(products.products, 1, products.totalPages).reply_markup });
    },
    'My Plan': async (ctx) => bot.emit('myplan', ctx),
    'Upgrade Plan': async (ctx) => {
      const plans = await newQueries.getAdminPlans();
      const text = plans.map(p =>
        `*${p.name}* - \u20B9${p.price_inr}${p.duration_days > 0 ? '/' + p.duration_days + 'd' : ''}\n  Alerts: ${p.max_alerts} | Products: ${p.max_products}\n  ${p.description}`
      ).join('\n\n');
      await ctx.reply(`*Available Plans*\n\n${text}`, { parse_mode: 'Markdown', reply_markup: kb.upgradePlansKeyboard().reply_markup });
    },
    'Help': async (ctx) => {
      await ctx.reply(notificationService.buildHelpMessage(), { parse_mode: 'Markdown', reply_markup: kb.backToWelcomeKeyboard().reply_markup });
    },
    'Settings': async (ctx) => {
      const profile = await newQueries.getProfile(ctx.user.id);
      ctx.session.state = 'settings';
      const notif = profile.notify_instant ? 'On' : 'Off';
      const summ = profile.notify_summary ? 'On' : 'Off';
      await ctx.reply(`*Settings*\n\nInstant Alerts: ${notif}\nSummary: ${summ}`, { parse_mode: 'Markdown', reply_markup: kb.settingsKeyboard().reply_markup });
    },
    'Contact Admin': async (ctx) => {
      await ctx.reply('Contact the admin:\nEmail: faizan.mech.fk@gmail.com', { reply_markup: kb.contactAdminKeyboard().reply_markup });
    },
    'Main Menu': async (ctx) => showWelcome(ctx, 'Returning to main menu.'),
  };

  for (const [label, handler] of Object.entries(welcomeActions)) {
    bot.hears(label, handler);
  }

  // =================== CREATE ALERT FLOW ===================
  bot.action(/website_(amazon|flipkart|other)/, async (ctx) => {
    await ctx.answerCbQuery();
    const site = ctx.match[1];
    ctx.session.data.website = site;
    ctx.session.state = 'create_alert_url';
    await ctx.editMessageText(`Selected: ${site}\n\nNow paste the product URL:`);
  });

  bot.action(/name_(original|custom)_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const choice = ctx.match[1];
    const tempId = ctx.match[2];
    if (choice === 'original') {
      ctx.session.data.useCustomName = false;
      ctx.session.state = 'create_alert_type';
      await ctx.editMessageText('Select alert type(s):', { reply_markup: kb.alertTypeKeyboard(tempId).reply_markup });
    } else {
      ctx.session.state = 'create_alert_custom_name';
      await ctx.editMessageText('Enter a custom name for this alert:');
    }
  });

  bot.action(/alerttype_(.+)_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const type = ctx.match[1];
    const tempId = ctx.match[2];
    if (type === 'done') {
      if (!ctx.session.data.alertTypes || ctx.session.data.alertTypes.length === 0) {
        return ctx.answerCbQuery('Select at least one alert type!', { show_alert: true });
      }
      const needsPrice = ctx.session.data.alertTypes.includes('price_drop');
      const needsPincode = ctx.session.data.alertTypes.includes('pincode');
      if (needsPrice) {
        ctx.session.state = 'create_alert_price';
        return ctx.editMessageText('Enter your target price (in INR):');
      }
      if (needsPincode) {
        ctx.session.state = 'create_alert_pincode';
        return ctx.editMessageText('Enter your pincode:');
      }
      return bot.emit('showAlertConfirm', ctx);
    }
    if (!ctx.session.data.alertTypes) ctx.session.data.alertTypes = [];
    const idx = ctx.session.data.alertTypes.indexOf(type);
    if (idx > -1) {
      ctx.session.data.alertTypes.splice(idx, 1);
    } else {
      ctx.session.data.alertTypes.push(type);
    }
    const icons = { price_drop: '', in_stock: '', pincode: '', offers: '', all: '' };
    const names = { price_drop: 'Price Drop', in_stock: 'In Stock', pincode: 'Pincode', offers: 'Offers', all: 'All' };
    const selected = ctx.session.data.alertTypes.map(t => `${icons[t]} ${names[t]}`).join(', ') || 'None';
    await ctx.editMessageText(`Selected: ${selected}\n\nChoose more or tap Done:`, { reply_markup: kb.alertTypeKeyboard(tempId).reply_markup });
  });

  bot.action(/confirm_alert_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    await bot.emit('finalizeAlert', ctx);
  });

  bot.action(/edit_alert_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.state = 'create_alert_site';
    ctx.session.data = {};
    await ctx.editMessageText('Restarting alert creation. Select website:', { reply_markup: kb.websiteKeyboard().reply_markup });
  });

  bot.action(/cancel_alert_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.data = {};
    ctx.session.state = 'welcome';
    await ctx.editMessageText('Alert creation cancelled.');
    await showWelcome(ctx);
  });

  // =================== MY ALERTS ===================
  bot.on('myalerts', async (ctx) => {
    try {
      const result = await productQueries.findByUser(ctx.user.id, 1, 10);
      if (result.products.length === 0) {
        return ctx.reply('You have no alerts yet. Create one!', { reply_markup: kb.backToWelcomeKeyboard().reply_markup });
      }
      const msg = notificationService.buildProductListMessage(result.products, 1, result.totalPages);
      await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb.myAlertsListKeyboard(result.products, 1, result.totalPages).reply_markup });
    } catch (e) {
      logger.error('My alerts error', { error: e.message });
      await ctx.reply('Failed to load alerts.', { reply_markup: kb.backToWelcomeKeyboard().reply_markup });
    }
  });

  bot.action(/alerts_page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    const result = await productQueries.findByUser(ctx.user.id, page, 10);
    const msg = notificationService.buildProductListMessage(result.products, page, result.totalPages);
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: kb.myAlertsListKeyboard(result.products, page, result.totalPages).reply_markup });
  });

  // =================== ALERT HISTORY ===================
  bot.on('alerthistory', async (ctx) => {
    try {
      const result = await newQueries.getAlertHistory(ctx.user.id, 1, 10);
      if (result.alerts.length === 0) {
        return ctx.reply('No alert history yet.', { reply_markup: kb.backToWelcomeKeyboard().reply_markup });
      }
      const lines = result.alerts.map(a =>
        `${a.alert_type === 'price_drop' ? '' : ''} *${a.title || a.alert_type}*\n  Price: ${helpers.formatPrice(a.current_price)} | ${a.discount_percentage ? a.discount_percentage + '% off' : ''}\n  ${a.created_at ? helpers.formatDate(a.created_at) : ''}`
      );
      await ctx.reply(`*Alert History*\n\n${lines.join('\n\n')}`, { parse_mode: 'Markdown', reply_markup: kb.backToWelcomeKeyboard().reply_markup });
    } catch (e) {
      logger.error('Alert history error', { error: e.message });
      await ctx.reply('Failed to load history.', { reply_markup: kb.backToWelcomeKeyboard().reply_markup });
    }
  });

  // =================== VIEW PRODUCT / ALERT CARD ===================
  bot.action(/view_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const productId = parseInt(ctx.match[1]);
    const product = await productQueries.findById(productId);
    if (!product) return ctx.editMessageText('Product not found.');
    const msg = notificationService.buildProductInfoMessage(product);
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: kb.alertCardKeyboard(productId).reply_markup });
  });

  bot.action(/alert_(edit|pause|resume|delete|view)_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const action = ctx.match[1];
    const productId = parseInt(ctx.match[2]);
    if (action === 'delete') {
      await productQueries.remove(productId, ctx.user.id);
      await logQueries.log(ctx.user.id, 'delete_alert', 'product', productId, {});
      await ctx.editMessageText('Alert deleted.');
    } else if (action === 'pause') {
      await db.query('UPDATE products SET is_active = false WHERE id = $1', [productId]);
      await ctx.editMessageText('Alert paused.');
    } else if (action === 'resume') {
      await db.query('UPDATE products SET is_active = true WHERE id = $1', [productId]);
      await ctx.editMessageText('Alert resumed.');
    } else if (action === 'edit') {
      ctx.session.state = 'create_alert_price';
      ctx.session.data = { editingProductId: productId };
      await ctx.reply('Enter new target price:');
    } else if (action === 'view') {
      const product = await productQueries.findById(productId);
      if (!product) return ctx.reply('Not found.');
      const msg = notificationService.buildProductInfoMessage(product);
      await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb.alertCardKeyboard(productId).reply_markup });
    }
  });

  // =================== REFRESH / SET TARGET ===================
  bot.action(/refresh_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery('Refreshing...');
    const productId = parseInt(ctx.match[1]);
    const product = await productQueries.findById(productId);
    if (!product) return ctx.editMessageText('Not found.');
    const result = await monitor.checkProductPrice(product);
    if (result.success) {
      const updated = await productQueries.findById(productId);
      const msg = notificationService.buildProductInfoMessage(updated);
      await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: kb.productStatusKeyboard(productId).reply_markup }).catch(() => {});
    } else {
      await ctx.reply('Failed to refresh. Try again later.');
    }
  });

  bot.action(/set_target_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const productId = parseInt(ctx.match[1]);
    ctx.session.state = 'set_target';
    ctx.session.data = { targetProductId: productId };
    await ctx.reply('Enter new target price:');
  });

  // =================== MY PLAN ===================
  bot.on('myplan', async (ctx) => {
    const plan = await subscriptionService.getUserPlan(ctx.user.id);
    const sub = await subscriptionQueries.getActiveSubscription(ctx.user.id);
    const text = notificationService.buildPlanMessage(ctx.user, sub || plan, plan);
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb.planKeyboard().reply_markup });
  });

  bot.action('my_plan_details', async (ctx) => {
    await ctx.answerCbQuery();
    bot.emit('myplan', ctx);
  });

  bot.action('view_plans', async (ctx) => {
    await ctx.answerCbQuery();
    const plans = await newQueries.getAdminPlans();
    const text = plans.map(p =>
      `*${p.name}* - \u20B9${p.price_inr}${p.duration_days > 0 ? '/' + p.duration_days + 'd' : ''}\n  Alerts: ${p.max_alerts} | Products: ${p.max_products}\n  ${p.description}`
    ).join('\n\n');
    await ctx.editMessageText(`*Available Plans*\n\n${text}`, { parse_mode: 'Markdown', reply_markup: kb.upgradePlansKeyboard().reply_markup });
  });

  bot.action('upgrade_now', async (ctx) => {
    await ctx.answerCbQuery();
    const plans = await newQueries.getAdminPlans();
    await ctx.editMessageText('Select a plan:', { reply_markup: kb.upgradePlansKeyboard().reply_markup });
  });

  bot.action(/buy_(monthly|premium)/, async (ctx) => {
    await ctx.answerCbQuery();
    const code = ctx.match[1];
    const plans = await newQueries.getAdminPlans();
    const plan = plans.find(p => p.code === code);
    if (!plan) return ctx.reply('Plan not found.');
    const planRow = await db.query("SELECT id FROM plans WHERE code = $1", [code === 'monthly' ? 'premium_monthly' : 'premium']);
    const pid = planRow.rows[0]?.id;
    if (pid) {
      await subscriptionQueries.create(ctx.user.id, pid);
      await logQueries.log(ctx.user.id, 'request_upgrade', 'subscription', null, { plan: code });
      await ctx.editMessageText(`Request sent for ${plan.name} plan.\n\nAdmin will review and approve shortly.`);
      const admins = adminService.getAdminIds();
      for (const aid of admins) {
        try {
          await bot.telegram.sendMessage(aid, `Upgrade request from @${ctx.user.username || ctx.user.first_name}\nPlan: ${plan.name} (\u20B9${plan.price_inr})`, { reply_markup: kb.backToWelcomeKeyboard().reply_markup });
        } catch (e) {}
      }
    }
  });

  bot.action('contact_admin', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('Email: faizan.mech.fk@gmail.com', { reply_markup: kb.contactAdminKeyboard().reply_markup });
  });

  // =================== SETTINGS ===================
  bot.action('settings_notifications', async (ctx) => {
    await ctx.answerCbQuery();
    const profile = await newQueries.getProfile(ctx.user.id);
    const val = !profile.notify_instant;
    await newQueries.updateProfile(ctx.user.id, { notify_instant: val });
    await ctx.editMessageText(`Instant alerts ${val ? 'enabled' : 'disabled'}.`, { reply_markup: kb.settingsKeyboard().reply_markup });
  });

  bot.action('settings_summary', async (ctx) => {
    await ctx.answerCbQuery();
    const profile = await newQueries.getProfile(ctx.user.id);
    const val = !profile.notify_summary;
    await newQueries.updateProfile(ctx.user.id, { notify_summary: val });
    await ctx.editMessageText(`Summary ${val ? 'enabled' : 'disabled'}.`, { reply_markup: kb.settingsKeyboard().reply_markup });
  });

  bot.action('settings_instant', async (ctx) => {
    await ctx.answerCbQuery();
    const profile = await newQueries.getProfile(ctx.user.id);
    const val = !profile.notify_instant;
    await newQueries.updateProfile(ctx.user.id, { notify_instant: val });
    await ctx.editMessageText(`Instant alerts ${val ? 'enabled' : 'disabled'}.`, { reply_markup: kb.settingsKeyboard().reply_markup });
  });

  bot.action('settings_delete_all', async (ctx) => {
    await ctx.answerCbQuery();
    await db.query('UPDATE products SET is_active = false WHERE user_id = $1', [ctx.user.id]);
    await ctx.editMessageText('All alerts deleted.', { reply_markup: kb.backToWelcomeKeyboard().reply_markup });
  });

  // =================== NAVIGATION ===================
  bot.action('back_welcome', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session = { state: 'welcome', data: {} };
    await ctx.deleteMessage().catch(() => {});
    await showWelcome(ctx);
  });

  bot.action('back_myalerts', async (ctx) => {
    await ctx.answerCbQuery();
    bot.emit('myalerts', ctx);
  });

  bot.action('back_myplan', async (ctx) => {
    await ctx.answerCbQuery();
    bot.emit('myplan', ctx);
  });

  bot.action('back_productstatus', async (ctx) => {
    await ctx.answerCbQuery();
    const products = await productQueries.findByUser(ctx.user.id, 1, 100);
    await ctx.editMessageText('Select a product:', { reply_markup: kb.myAlertsListKeyboard(products.products, 1, products.totalPages).reply_markup });
  });

  bot.action('noop', async (ctx) => ctx.answerCbQuery());

  // =================== ADMIN PANEL ===================
  bot.hears(' Users', async (ctx) => {
    if (!adminService.isAdmin(ctx.from.id)) return;
    const users = await userQueries.getAllUsers(1, 10);
    const msg = users.users.map(u => `ID: ${u.id} | @${u.username || 'N/A'} | ${u.is_active ? 'Active' : 'Inactive'} | ${u.is_approved ? 'Approved' : 'Pending'}`).join('\n');
    await ctx.reply(`*Users (page 1/${users.totalPages})*\n\n${msg}`, { parse_mode: 'Markdown', reply_markup: kb.backToWelcomeKeyboard().reply_markup });
  });

  bot.hears(' Pending Approvals', async (ctx) => {
    if (!adminService.isAdmin(ctx.from.id)) return;
    const pending = await adminService.getPendingApprovals();
    if (!pending || pending.length === 0) return ctx.reply('No pending approvals.');
    const list = Array.isArray(pending) ? pending : [pending];
    for (const sub of list) {
      const msg = `Subscription: @${sub.username || 'N/A'} | ${sub.plan_name} | \u20B9${sub.price_inr}`;
      await ctx.reply(msg, { reply_markup: kb.adminApprovalKeyboard(sub.id).reply_markup });
    }
  });

  bot.action(/admin_subapprove_(\d+)/, async (ctx) => {
    if (!adminService.isAdmin(ctx.from.id)) return;
    const subId = parseInt(ctx.match[1]);
    await adminService.approveSubscription(subId, ctx.user.id);
    await ctx.editMessageText('Approved.');
  });

  bot.action(/admin_subreject_(\d+)/, async (ctx) => {
    if (!adminService.isAdmin(ctx.from.id)) return;
    const subId = parseInt(ctx.match[1]);
    await adminService.rejectSubscription(subId, ctx.user.id, 'Rejected by admin');
    await ctx.editMessageText('Rejected.');
  });

  bot.hears(' Plans', async (ctx) => {
    if (!adminService.isAdmin(ctx.from.id)) return;
    const plans = await newQueries.getAdminPlans();
    const msg = plans.map(p => `*${p.name}* - \u20B9${p.price_inr} | Active: ${p.is_active ? 'Yes' : 'No'} | Deletable: ${p.is_deletable ? 'Yes' : 'No'}`).join('\n');
    await ctx.reply(`*Plans*\n\n${msg}`, { parse_mode: 'Markdown', reply_markup: kb.backToWelcomeKeyboard().reply_markup });
  });

  bot.hears(' Alerts', async (ctx) => {
    if (!adminService.isAdmin(ctx.from.id)) return;
    const all = await productQueries.getAllActiveProducts();
    await ctx.reply(`Total active alerts: ${all.length}`, { reply_markup: kb.backToWelcomeKeyboard().reply_markup });
  });

  bot.hears(' Broadcast', async (ctx) => {
    if (!adminService.isAdmin(ctx.from.id)) return;
    ctx.session.state = 'admin_broadcast';
    await ctx.reply('Send the message to broadcast to all users:');
  });

  bot.hears(' Analytics', async (ctx) => {
    if (!adminService.isAdmin(ctx.from.id)) return;
    const stats = await adminService.getDashboardStats();
    const msg = [
      `Users: ${stats.users.total_users} total, ${stats.users.active_users} active`,
      `Products: ${stats.products.total}`,
      `Subscriptions: ${stats.subscriptions.active} active, ${stats.subscriptions.pending} pending`,
    ].join('\n');
    await ctx.reply(`*Analytics*\n\n${msg}`, { parse_mode: 'Markdown', reply_markup: kb.backToWelcomeKeyboard().reply_markup });
  });

  bot.hears(' Logs', async (ctx) => {
    if (!adminService.isAdmin(ctx.from.id)) return;
    const result = await logQueries.getLogs(1, 10);
    const msg = result.logs.map(l => `[${helpers.formatDate(l.created_at)}] ${l.action} by @${l.username || 'N/A'}`).join('\n');
    await ctx.reply(`*Recent Logs*\n\n${msg}`, { parse_mode: 'Markdown', reply_markup: kb.backToWelcomeKeyboard().reply_markup });
  });

  // =================== TEXT HANDLERS (state-driven) ===================
  bot.on('text', async (ctx, next) => {
    const state = ctx.session?.state;
    const data = ctx.session?.data || {};
    const text = ctx.message.text;

    if (state === 'create_alert_url') {
      const url = text.trim();
      const platform = helpers.extractPlatform(url);
      if (!platform) return ctx.reply('Invalid URL. Please paste a valid Amazon or Flipkart product URL.');
      ctx.session.data.url = url;
      ctx.session.data.platform = platform;
      ctx.session.state = 'create_alert_name_choice';
      const msg = await ctx.reply('Fetching product details...');
      try {
        const scraped = await scrapeProduct(url);
        ctx.session.data.title = scraped.title || 'Product';
        ctx.session.data.imageUrl = scraped.imageUrl;
        ctx.session.data.currentPrice = scraped.currentPrice;
        await ctx.deleteMessage(msg.message_id).catch(() => {});
        await ctx.reply(`Product: ${scraped.title.substring(0, 100)}\nPrice: ${helpers.formatPrice(scraped.currentPrice)}\n\nChoose a name:`, { reply_markup: kb.nameChoiceKeyboard(Math.random().toString(36).substring(2, 8)).reply_markup });
      } catch (e) {
        await ctx.deleteMessage(msg.message_id).catch(() => {});
        ctx.session.data.title = 'Product';
        await ctx.reply('Could not fetch details. Using default name. Choose:', { reply_markup: kb.nameChoiceKeyboard('0').reply_markup });
      }
      return;
    }

    if (state === 'create_alert_custom_name') {
      ctx.session.data.customName = text.trim().substring(0, 100);
      ctx.session.state = 'create_alert_type';
      await ctx.reply('Select alert type(s):', { reply_markup: kb.alertTypeKeyboard(Math.random().toString(36).substring(2, 8)).reply_markup });
      return;
    }

    if (state === 'create_alert_price') {
      const price = parseFloat(text.replace(/[^0-9.]/g, ''));
      if (isNaN(price) || price <= 0) return ctx.reply('Enter a valid price.');
      ctx.session.data.targetPrice = price;
      if (ctx.session.data.alertTypes?.includes('pincode')) {
        ctx.session.state = 'create_alert_pincode';
        return ctx.reply('Enter your pincode:');
      }
      await bot.emit('showAlertConfirm', ctx);
      return;
    }

    if (state === 'create_alert_pincode') {
      const pincode = text.trim().replace(/\D/g, '').substring(0, 6);
      if (pincode.length !== 6) return ctx.reply('Enter a valid 6-digit pincode.');
      ctx.session.data.pincode = pincode;
      await bot.emit('showAlertConfirm', ctx);
      return;
    }

    if (state === 'set_target') {
      const price = parseFloat(text.replace(/[^0-9.]/g, ''));
      if (isNaN(price) || price <= 0) return ctx.reply('Enter a valid price.');
      await db.query('UPDATE products SET target_price = $1 WHERE id = $2 AND user_id = $3', [price, data.targetProductId, ctx.user.id]);
      ctx.session.state = 'welcome';
      await ctx.reply(`Target price updated to ${helpers.formatPrice(price)}`, { reply_markup: kb.welcomeKeyboard().reply_markup });
      return;
    }

    if (state === 'admin_broadcast') {
      ctx.session.state = 'welcome';
      const result = await adminService.broadcastMessage(bot, text, ctx.user.id);
      await ctx.reply(`Broadcast sent: ${result.sent} successful, ${result.failed} failed.`, { reply_markup: kb.welcomeKeyboard().reply_markup });
      return;
    }

    return next();
  });

  // =================== SHOW ALERT CONFIRMATION ===================
  bot.on('showAlertConfirm', async (ctx) => {
    const d = ctx.session.data;
    const types = (d.alertTypes || ['price_drop']).join(', ');
    const msg = [
      `*Confirm Alert*`,
      '',
      `Product: ${d.customName || d.title || 'Product'}`,
      `Website: ${d.website}`,
      `Alert Type: ${types}`,
      d.targetPrice ? `Target Price: ${helpers.formatPrice(d.targetPrice)}` : null,
      d.pincode ? `Pincode: ${d.pincode}` : null,
    ].filter(Boolean).join('\n');
    ctx.session.state = 'welcome';
    await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb.confirmAlertKeyboard(Math.random().toString(36).substring(2, 8)).reply_markup });
  });

  // =================== FINALIZE ALERT ===================
  bot.on('finalizeAlert', async (ctx) => {
    const d = ctx.session.data;
    try {
      const product = await productQueries.create(ctx.user.id, {
        url: d.url,
        platform: d.platform,
        title: d.customName || d.title || 'Product',
        imageUrl: d.imageUrl,
        currentPrice: d.currentPrice,
        targetPrice: d.targetPrice || 0,
        inStock: true,
      });
      if (d.alertTypes && d.alertTypes.length > 0) {
        await newQueries.setProductAlertTypes(product.id, d.alertTypes, d.targetPrice, d.pincode);
      }
      await newQueries.incrementMetric('alerts_created');
      await logQueries.log(ctx.user.id, 'create_alert', 'product', product.id, { url: d.url, platform: d.platform });
      ctx.session.data = {};
      await ctx.editMessageText('Alert created successfully! You will be notified when conditions are met.');
      await showWelcome(ctx);
    } catch (e) {
      logger.error('Finalize alert error', { error: e.message });
      await ctx.reply('Failed to create alert. Please try again.');
    }
  });

  // =================== NOTIFICATION HANDLERS ===================
  bot.action(/notif_(delete|pause)_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const action = ctx.match[1];
    const alertId = parseInt(ctx.match[2]);
    if (action === 'delete') {
      await productQueries.remove(alertId, ctx.user.id);
      await ctx.editMessageText('Alert deleted.');
    } else if (action === 'pause') {
      await db.query('UPDATE products SET is_active = false WHERE id = $1', [alertId]);
      await ctx.editMessageText('Alert paused.');
    }
  });

  // =================== POLLING ERROR ===================
  bot.on('polling_error', (err) => {
    if (err.code === 'ETELEGRAM' && err.description?.includes('terminated')) return;
    logger.error('Polling error', { error: err.message });
  });

  return bot;
}

module.exports = { createBot };
