const db = require('../db');

/**
 * Repository for `withdrawals` PostgreSQL table
 */
const withdrawalRepository = {
  async create(withdrawalData, dbClient = db) {
    const { userId, amount, phoneNumber, status = 'pending', adminNote = null } = withdrawalData;

    const sql = `
      INSERT INTO withdrawals (user_id, amount, phone_number, status, admin_note)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const res = await dbClient.query(sql, [userId, amount, phoneNumber, status, adminNote]);
    return res.rows[0];
  },

  async findById(id, dbClient = db) {
    const res = await dbClient.query('SELECT * FROM withdrawals WHERE id = $1', [id]);
    return res.rows[0] || null;
  },

  async findByUser(userId, limit = 50, dbClient = db) {
    const res = await dbClient.query(
      'SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return res.rows;
  },

  async findByStatus(status, limit = 50, dbClient = db) {
    const res = await dbClient.query(
      'SELECT * FROM withdrawals WHERE status = $1 ORDER BY created_at ASC LIMIT $2',
      [status, limit]
    );
    return res.rows;
  },

  async updateStatus(id, status, processedById = null, adminNote = null, mpesaReceiptNumber = null, dbClient = db) {
    const sql = `
      UPDATE withdrawals
      SET status = $2,
          processed_by_id = COALESCE($3, processed_by_id),
          admin_note = COALESCE($4, admin_note),
          mpesa_receipt_number = COALESCE($5, mpesa_receipt_number),
          processed_at = CASE WHEN $2 IN ('approved', 'processed', 'rejected') THEN NOW() ELSE processed_at END,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await dbClient.query(sql, [id, status, processedById, adminNote, mpesaReceiptNumber]);
    return res.rows[0] || null;
  }
};

module.exports = withdrawalRepository;
