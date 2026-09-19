const db = require('../db');

/**
 * Repository for `admin_logs` PostgreSQL table
 */
const adminLogRepository = {
  async create(logData, dbClient = db) {
    const {
      adminId,
      action,
      targetUserId = null,
      targetWithdrawalId = null,
      details = null,
      ipAddress = null,
    } = logData;

    const sql = `
      INSERT INTO admin_logs (
        admin_id, action, target_user_id, target_withdrawal_id, details, ip_address
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const params = [
      adminId,
      action,
      targetUserId,
      targetWithdrawalId,
      details ? JSON.stringify(details) : null,
      ipAddress,
    ];

    const res = await dbClient.query(sql, params);
    return res.rows[0];
  },

  async findByAdmin(adminId, limit = 50, dbClient = db) {
    const res = await dbClient.query(
      'SELECT * FROM admin_logs WHERE admin_id = $1 ORDER BY created_at DESC LIMIT $2',
      [adminId, limit]
    );
    return res.rows;
  },

  async findAll(limit = 50, offset = 0, dbClient = db) {
    const res = await dbClient.query(
      'SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return res.rows;
  }
};

module.exports = adminLogRepository;
