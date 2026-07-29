const { buildAboutMessage } = require('../services/notification');

async function aboutCommand(ctx) {
  await ctx.replyWithPhoto(
    { url: 'https://img.freepik.com/free-vector/shopping-price-tag_23-2147494770.jpg' },
    {
      caption: buildAboutMessage(),
      parse_mode: 'Markdown',
    }
  );
}

module.exports = aboutCommand;
