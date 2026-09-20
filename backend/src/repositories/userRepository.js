const db = require('../db');

/**
 * Repository for `users` PostgreSQL table
 */
const userRepository = {
  async findById(id, dbClient = db) {
    const res = await dbClient.query('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] || null;
  },

  async findByEmail(email, dbClient = db) {
    const res = await dbClient.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    return res.rows[0] || null;
  },

  async findByPhone(phone, dbClient = db) {
    const res = await dbClient.query('SELECT * FROM users WHERE phone = $1', [phone.trim()]);
    return res.rows[0] || null;
  },

  async findByReferralCode(referralCode, dbClient = db) {
    const res = await dbClient.query('SELECT * FROM users WHERE referral_code = $1', [referralCode.toUpperCase()]);
    return res.rows[0] || null;
  },

  async create(userData, dbClient = db) {
    const {
      fullName,
      email,
      phone,
      passwordHash,
      referralCode,
      referredById = null,
      role = 'user',
      isPaid = false,
      registrationIP = null,
      deviceFingerprint = null,
    } = userData;

    const sql = `
      INSERT INTO users (
        full_name, email, phone, password_hash, referral_code, referred_by_id,
        role, is_paid, registration_ip, device_fingerprint
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const params = [
      fullName,
      email.toLowerCase().trim(),
      phone.trim(),
      passwordHash,
      referralCode,
      referredById,
      role,
      isPaid,
      registrationIP,
      deviceFingerprint,
    ];

    const res = await dbClient.query(sql, params);
    return res.rows[0];
  },

  async updateWalletBalance(id, amountChange, totalEarnedDelta = 0, totalWithdrawnDelta = 0, dbClient = db) {
    const sql = `
      UPDATE users
      SET wallet_balance = wallet_balance + $2,
          total_earned = total_earned + $3,
          total_withdrawn = total_withdrawn + $4,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await dbClient.query(sql, [id, amountChange, totalEarnedDelta, totalWithdrawnDelta]);
    return res.rows[0] || null;
  },

  async incrementQualifiedReferrals(id, dbClient = db) {
    const sql = `
      UPDATE users
      SET qualified_referrals_count = qualified_referrals_count + 1,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await dbClient.query(sql, [id]);
    return res.rows[0] || null;
  },

  async updateBanStatus(id, isBanned, banReason = null, dbClient = db) {
    const sql = `
      UPDATE users
      SET is_banned = $2,
          ban_reason = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await dbClient.query(sql, [id, isBanned, banReason]);
    return res.rows[0] || null;
  },

  async updateLastLogin(id, loginIP, dbClient = db) {
    const sql = `
      UPDATE users
      SET last_login_at = NOW(),
          last_login_ip = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await dbClient.query(sql, [id, loginIP]);
    return res.rows[0] || null;
  },

  async findByIdForUpdate(id, dbClient = db) {
    const res = await dbClient.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [id]);
    return res.rows[0] || null;
  },

  async findAll(limit = 50, offset = 0, dbClient = db) {
    const res = await dbClient.query(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return res.rows;
  }
};

module.exports = userRepository;

