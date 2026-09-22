require('dotenv').config();
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const { userRepository } = require('../repositories');
const db = require('../db');
const logger = require('./logger');

/**
 * Idempotently ensures the system admin account exists.
 * Safe to run on backend startup across all environments (including Render Free).
 */
const ensureAdminExists = async () => {
  const adminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.toLowerCase().trim() : null;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    logger.info('[ADMIN INITIALIZATION] Skipped: ADMIN_EMAIL or ADMIN_PASSWORD environment variable is missing.');
    return { status: 'skipped', reason: 'missing_credentials' };
  }

  const existing = await userRepository.findByEmail(adminEmail);

  if (existing) {
    if (existing.role === 'admin') {
      logger.info(`[ADMIN INITIALIZATION] Admin account already exists: ${adminEmail}`);
      return { status: 'exists', role: 'admin' };
    }

    logger.warn(
      `[ADMIN INITIALIZATION] WARNING: Configured admin email '${adminEmail}' belongs to an existing account with role '${existing.role}'. Account was NOT modified or escalated. Manual intervention required.`
    );
    return { status: 'conflict', role: existing.role };
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const newAdmin = await userRepository.create({
    fullName: 'Refrix Admin',
    email: adminEmail,
    phone: process.env.ADMIN_PHONE || '254700000000',
    passwordHash,
    referralCode: nanoid(8).toUpperCase(),
    role: 'admin',
    isPaid: true,
  });

  logger.info(`[ADMIN INITIALIZATION] Admin account created successfully: ${adminEmail}`);
  return { status: 'created', email: adminEmail, id: newAdmin.id };
};

if (require.main === module) {
  ensureAdminExists()
    .then(async () => {
      if (db.pool) await db.pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      logger.error(`[ADMIN INITIALIZATION] Manual execution error: ${err.message}`);
      if (db.pool) await db.pool.end();
      process.exit(1);
    });
}

module.exports = {
  ensureAdminExists,
};


