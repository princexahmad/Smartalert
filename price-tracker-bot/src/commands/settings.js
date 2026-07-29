const { settingsKeyboard } = require('../bot/keyboard');
const db = require('../database/connection');

async function settingsCommand(ctx) {
  const notifStatus = ctx.user.notification_enabled ? 'Enabled' : 'Disabled';
  const notifEmoji = ctx.user.notification_enabled ? '🔔' : '🔕';

  const message = [
    '*Settings*',
    '',
    `${notifEmoji} *Notifications:* ${notifStatus}`,
    '',
    'Use the buttons below to configure your settings.',
  ].join('\n');

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: settingsKeyboard().reply_markup,
  });
}

module.exports = settingsCommand;
