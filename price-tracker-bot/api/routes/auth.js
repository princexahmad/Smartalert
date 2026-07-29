const express = require('express');
const router = express.Router();
const userQueries = require('../../src/database/queries/users');
const logger = require('../../src/utils/logger');

router.post('/register', async (req, res) => {
  try {
    const { telegramId, username, firstName, lastName, languageCode } = req.body;
    if (!telegramId) return res.status(400).json({ error: 'telegramId required' });

    const user = await userQueries.create(telegramId, username, firstName, lastName, languageCode);
    res.json({ success: true, user });
  } catch (error) {
    logger.error('API register error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:telegramId', async (req, res) => {
  try {
    const user = await userQueries.findByTelegramId(req.params.telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    logger.error('API get user error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
