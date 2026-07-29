const express = require('express');
const router = express.Router();
const db = require('../../src/database/connection');

router.get('/', async (req, res) => {
  const dbHealth = await db.healthCheck();
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbHealth.status,
    memory: process.memoryUsage(),
  };
  res.json(health);
});

router.get('/ping', (req, res) => {
  res.json({ pong: true, timestamp: new Date().toISOString() });
});

module.exports = router;
