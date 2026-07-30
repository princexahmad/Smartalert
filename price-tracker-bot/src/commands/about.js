const { buildAboutMessage } = require('../services/notification');

async function aboutCommand(ctx) {
  await ctx.reply(buildAboutMessage(), {
    parse_mode: 'Markdown',
  });
}

module.exports = aboutCommand;
