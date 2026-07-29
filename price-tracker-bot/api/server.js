const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const config = require('../src/config');
const logger = require('../src/utils/logger');

const app = express();

app.use(helmet());
app.use(compression());
app.use(cors({ origin: config.api.corsOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const apiLimiter = rateLimit({
  windowMs: 60000,
  max: 60,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', apiLimiter);

app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey && config.api.key && apiKey === config.api.key) {
    return next();
  }
  if (req.path === '/api/health') return next();
  if (config.api.key && !apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  next();
});

const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const adminRoutes = require('./routes/admin');

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, req, res, next) => {
  logger.error('API error', { error: err.message, path: req.path });
  res.status(500).json({
    error: 'Internal server error',
    message: config.isDev ? err.message : 'Something went wrong',
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = config.api.port;
const HOST = config.api.host;

app.listen(PORT, HOST, () => {
  logger.info(`API server running on http://${HOST}:${PORT}`);
});

module.exports = app;
