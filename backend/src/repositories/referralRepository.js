const db = require('../db');

/**
 * Repository for `referrals` PostgreSQL table
 */
const referralRepository = {
  async create(referrerId, refereeId, level, dbClient = db) {
    const sql = `
      INSERT INTO referrals (referrer_id, referee_id, level, status, commission_amount, commission_paid)
      VALUES ($1, $2, $3, 'pending', 0.00, false)
      ON CONFLICT (referrer_id, referee_id) DO NOTHING
      RETURNING *
    `;
    const res = await dbClient.query(sql, [referrerId, refereeId, level]);
    return res.rows[0] || null;
  },

  async findById(id, dbClient = db) {
    const res = await dbClient.query('SELECT * FROM referrals WHERE id = $1', [id]);
    return res.rows[0] || null;
  },

  async findPair(referrerId, refereeId, dbClient = db) {
    const res = await dbClient.query(
      'SELECT * FROM referrals WHERE referrer_id = $1 AND referee_id = $2',
      [referrerId, refereeId]
    );
    return res.rows[0] || null;
  },

  async findByReferrer(referrerId, dbClient = db) {
    const res = await dbClient.query(
      'SELECT * FROM referrals WHERE referrer_id = $1 ORDER BY created_at DESC',
      [referrerId]
    );
    return res.rows;
  },

  async findByReferee(refereeId, dbClient = db) {
    const res = await dbClient.query(
      'SELECT * FROM referrals WHERE referee_id = $1 ORDER BY level ASC',
      [refereeId]
    );
    return res.rows;
  },

  async markQualified(id, commissionAmount, dbClient = db) {
    const sql = `
      UPDATE referrals
      SET status = 'qualified',
          commission_amount = $2,
          commission_paid = true,
          qualified_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await dbClient.query(sql, [id, commissionAmount]);
    return res.rows[0] || null;
  },

  async markRejected(id, reason, dbClient = db) {
    const sql = `
      UPDATE referrals
      SET status = 'rejected',
          rejection_reason = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await dbClient.query(sql, [id, reason]);
    return res.rows[0] || null;
  }
};

module.exports = referralRepository;
