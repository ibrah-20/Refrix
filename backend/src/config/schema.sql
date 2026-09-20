-- ============================================================================
-- REFRIX DATABASE MIGRATION SCRIPT FOR SUPABASE (POSTGRESQL)
-- ============================================================================
-- Source of Truth: Phase 2 Approved Schema Design
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Reusable trigger function for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 1. USERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    referral_code VARCHAR(20) UNIQUE,
    referred_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_banned BOOLEAN NOT NULL DEFAULT false,
    ban_reason TEXT DEFAULT NULL,
    is_paid BOOLEAN NOT NULL DEFAULT true,
    wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (wallet_balance >= 0.00),
    total_earned NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_withdrawn NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    qualified_referrals_count INTEGER NOT NULL DEFAULT 0 CHECK (qualified_referrals_count >= 0),
    registration_ip VARCHAR(45) DEFAULT NULL,
    last_login_ip VARCHAR(45) DEFAULT NULL,
    device_fingerprint TEXT DEFAULT NULL,
    is_suspicious BOOLEAN NOT NULL DEFAULT false,
    suspicious_reason TEXT DEFAULT NULL,
    last_login_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 2. SYSTEM SETTINGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    singleton_key VARCHAR(50) NOT NULL DEFAULT 'default' UNIQUE,
    entry_amount NUMERIC(12, 2) NOT NULL DEFAULT 200.00 CHECK (entry_amount >= 0.00),
    level1_reward NUMERIC(12, 2) NOT NULL DEFAULT 100.00 CHECK (level1_reward >= 0.00),
    level2_reward NUMERIC(12, 2) NOT NULL DEFAULT 50.00 CHECK (level2_reward >= 0.00),
    level3_reward NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (level3_reward >= 0.00),
    max_reward_level INTEGER NOT NULL DEFAULT 2 CHECK (max_reward_level >= 0),
    min_withdrawal NUMERIC(12, 2) NOT NULL DEFAULT 100.00 CHECK (min_withdrawal >= 0.00),
    max_daily_withdrawal NUMERIC(12, 2) NOT NULL DEFAULT 5000.00 CHECK (max_daily_withdrawal >= 0.00),
    max_withdrawals_per_day INTEGER NOT NULL DEFAULT 3 CHECK (max_withdrawals_per_day >= 1),
    withdrawal_cooldown_minutes INTEGER NOT NULL DEFAULT 0 CHECK (withdrawal_cooldown_minutes >= 0),
    min_withdrawal_balance NUMERIC(12, 2) NOT NULL DEFAULT 1500.00 CHECK (min_withdrawal_balance >= 0.00),
    min_qualified_referrals INTEGER NOT NULL DEFAULT 3 CHECK (min_qualified_referrals >= 0),
    last_updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 3. REFERRALS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    referee_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    level INTEGER NOT NULL CHECK (level IN (1, 2)),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'rejected')),
    commission_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (commission_amount >= 0.00),
    commission_paid BOOLEAN NOT NULL DEFAULT false,
    qualified_at TIMESTAMPTZ DEFAULT NULL,
    rejection_reason TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_referrer_referee UNIQUE (referrer_id, referee_id)
);

DROP TRIGGER IF EXISTS update_referrals_updated_at ON referrals;
CREATE TRIGGER update_referrals_updated_at
    BEFORE UPDATE ON referrals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 4. TRANSACTIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('registration', 'commission', 'withdrawal')),
    amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'suspicious')),
    mpesa_checkout_request_id VARCHAR(100) DEFAULT NULL,
    mpesa_merchant_request_id VARCHAR(100) DEFAULT NULL,
    mpesa_receipt_number VARCHAR(100) DEFAULT NULL,
    mpesa_transaction_date VARCHAR(50) DEFAULT NULL,
    mpesa_phone_used VARCHAR(20) DEFAULT NULL,
    phone_match_verified BOOLEAN NOT NULL DEFAULT false,
    phone_mismatch BOOLEAN NOT NULL DEFAULT false,
    description TEXT DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    device_fingerprint TEXT DEFAULT NULL,
    is_suspicious BOOLEAN NOT NULL DEFAULT false,
    suspicious_reason TEXT DEFAULT NULL,
    raw_callback_data JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 5. WITHDRAWALS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 100.00),
    phone_number VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
    admin_note TEXT DEFAULT NULL,
    processed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ DEFAULT NULL,
    mpesa_receipt_number VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_withdrawals_updated_at ON withdrawals;
CREATE TRIGGER update_withdrawals_updated_at
    BEFORE UPDATE ON withdrawals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 6. WALLET TRANSACTIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type VARCHAR(30) NOT NULL CHECK (type IN ('referral_reward', 'withdrawal', 'reversal', 'adjustment', 'refund', 'bonus')),
    amount NUMERIC(12, 2) NOT NULL,
    description TEXT NOT NULL,
    reference VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'reversed')),
    balance_after NUMERIC(12, 2) NOT NULL,
    related_commission_id UUID REFERENCES referrals(id) ON DELETE SET NULL,
    related_withdrawal_id UUID REFERENCES withdrawals(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_reference_type UNIQUE (reference, type)
);

DROP TRIGGER IF EXISTS update_wallet_transactions_updated_at ON wallet_transactions;
CREATE TRIGGER update_wallet_transactions_updated_at
    BEFORE UPDATE ON wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 7. FRAUD FLAGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fraud_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type VARCHAR(40) NOT NULL CHECK (type IN ('multiple_accounts', 'repeated_payment_failures', 'suspicious_referral_velocity', 'phone_reused', 'abnormal_withdrawal_activity', 'repeated_reversals', 'circular_referral_attempt', 'other')),
    risk_status VARCHAR(20) NOT NULL DEFAULT 'review' CHECK (risk_status IN ('review', 'cleared', 'confirmed')),
    description TEXT NOT NULL,
    related_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    related_withdrawal_id UUID REFERENCES withdrawals(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT NULL,
    reviewed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ DEFAULT NULL,
    review_note TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_fraud_flags_updated_at ON fraud_flags;
CREATE TRIGGER update_fraud_flags_updated_at
    BEFORE UPDATE ON fraud_flags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 8. NOTIFICATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('registration_success', 'phone_verified', 'payment_success', 'payment_failed', 'referral_qualified', 'reward_credited', 'withdrawal_requested', 'withdrawal_completed', 'withdrawal_failed', 'account_warning', 'security_event')),
    channel VARCHAR(20) NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'sms')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ DEFAULT NULL,
    metadata JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 9. OTP VERIFICATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    purpose VARCHAR(30) NOT NULL DEFAULT 'registration' CHECK (purpose IN ('registration', 'password_reset', 'phone_change')),
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts >= 1),
    resend_count INTEGER NOT NULL DEFAULT 0 CHECK (resend_count >= 0),
    resend_cooldown_until TIMESTAMPTZ DEFAULT NULL,
    verified BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_otp_verifications_updated_at ON otp_verifications;
CREATE TRIGGER update_otp_verifications_updated_at
    BEFORE UPDATE ON otp_verifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 10. ADMIN LOGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action VARCHAR(255) NOT NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_withdrawal_id UUID REFERENCES withdrawals(id) ON DELETE SET NULL,
    details JSONB DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_admin_logs_updated_at ON admin_logs;
CREATE TRIGGER update_admin_logs_updated_at
    BEFORE UPDATE ON admin_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INDEX CREATION
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by_id);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_mpesa_checkout ON transactions(mpesa_checkout_request_id) WHERE mpesa_checkout_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_mpesa_receipt ON transactions(mpesa_receipt_number) WHERE mpesa_receipt_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_transactions_checkout ON transactions(mpesa_checkout_request_id) WHERE mpesa_checkout_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_completed_receipt ON transactions(mpesa_receipt_number) WHERE mpesa_receipt_number IS NOT NULL AND status = 'completed';

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_created ON wallet_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

CREATE INDEX IF NOT EXISTS idx_fraud_flags_user ON fraud_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_status_created ON fraud_flags(risk_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_otp_user ON otp_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_user_purpose ON otp_verifications(user_id, purpose, verified);

-- Seed Singleton System Settings Default Record
INSERT INTO system_settings (singleton_key) VALUES ('default') ON CONFLICT (singleton_key) DO NOTHING;
