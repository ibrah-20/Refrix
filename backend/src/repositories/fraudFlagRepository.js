const db = require('../db');

/**
 * Repository for `fraud_flags` PostgreSQL table
 */
const fraudFlagRepository = {
  async create(flagData, dbClient = db) {
    const {
      userId,
      type,
      riskStatus = 'review',
      description,
      relatedTransactionId = null,
      relatedWithdrawalId = null,
      metadata = null,
    } = flagData;

    const sql = `
      INSERT INTO fraud_flags (
        user_id, type, risk_status, description,
        related_transaction_id, related_withdrawal_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const params = [
      userId,
      type,
      riskStatus,
      description,
      relatedTransactionId,
      relatedWithdrawalId,
      metadata ? JSON.stringify(metadata) : null,
    ];

    const res = await dbClient.query(sql, params);
    return res.rows[0];
  },

  async findById(id, dbClient = db) {
    const res = await dbClient.query('SELECT * FROM fraud_flags WHERE id = $1', [id]);
    return res.rows[0] || null;
  },

  async findByUser(userId, dbClient = db) {
    const res = await dbClient.query(
      'SELECT * FROM fraud_flags WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return res.rows;
  },

  async findByRiskStatus(riskStatus = 'review', limit = 50, dbClient = db) {
    const res = await dbClient.query(
      'SELECT * FROM fraud_flags WHERE risk_status = $1 ORDER BY created_at DESC LIMIT $2',
      [riskStatus, limit]
    );
    return res.rows;
  },

  async updateRiskStatus(id, riskStatus, reviewedById, reviewNote = null, dbClient = db) {
    const sql = `
      UPDATE fraud_flags
      SET risk_status = $2,
          reviewed_by_id = $3,
          review_note = $4,
          reviewed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await dbClient.query(sql, [id, riskStatus, reviewedById, reviewNote]);
    return res.rows[0] || null;
  }
};

module.exports = fraudFlagRepository;
