const { Markup } = require('telegraf');

function mainKeyboard() {
  return Markup.keyboard([
    [' Add Product', '  My Products'],
    [' My Plan', '  Settings'],
    [' Help', '  About'],
  ])
  .resize()
  .persistent();
}

function cancelKeyboard() {
  return Markup.keyboard([[' Cancel']])
    .resize()
    .oneTime();
}

function productActionsKeyboard(productId, url) {
  return Markup.inlineKeyboard([
    [
      Markup.button.url(' Buy Now', url),
    ],
    [
      Markup.button.callback(' Refresh', `refresh_${productId}`),
      Markup.button.callback(' Remove', `remove_${productId}`),
    ],
    [
      Markup.button.callback(' Set Target Price', `set_target_${productId}`),
    ],
  ]);
}

function productListKeyboard(products, page, totalPages) {
  const buttons = products.map(p => [
    Markup.button.callback(
      `${p.title ? p.title.substring(0, 30) : 'Product'} - ${p.current_price ? '₹' + p.current_price : 'N/A'}`,
      `view_${p.id}`
    ),
  ]);

  const navButtons = [];
  if (page > 1) navButtons.push(Markup.button.callback(' Previous', `page_${page - 1}`));
  navButtons.push(Markup.button.callback(` ${page}/${totalPages}`, 'noop'));
  if (page < totalPages) navButtons.push(Markup.button.callback(' Next ', `page_${page + 1}`));

  if (navButtons.length > 1) {
    buttons.push(navButtons);
  }

  return Markup.inlineKeyboard(buttons);
}

function adminKeyboard() {
  return Markup.keyboard([
    [' Users', '  Pending Approvals'],
    [' Broadcast', '  Stats'],
    [' Logs', '  Plans'],
    [' Main Menu'],
  ])
  .resize()
  .persistent();
}

function confirmKeyboard(action, id) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(' Yes', `${action}_yes_${id}`),
      Markup.button.callback(' No', `${action}_no_${id}`),
    ],
  ]);
}

function settingsKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Toggle Notifications', 'toggle_notifications'),
    ],
    [
      Markup.button.callback(' Back to Menu', 'back_main'),
    ],
  ]);
}

function upgradeKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(' Premium Monthly - ₹499', 'upgrade_premium_monthly'),
    ],
    [
      Markup.button.url(' Contact Admin', 'https://t.me/admin'),
    ],
  ]);
}

function backKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(' Back to Menu', 'back_main')],
  ]);
}

module.exports = {
  mainKeyboard,
  cancelKeyboard,
  productActionsKeyboard,
  productListKeyboard,
  adminKeyboard,
  confirmKeyboard,
  settingsKeyboard,
  upgradeKeyboard,
  backKeyboard,
};
