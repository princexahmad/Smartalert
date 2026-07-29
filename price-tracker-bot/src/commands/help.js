const { buildHelpMessage } = require('../services/notification');

async function helpCommand(ctx) {
  await ctx.reply(buildHelpMessage(), {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });
}

module.exports = helpCommand;
