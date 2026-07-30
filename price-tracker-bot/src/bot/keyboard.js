const { Markup } = require('telegraf');

function welcomeKeyboard() {
  return Markup.keyboard([
    ['Create Alert', 'My Alerts'],
    ['Alert History', 'Product Status'],
    ['My Plan', 'Upgrade Plan'],
    ['Help', 'Settings'],
    ['Contact Admin'],
  ]).resize();
}

function websiteKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(' Amazon', 'website_amazon')],
    [Markup.button.callback(' Flipkart', 'website_flipkart')],
    [Markup.button.callback(' Other', 'website_other')],
    [Markup.button.callback(' Back', 'back_welcome')],
  ]);
}

function nameChoiceKeyboard(productId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(' Original Name', `name_original_${productId}`)],
    [Markup.button.callback(' Custom Name', `name_custom_${productId}`)],
    [Markup.button.callback(' Back', 'back_welcome')],
  ]);
}

function alertTypeKeyboard(productId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(' Price Drop', `alerttype_price_${productId}`)],
    [Markup.button.callback(' In Stock', `alerttype_stock_${productId}`)],
    [Markup.button.callback(' Pincode Availability', `alerttype_pincode_${productId}`)],
    [Markup.button.callback(' Offers', `alerttype_offers_${productId}`)],
    [Markup.button.callback(' All Alerts', `alerttype_all_${productId}`)],
    [Markup.button.callback(' Done Selecting', `alerttype_done_${productId}`)],
    [Markup.button.callback(' Back', 'back_welcome')],
  ]);
}

function confirmAlertKeyboard(productId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(' Confirm', `confirm_alert_${productId}`)],
    [Markup.button.callback(' Edit', `edit_alert_${productId}`)],
    [Markup.button.callback(' Cancel', `cancel_alert_${productId}`)],
  ]);
}

function alertCardKeyboard(alertId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(' Edit', `alert_edit_${alertId}`),
      Markup.button.callback(' Pause', `alert_pause_${alertId}`),
      Markup.button.callback(' Resume', `alert_resume_${alertId}`),
    ],
    [
      Markup.button.callback(' Delete', `alert_delete_${alertId}`),
      Markup.button.callback(' View Details', `alert_view_${alertId}`),
    ],
    [Markup.button.callback(' Back', 'back_myalerts')],
  ]);
}

function alertNotificationKeyboard(alertId, productUrl) {
  return Markup.inlineKeyboard([
    [Markup.button.url(' Open Product', productUrl)],
    [
      Markup.button.callback(' Delete Alert', `notif_delete_${alertId}`),
      Markup.button.callback(' Pause Alert', `notif_pause_${alertId}`),
    ],
  ]);
}

function myAlertsKeyboard(page, totalPages) {
  const buttons = [];
  const nav = [];
  if (page > 1) nav.push(Markup.button.callback(' Previous', `alerts_page_${page - 1}`));
  nav.push(Markup.button.callback(` ${page}/${totalPages}`, 'noop'));
  if (page < totalPages) nav.push(Markup.button.callback(' Next ', `alerts_page_${page + 1}`));
  if (nav.length > 1) buttons.push(nav);
  buttons.push([Markup.button.callback(' Back', 'back_welcome')]);
  return Markup.inlineKeyboard(buttons);
}

function myAlertsListKeyboard(products, page, totalPages) {
  const buttons = products.map((p, i) => [
    Markup.button.callback(
      `${p.title ? p.title.substring(0, 35) : 'Product'} - ${p.current_price ? '\u20B9' + p.current_price : 'N/A'}`,
      `view_${p.id}`
    ),
  ]);
  const nav = [];
  if (page > 1) nav.push(Markup.button.callback(' Previous', `alerts_page_${page - 1}`));
  nav.push(Markup.button.callback(` ${page}/${totalPages}`, 'noop'));
  if (page < totalPages) nav.push(Markup.button.callback(' Next ', `alerts_page_${page + 1}`));
  if (nav.length > 1) buttons.push(nav);
  buttons.push([Markup.button.callback(' Back', 'back_welcome')]);
  return Markup.inlineKeyboard(buttons);
}

function planKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(' View Plans', 'view_plans')],
    [Markup.button.callback(' Upgrade Now', 'upgrade_now')],
    [Markup.button.callback(' My Plan Details', 'my_plan_details')],
    [Markup.button.callback(' Back', 'back_welcome')],
  ]);
}

function upgradePlansKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(' Monthly - \u20B9499', 'buy_monthly')],
    [Markup.button.callback(' Premium - \u20B9999', 'buy_premium')],
    [Markup.button.callback(' Contact Admin', 'contact_admin')],
    [Markup.button.callback(' Back', 'back_myplan')],
  ]);
}

function settingsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(' Toggle Notifications', 'settings_notifications')],
    [Markup.button.callback(' Toggle Summary', 'settings_summary')],
    [Markup.button.callback(' Toggle Instant Alerts', 'settings_instant')],
    [Markup.button.callback(' Delete All Alerts', 'settings_delete_all')],
    [Markup.button.callback(' Back', 'back_welcome')],
  ]);
}

function adminKeyboard() {
  return Markup.keyboard([
    ['Users', 'Pending Approvals'],
    ['Plans', 'Alerts'],
    ['Broadcast', 'Analytics'],
    ['Logs', 'Main Menu'],
  ]).resize();
}

function adminUserActionsKeyboard(userId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(' Approve', `admin_approve_${userId}`),
      Markup.button.callback(' Suspend', `admin_suspend_${userId}`),
    ],
    [
      Markup.button.callback(' Activate', `admin_activate_${userId}`),
      Markup.button.callback(' Remove', `admin_remove_${userId}`),
    ],
    [Markup.button.callback(' View Alerts', `admin_useralerts_${userId}`)],
    [Markup.button.callback(' Back', 'back_admin')],
  ]);
}

function adminPlanActionsKeyboard(planId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(' Modify', `admin_modifyplan_${planId}`),
      Markup.button.callback(' Toggle Active', `admin_toggleplan_${planId}`),
    ],
    [Markup.button.callback(' Delete', `admin_deleteplan_${planId}`)],
    [Markup.button.callback(' Back', 'back_admin_plans')],
  ]);
}

function adminApprovalKeyboard(subscriptionId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(' Approve', `admin_subapprove_${subscriptionId}`),
      Markup.button.callback(' Reject', `admin_subreject_${subscriptionId}`),
    ],
  ]);
}

function contactAdminKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.url(' Email Admin', 'mailto:faizan.mech.fk@gmail.com')],
    [Markup.button.callback(' Back', 'back_welcome')],
  ]);
}

function productStatusKeyboard(productId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(' Refresh', `refresh_${productId}`)],
    [Markup.button.callback(' Set Target', `set_target_${productId}`)],
    [Markup.button.callback(' Back', 'back_productstatus')],
  ]);
}

function backToWelcomeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(' Back to Menu', 'back_welcome')],
  ]);
}

module.exports = {
  welcomeKeyboard,
  websiteKeyboard,
  nameChoiceKeyboard,
  alertTypeKeyboard,
  confirmAlertKeyboard,
  alertCardKeyboard,
  alertNotificationKeyboard,
  myAlertsKeyboard,
  myAlertsListKeyboard,
  planKeyboard,
  upgradePlansKeyboard,
  settingsKeyboard,
  adminKeyboard,
  adminUserActionsKeyboard,
  adminPlanActionsKeyboard,
  adminApprovalKeyboard,
  contactAdminKeyboard,
  productStatusKeyboard,
  backToWelcomeKeyboard,
};
