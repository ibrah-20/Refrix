const db = require('../db');

/**
 * Repository for `notifications` PostgreSQL table
 */
const notificationRepository = {
  async create(notifData, dbClient = db) {
    const {
      userId,
      type,
      channel = 'in_app',
      title,
      message,
      read = false,
      metadata = null,
    } = notifData;

    const sql = `
      INSERT INTO notifications (user_id, type, channel, title, message, read, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const params = [
      userId,
      type,
      channel,
      title,
      message,
      read,
      metadata ? JSON.stringify(metadata) : null,
    ];

    const res = await dbClient.query(sql, params);
    return res.rows[0];
  },

  async findByUser(userId, limit = 50, dbClient = db) {
    const res = await dbClient.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return res.rows;
  },

  async markAsRead(id, userId, dbClient = db) {
    const sql = `
      UPDATE notifications
      SET read = true,
          read_at = NOW(),
          updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
    const res = await dbClient.query(sql, [id, userId]);
    return res.rows[0] || null;
  },

  async markAllAsReadForUser(userId, dbClient = db) {
    const sql = `
      UPDATE notifications
      SET read = true,
          read_at = NOW(),
          updated_at = NOW()
      WHERE user_id = $1 AND read = false
      RETURNING *
    `;
    const res = await dbClient.query(sql, [userId]);
    return res.rows;
  }
};

module.exports = notificationRepository;
