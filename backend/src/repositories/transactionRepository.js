const db = require('../db');

/**
 * Repository for `transactions` PostgreSQL table
 */
const transactionRepository = {
  async create(txData, dbClient = db) {
    const {
      userId,
      type,
      amount,
      status = 'pending',
      mpesaCheckoutRequestId = null,
      mpesaMerchantRequestId = null,
      mpesaReceiptNumber = null,
      mpesaTransactionDate = null,
      mpesaPhoneUsed = null,
      phoneMatchVerified = false,
      phoneMismatch = false,
      description = null,
      ipAddress = null,
      deviceFingerprint = null,
      isSuspicious = false,
      suspiciousReason = null,
      rawCallbackData = null,
    } = txData;

    const sql = `
      INSERT INTO transactions (
        user_id, type, amount, status,
        mpesa_checkout_request_id, mpesa_merchant_request_id, mpesa_receipt_number,
        mpesa_transaction_date, mpesa_phone_used, phone_match_verified, phone_mismatch,
        description, ip_address, device_fingerprint, is_suspicious, suspicious_reason,
        raw_callback_data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;

    const params = [
      userId,
      type,
      amount,
      status,
      mpesaCheckoutRequestId,
      mpesaMerchantRequestId,
      mpesaReceiptNumber,
      mpesaTransactionDate,
      mpesaPhoneUsed,
      phoneMatchVerified,
      phoneMismatch,
      description,
      ipAddress,
      deviceFingerprint,
      isSuspicious,
      suspiciousReason,
      rawCallbackData ? JSON.stringify(rawCallbackData) : null,
    ];

    const res = await dbClient.query(sql, params);
    return res.rows[0];
  },

  async findById(id, dbClient = db) {
    const res = await dbClient.query('SELECT * FROM transactions WHERE id = $1', [id]);
    return res.rows[0] || null;
  },

  async findByCheckoutRequestId(checkoutRequestId, dbClient = db) {
    const res = await dbClient.query(
      'SELECT * FROM transactions WHERE mpesa_checkout_request_id = $1',
      [checkoutRequestId]
    );
    return res.rows[0] || null;
  },

  async findByCheckoutRequestIdForUpdate(checkoutRequestId, dbClient = db) {
    const res = await dbClient.query(
      'SELECT * FROM transactions WHERE mpesa_checkout_request_id = $1 FOR UPDATE',
      [checkoutRequestId]
    );
    return res.rows[0] || null;
  },

  async findByReceiptNumber(receiptNumber, dbClient = db) {
    const res = await dbClient.query(
      'SELECT * FROM transactions WHERE mpesa_receipt_number = $1',
      [receiptNumber]
    );
    return res.rows[0] || null;
  },

  async findByUser(userId, limit = 50, dbClient = db) {
    const res = await dbClient.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return res.rows;
  },

  async updateStatus(id, status, details = {}, dbClient = db) {
    const { mpesaReceiptNumber = null, mpesaTransactionDate = null, rawCallbackData = null, isSuspicious = false, suspiciousReason = null } = details;

    const sql = `
      UPDATE transactions
      SET status = $2,
          mpesa_receipt_number = COALESCE($3, mpesa_receipt_number),
          mpesa_transaction_date = COALESCE($4, mpesa_transaction_date),
          raw_callback_data = COALESCE($5, raw_callback_data),
          is_suspicious = COALESCE($6, is_suspicious),
          suspicious_reason = COALESCE($7, suspicious_reason),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const params = [
      id,
      status,
      mpesaReceiptNumber,
      mpesaTransactionDate,
      rawCallbackData ? JSON.stringify(rawCallbackData) : null,
      isSuspicious,
      suspiciousReason,
    ];

    const res = await dbClient.query(sql, params);
    return res.rows[0] || null;
  },

  async findByIdForUpdate(id, dbClient = db) {
    const res = await dbClient.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [id]);
    return res.rows[0] || null;
  }
};

module.exports = transactionRepository;


