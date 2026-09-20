require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payments');
const referralRoutes = require('./routes/referrals');
const withdrawalRoutes = require('./routes/withdrawals');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');


const app = express();

// Trust reverse proxy (Render / Cloudflare load balancers)
app.set('trust proxy', 1);

// Auto-seed admin user in development mode
(async () => {
  if (process.env.NODE_ENV === 'development') {
    try {
      const bcrypt = require('bcryptjs');
      const { userRepository } = require('./repositories');
      const { nanoid } = require('nanoid');
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@refrix.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPass123!';

      const existing = await userRepository.findByEmail(adminEmail);
      if (!existing) {
        const passwordHash = await bcrypt.hash(adminPassword, 12);
        await userRepository.create({
          fullName: 'Refrix Admin',
          email: adminEmail,
          phone: '254700000000',
          passwordHash,
          referralCode: nanoid(8).toUpperCase(),
          role: 'admin',
          isPaid: true,
        });
        logger.info(`Admin user auto-seeded: ${adminEmail}`);
      }
    } catch (err) {
      logger.error(`Failed to auto-seed admin: ${err.message}`);
    }
  }
})();


// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Rate limiting for general API endpoints
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api', limiter);

// Stricter rate limit for authentication endpoints (per client IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts. Try again in 15 minutes.' },
});
app.use('/api/auth', authLimiter);

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
}

// Health check
app.get('/health', (req, res) => {
  let dbHost = 'none';
  let dbSource = 'none';
  try {
    const rawUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
    if (rawUrl) {
      const parsed = new URL(rawUrl);
      dbHost = parsed.hostname;
      dbSource = process.env.DATABASE_URL ? 'DATABASE_URL' : 'SUPABASE_DATABASE_URL';
    } else if (process.env.SUPABASE_DB_HOST || process.env.SUPABASE_URL) {
      dbHost = process.env.SUPABASE_DB_HOST || (process.env.SUPABASE_URL ? `db.${process.env.SUPABASE_URL.replace('https://', '').split('.')[0]}.supabase.co` : 'localhost');
      dbSource = 'FALLBACK (DATABASE_URL unset)';
    }
  } catch (_) {}

  res.json({ status: 'ok', env: process.env.NODE_ENV, dbSource, dbHost });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);


// 404
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found.' }));

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV}]`));

module.exports = app;
