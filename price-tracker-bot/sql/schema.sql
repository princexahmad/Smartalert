-- Price Tracker Bot Database Schema
-- PostgreSQL 14+

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    language_code VARCHAR(10) DEFAULT 'en',
    is_active BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notification_enabled BOOLEAN DEFAULT true,
    preferred_currency VARCHAR(10) DEFAULT 'INR'
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- =============================================
-- PLANS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    product_limit INTEGER NOT NULL DEFAULT 5,
    monitor_interval_minutes INTEGER NOT NULL DEFAULT 30,
    price_inr DECIMAL(10,2) NOT NULL DEFAULT 0,
    duration_days INTEGER NOT NULL DEFAULT 30,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plans_code ON plans(code);

-- =============================================
-- SUBSCRIPTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending, active, expired, cancelled, rejected
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    payment_method VARCHAR(50),
    payment_id VARCHAR(255),
    payment_amount DECIMAL(10,2),
    payment_currency VARCHAR(10) DEFAULT 'INR',
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);

-- =============================================
-- PRODUCTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL,
    -- amazon, flipkart
    platform_product_id VARCHAR(255),
    title VARCHAR(500),
    description TEXT,
    image_url TEXT,
    current_price DECIMAL(12,2),
    previous_price DECIMAL(12,2),
    target_price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    discount_percentage DECIMAL(5,2),
    in_stock BOOLEAN DEFAULT true,
    stock_status VARCHAR(50) DEFAULT 'available',
    delivery_available BOOLEAN,
    seller_name VARCHAR(255),
    rating DECIMAL(3,2),
    total_reviews INTEGER,
    category VARCHAR(255),
    brand VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    next_check_at TIMESTAMP WITH TIME ZONE,
    last_price_change_at TIMESTAMP WITH TIME ZONE,
    price_change_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    last_error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, url)
);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_platform ON products(platform);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_next_check_at ON products(next_check_at);
CREATE INDEX IF NOT EXISTS idx_products_platform_product_id ON products(platform_product_id);

-- =============================================
-- PRICE HISTORY TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS price_history (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    in_stock BOOLEAN,
    delivery_available BOOLEAN,
    seller_name VARCHAR(255),
    discount_percentage DECIMAL(5,2),
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_scraped_at ON price_history(scraped_at);

-- =============================================
-- ALERTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    -- price_drop, price_increase, back_in_stock, out_of_stock,
    -- delivery_available, delivery_unavailable, title_change, seller_change
    old_value TEXT,
    new_value TEXT,
    message_text TEXT,
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_product_id ON alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_sent ON alerts(is_sent);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);

-- =============================================
-- NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    -- price_alert, system, admin_broadcast, subscription_expiring
    title VARCHAR(500),
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- =============================================
-- ACTIVITY LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    level VARCHAR(20) DEFAULT 'info',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_level ON activity_logs(level);

-- =============================================
-- SETTINGS TABLE (global and per-user)
-- =============================================
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'string',
    is_global BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, key),
    UNIQUE(key) 
);

CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- =============================================
-- DEFAULT PLANS
-- =============================================
INSERT INTO plans (name, code, description, product_limit, monitor_interval_minutes, price_inr, duration_days, features) VALUES
('Free', 'free', 'Basic plan for getting started with price tracking', 5, 30, 0, 0, 
 '{"max_products": 5, "monitor_interval": "30 min", "price_alerts": true, "stock_alerts": true, "delivery_alerts": true, "api_access": false, "priority_support": false}'),
('Premium Monthly', 'premium_monthly', 'Full access with unlimited product tracking', 100, 10, 499, 30,
 '{"max_products": 100, "monitor_interval": "10 min", "price_alerts": true, "stock_alerts": true, "delivery_alerts": true, "api_access": true, "priority_support": true, "bulk_import": true, "export_data": true}')
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- VIEW: Active premium users
-- =============================================
CREATE OR REPLACE VIEW active_premium_users AS
SELECT u.*, s.plan_id, p.name as plan_name, s.end_date
FROM users u
JOIN subscriptions s ON u.id = s.user_id
JOIN plans p ON s.plan_id = p.id
WHERE s.status = 'active'
  AND s.end_date > NOW()
  AND u.is_active = true;

-- =============================================
-- VIEW: Products needing check
-- =============================================
CREATE OR REPLACE VIEW products_due_for_check AS
SELECT p.*, 
       COALESCE(s.end_date > NOW(), false) as is_premium,
       COALESCE(p2.monitor_interval_minutes, 30) as interval_minutes
FROM products p
LEFT JOIN users u ON p.user_id = u.id
LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
LEFT JOIN plans p2 ON COALESCE(s.plan_id, (SELECT id FROM plans WHERE code = 'free')) = p2.id
WHERE p.is_active = true
  AND (p.next_check_at IS NULL OR p.next_check_at <= NOW());
