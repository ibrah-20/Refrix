const db = require('../db');

/**
 * Repository for `wallet_transactions` PostgreSQL table (Append-only immutable ledger)
 */
const walletTransactionRepository = {
  async create(entryData, dbClient = db) {
    const {
      userId,
      type,
      amount,
      description,
      reference,
      status = 'completed',
      balanceAfter,
      relatedCommissionId = null,
      relatedWithdrawalId = null,
    } = entryData;

    const sql = `
      INSERT INTO wallet_transactions (
        user_id, type, amount, description, reference, status, balance_after,
        related_commission_id, related_withdrawal_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (reference, type) DO NOTHING
      RETURNING *
    `;

    const params = [
      userId,
      type,
      amount,
      description,
      reference,
      status,
      balanceAfter,
      relatedCommissionId,
      relatedWithdrawalId,
    ];

    const res = await dbClient.query(sql, params);
    return res.rows[0] || null;
  },

  async findById(id, dbClient = db) {
    const res = await dbClient.query('SELECT * FROM wallet_transactions WHERE id = $1', [id]);
    return res.rows[0] || null;
  },

  async findByReferenceAndType(reference, type, dbClient = db) {
    const res = await dbClient.query(
      'SELECT * FROM wallet_transactions WHERE reference = $1 AND type = $2',
      [reference, type]
    );
    return res.rows[0] || null;
  },

  async findByUser(userId, limit = 50, offset = 0, dbClient = db) {
    const res = await dbClient.query(
      'SELECT * FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
    return res.rows;
  }
};

module.exports = walletTransactionRepository;
