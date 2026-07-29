const express = require('express');
const router = express.Router();
const adminService = require('../../src/services/admin');
const userQueries = require('../../src/database/queries/users');
const logger = require('../../src/utils/logger');

router.get('/stats', async (req, res) => {
  try {
    const stats = await adminService.getDashboardStats();
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('API admin stats error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/pending', async (req, res) => {
  try {
    const pending = await adminService.getPendingApprovals();
    res.json({ success: true, pending });
  } catch (error) {
    logger.error('API admin pending error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/approve/:subscriptionId', async (req, res) => {
  try {
    const { adminId } = req.body;
    if (!adminId) return res.status(400).json({ error: 'adminId required' });

    const sub = await adminService.approveSubscription(req.params.subscriptionId, adminId);
    res.json({ success: true, subscription: sub });
  } catch (error) {
    logger.error('API approve error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/reject/:subscriptionId', async (req, res) => {
  try {
    const { adminId, reason } = req.body;
    if (!adminId) return res.status(400).json({ error: 'adminId required' });

    const sub = await adminService.rejectSubscription(req.params.subscriptionId, adminId, reason);
    res.json({ success: true, subscription: sub });
  } catch (error) {
    logger.error('API reject error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await userQueries.getAllUsers(page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('API admin users error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
