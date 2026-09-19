const db = require('../db');

/**
 * Repository for `otp_verifications` PostgreSQL table
 */
const otpVerificationRepository = {
  async create(otpData, dbClient = db) {
    const {
      userId,
      phone,
      purpose = 'registration',
      otpHash,
      expiresAt,
      maxAttempts = 5,
    } = otpData;

    const sql = `
      INSERT INTO otp_verifications (
        user_id, phone, purpose, otp_hash, expires_at, max_attempts
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const params = [userId, phone.trim(), purpose, otpHash, expiresAt, maxAttempts];
    const res = await dbClient.query(sql, params);
    return res.rows[0];
  },

  async findLatestActive(userId, purpose, dbClient = db) {
    const sql = `
      SELECT * FROM otp_verifications
      WHERE user_id = $1 AND purpose = $2 AND verified = false AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const res = await dbClient.query(sql, [userId, purpose]);
    return res.rows[0] || null;
  },

  async incrementAttempts(id, dbClient = db) {
    const sql = `
      UPDATE otp_verifications
      SET attempts = attempts + 1,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await dbClient.query(sql, [id]);
    return res.rows[0] || null;
  },

  async markVerified(id, dbClient = db) {
    const sql = `
      UPDATE otp_verifications
      SET verified = true,
          verified_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await dbClient.query(sql, [id]);
    return res.rows[0] || null;
  }
};

module.exports = otpVerificationRepository;
