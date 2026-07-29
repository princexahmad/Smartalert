# Price Tracker Bot

A production-ready Telegram bot for tracking product prices on **Amazon.in** and **Flipkart.com**. Get instant alerts when prices drop to your target, monitor stock availability, delivery status, and more.

## Features

- **Multi-Platform Tracking**: Amazon India & Flipkart
- **Real-Time Price Monitoring**: Automatic checks every 10 minutes (Premium)
- **Smart Alerts**: Price drops, increases, back in stock, out of stock, delivery changes
- **Product Details**: Name, price, image, stock, delivery, seller, ratings
- **User Plans**: Free (5 products) and Premium (100 products)
- **Beautiful Notifications**: Rich formatted messages with images and buttons
- **REST API**: Full API access for integrations
- **Admin Panel**: User management, approvals, broadcasts, stats
- **24/7 Ready**: PM2, Docker, Nginx support

## Tech Stack

- **Runtime**: Node.js 20 LTS
- **Framework**: Telegraf 4.x
- **Scraping**: Playwright + Cheerio
- **Database**: PostgreSQL 16
- **Cache**: Redis (optional)
- **API**: Express.js
- **Process Manager**: PM2
- **Container**: Docker & Docker Compose

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis (optional)
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))

### Installation

```bash
# Clone repository
git clone <repo-url> price-tracker-bot
cd price-tracker-bot

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Run database migrations
npm run migrate

# Start the bot
npm start
```

### Docker Installation

```bash
# Copy and configure environment
cp .env.example .env
nano .env

# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f bot

# Stop all services
docker-compose down
```

### PM2 Installation

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BOT_TOKEN` | Telegram Bot Token (required) | - |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `ADMIN_IDS` | Comma-separated Telegram user IDs | - |
| `FREE_PRODUCT_LIMIT` | Max products for free users | `5` |
| `PREMIUM_PRODUCT_LIMIT` | Max products for premium users | `100` |
| `MONITOR_INTERVAL_MINUTES` | Check interval | `10` |
| `API_PORT` | REST API port | `3000` |
| `API_KEY` | API authentication key | - |

Full list in `.env.example`.

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/start` | Start the bot and register |
| `/help` | Show help message |
| `/add <url> <price>` | Add product to track |
| `/remove <id>` | Remove product |
| `/list` | List all tracked products |
| `/status <id>` | Check product status |
| `/myplan` | View current plan |
| `/upgrade` | Upgrade to Premium |
| `/cancel` | Cancel subscription |
| `/settings` | Configure notifications |
| `/about` | About the bot |

## API Documentation

### Authentication

All API requests require the `x-api-key` header:

```bash
curl -H "x-api-key: your_api_key" http://localhost:3000/api/health
```

### Endpoints

#### Health Check
```http
GET /api/health
Response: { "status": "ok", "database": "healthy", ... }
```

#### User Management
```http
POST /api/auth/register
Body: { "telegramId": 123456789, "username": "john" }

GET /api/auth/:telegramId
```

#### Products
```http
GET /api/products/:telegramId?page=1&limit=20

POST /api/products
Body: { "telegramId": 123, "url": "...", "targetPrice": 15000 }

DELETE /api/products/:productId
```

#### Admin
```http
GET /api/admin/stats
GET /api/admin/pending
GET /api/admin/users?page=1&limit=20
POST /api/admin/approve/:subscriptionId
POST /api/admin/reject/:subscriptionId
```

## Project Structure

```
├── api/                    # REST API server
│   ├── server.js          # Express app
│   └── routes/            # API routes
├── sql/                   # Database schemas
│   └── schema.sql
├── src/
│   ├── index.js           # Entry point
│   ├── config/            # Configuration
│   ├── database/          # Database layer
│   │   ├── connection.js  # Pool & queries
│   │   ├── migrate.js     # Migration runner
│   │   └── queries/       # SQL query modules
│   ├── bot/               # Telegram bot
│   │   ├── index.js       # Bot setup & handlers
│   │   └── keyboard.js    # Keyboard layouts
│   ├── commands/          # Bot commands
│   ├── services/          # Business logic
│   │   ├── monitor.js     # Price monitoring
│   │   ├── notification.js # Alert messages
│   │   ├── admin.js       # Admin functions
│   │   └── subscription.js# Plan management
│   ├── scraper/           # Web scraping
│   │   ├── base.js        # Base scraper
│   │   ├── amazon.js      # Amazon scraper
│   │   ├── flipkart.js    # Flipkart scraper
│   │   └── index.js       # Scraper factory
│   ├── middleware/        # Bot middleware
│   └── utils/             # Utilities
├── Dockerfile
├── docker-compose.yml
├── ecosystem.config.js    # PM2 config
├── nginx.conf             # Nginx config
└── package.json
```

## Deployment

### Oracle Cloud (Ubuntu 22.04)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql redis-server nginx

# Install PM2
sudo npm install -g pm2

# Clone and setup project
git clone <repo> /opt/price-tracker
cd /opt/price-tracker
cp .env.example .env
nano .env  # Configure your settings

# Install dependencies
npm install
npx playwright install chromium

# Setup PostgreSQL
sudo -u postgres psql -c "CREATE DATABASE price_tracker;"
sudo -u postgres psql -c "CREATE USER ptbuser WITH PASSWORD 'securepass';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE price_tracker TO ptbuser;"

# Run migrations
npm run migrate

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup -u ubuntu --hp /home/ubuntu

# Configure Nginx
sudo cp nginx.conf /etc/nginx/sites-available/price-tracker
sudo ln -s /etc/nginx/sites-available/price-tracker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Railway

1. Create a new project on Railway
2. Add PostgreSQL plugin
3. Connect your GitHub repo
4. Set environment variables in Railway dashboard
5. Deploy - Railway auto-detects Node.js and runs `npm start`

### Render

1. Create a new Web Service on Render
2. Connect your GitHub repo
3. Set build command: `npm install && npx playwright install chromium`
4. Set start command: `npm start`
5. Add environment variables
6. Create a PostgreSQL database in Render dashboard
7. Deploy

## Database Schema

6 core tables + 2 views:

- `users` - User accounts and profiles
- `plans` - Subscription plans (Free, Premium)
- `subscriptions` - User subscriptions
- `products` - Tracked products
- `price_history` - Price change history
- `alerts` - Generated alerts
- `notifications` - User notifications
- `activity_logs` - Audit trail
- `settings` - Global and per-user settings

## Security

- Rate limiting (bot & API)
- Input validation & sanitization
- API key authentication
- Helmet security headers
- CORS configuration
- PostgreSQL parameterized queries
- Environment-based configuration
- Error handling & logging
- Retry mechanisms for scraping

## Monitoring

- Automatic price checking every N minutes
- Error tracking with retry logic
- Database connection pooling
- Winston logging (file + console)
- PM2 process monitoring
- Docker health checks
- Nginx rate limiting

## License

MIT
