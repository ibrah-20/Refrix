const db = require('../db');
const {
  userRepository,
  transactionRepository,
  withdrawalRepository,
  adminLogRepository,
  walletTransactionRepository,
  notificationRepository,
  fraudFlagRepository,
} = require('../repositories');
const logger = require('../utils/logger');

const logAction = async (adminId, action, details, ip, targetUserId = null, targetWithdrawalId = null) => {
  try {
    await adminLogRepository.create({
      adminId,
      action,
      details,
      ipAddress: ip,
      targetUserId,
      targetWithdrawalId,
    });
  } catch (err) {
    logger.error('Failed to log admin action:', err);
  }
};

// Dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsersRes,
      paidUsersRes,
      revenueRes,
      pendingWdRes,
      totalWdRes,
      suspiciousRes,
      recentTxRes,
    ] = await Promise.all([
      db.query("SELECT COUNT(*) FROM users WHERE role = 'user'"),
      db.query("SELECT COUNT(*) FROM users WHERE role = 'user' AND is_paid = true"),
      db.query("SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE type = 'registration' AND status = 'completed'"),
      db.query("SELECT COUNT(*) FROM withdrawals WHERE status = 'pending'"),
      db.query("SELECT COALESCE(SUM(amount), 0) AS total FROM withdrawals WHERE status IN ('approved', 'processed')"),
      db.query("SELECT COUNT(*) FROM users WHERE is_suspicious = true"),
      db.query(`
        SELECT t.*, u.full_name, u.email, u.phone
        FROM transactions t
        JOIN users u ON t.user_id = u.id
        WHERE t.type = 'registration'
        ORDER BY t.created_at DESC
        LIMIT 10
      `),
    ]);

    const totalUsers = parseInt(totalUsersRes.rows[0].count, 10);
    const paidUsers = parseInt(paidUsersRes.rows[0].count, 10);
    const totalRevenue = parseFloat(revenueRes.rows[0].total);
    const pendingWithdrawals = parseInt(pendingWdRes.rows[0].count, 10);
    const totalWithdrawals = parseFloat(totalWdRes.rows[0].total);
    const suspiciousAccounts = parseInt(suspiciousRes.rows[0].count, 10);

    const recentTransactions = recentTxRes.rows.map((t) => ({
      id: t.id,
      _id: t.id,
      amount: parseFloat(t.amount),
      type: t.type,
      status: t.status,
      createdAt: t.created_at,
      user: {
        fullName: t.full_name,
        email: t.email,
        phone: t.phone,
      },
    }));

    res.json({
      success: true,
      stats: {
        totalUsers,
        paidUsers,
        unpaidUsers: totalUsers - paidUsers,
        totalRevenue,
        pendingWithdrawals,
        totalWithdrawals,
        suspiciousAccounts,
        recentTransactions,
      },
    });
  } catch (error) {
    logger.error('Admin dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load stats.' });
  }
};

// List users
exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const limitNum = parseInt(limit, 10);
    const offset = (parseInt(page, 10) - 1) * limitNum;

    let whereClauses = ["u.role = 'user'"];
    let params = [];
    let paramIdx = 1;

    if (search) {
      whereClauses.push(`(u.full_name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR u.phone ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (status === 'suspicious') whereClauses.push('u.is_suspicious = true');
    if (status === 'banned') whereClauses.push('u.is_banned = true');
    if (status === 'paid') whereClauses.push('u.is_paid = true');

    const whereSql = whereClauses.join(' AND ');
    const countRes = await db.query(`SELECT COUNT(*) FROM users u WHERE ${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const usersRes = await db.query(
      `
      SELECT u.*, r.full_name AS referrer_name, r.email AS referrer_email
      FROM users u
      LEFT JOIN users r ON u.referred_by_id = r.id
      WHERE ${whereSql}
      ORDER BY u.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `,
      [...params, limitNum, offset]
    );

    const users = usersRes.rows.map((u) => ({
      id: u.id,
      _id: u.id,
      fullName: u.full_name,
      email: u.email,
      phone: u.phone,
      referralCode: u.referral_code,
      isPaid: u.is_paid,
      walletBalance: parseFloat(u.wallet_balance),
      totalEarned: parseFloat(u.total_earned),
      totalWithdrawn: parseFloat(u.total_withdrawn),
      qualifiedReferralsCount: parseInt(u.qualified_referrals_count, 10),
      isSuspicious: u.is_suspicious,
      isBanned: u.is_banned,
      banReason: u.ban_reason,
      role: u.role,
      createdAt: u.created_at,
      referredBy: u.referrer_name
        ? { fullName: u.referrer_name, email: u.referrer_email }
        : null,
    }));

    res.json({ success: true, users, total, page: parseInt(page, 10), pages: Math.ceil(total / limitNum) });
  } catch (error) {
    logger.error('Admin getUsers error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
};

// Ban user
exports.banUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id || req.user._id;

    const user = await userRepository.updateBanStatus(userId, true, reason || 'Banned by admin');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    await logAction(adminId, 'BAN_USER', { reason }, req.ip, userId);

    await notificationRepository.create({
      userId,
      type: 'account_warning',
      title: 'Account Warning / Status Update',
      message: `Your account status has been updated: Banned. Reason: ${reason || 'Violation of terms.'}`,
      metadata: { reason },
    });

    res.json({ success: true, message: `User ${user.email} banned.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to ban user.' });
  }
};

// Unban user
exports.unbanUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id || req.user._id;

    const user = await userRepository.updateBanStatus(userId, false, null);

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    await logAction(adminId, 'UNBAN_USER', {}, req.ip, userId);

    res.json({ success: true, message: `User ${user.email} unbanned.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to unban user.' });
  }
};

// Get pending withdrawals
exports.getWithdrawals = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const limitNum = parseInt(limit, 10);
    const offset = (parseInt(page, 10) - 1) * limitNum;

    const countRes = await db.query('SELECT COUNT(*) FROM withdrawals WHERE status = $1', [status]);
    const total = parseInt(countRes.rows[0].count, 10);

    const withdrawalsRes = await db.query(
      `
      SELECT w.*, u.full_name, u.email, u.phone, u.wallet_balance
      FROM withdrawals w
      JOIN users u ON w.user_id = u.id
      WHERE w.status = $1
      ORDER BY w.created_at ASC
      LIMIT $2 OFFSET $3
    `,
      [status, limitNum, offset]
    );

    const withdrawals = withdrawalsRes.rows.map((w) => ({
      id: w.id,
      _id: w.id,
      amount: parseFloat(w.amount),
      phoneNumber: w.phone_number,
      status: w.status,
      adminNote: w.admin_note,
      processedAt: w.processed_at,
      mpesaReceiptNumber: w.mpesa_receipt_number,
      createdAt: w.created_at,
      user: {
        id: w.user_id,
        fullName: w.full_name,
        email: w.email,
        phone: w.phone,
        walletBalance: parseFloat(w.wallet_balance),
      },
    }));

    res.json({ success: true, withdrawals, total });
  } catch (error) {
    logger.error('Admin getWithdrawals error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch withdrawals.' });
  }
};

// Approve withdrawal
exports.approveWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { mpesaReceiptNumber } = req.body;
    const adminId = req.user.id || req.user._id;

    await db.withTransaction(async (client) => {
      const withdrawal = await withdrawalRepository.findByIdForUpdate(withdrawalId, client);
      if (!withdrawal) {
        throw new Error('WITHDRAWAL_NOT_FOUND');
      }
      if (withdrawal.status !== 'pending') {
        throw new Error('WITHDRAWAL_ALREADY_PROCESSED');
      }

      await withdrawalRepository.updateStatus(
        withdrawalId,
        'approved',
        adminId,
        null,
        mpesaReceiptNumber || null,
        client
      );

      // Total withdrawn delta = +amount
      await userRepository.updateWalletBalance(withdrawal.user_id, 0, 0, parseFloat(withdrawal.amount), client);

      await notificationRepository.create(
        {
          userId: withdrawal.user_id,
          type: 'withdrawal_completed',
          title: 'Withdrawal Approved',
          message: `Your withdrawal of KES ${withdrawal.amount} has been approved.`,
          metadata: { withdrawalId, amount: parseFloat(withdrawal.amount), mpesaReceiptNumber: mpesaReceiptNumber || null },
        },
        client
      );

      await logAction(adminId, 'APPROVE_WITHDRAWAL', { amount: parseFloat(withdrawal.amount) }, req.ip, withdrawal.user_id, withdrawalId);
    });

    res.json({ success: true, message: 'Withdrawal approved.' });
  } catch (error) {
    if (error.message === 'WITHDRAWAL_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Withdrawal not found.' });
    }
    if (error.message === 'WITHDRAWAL_ALREADY_PROCESSED') {
      return res.status(400).json({ success: false, message: 'Withdrawal already processed.' });
    }
    logger.error('Approve withdrawal error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve withdrawal.' });
  }
};

// Reject withdrawal
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id || req.user._id;

    await db.withTransaction(async (client) => {
      const withdrawal = await withdrawalRepository.findByIdForUpdate(withdrawalId, client);
      if (!withdrawal) {
        throw new Error('WITHDRAWAL_NOT_FOUND');
      }
      if (withdrawal.status !== 'pending') {
        throw new Error('WITHDRAWAL_ALREADY_PROCESSED');
      }

      // Refund wallet: amountChange = +amount
      const updatedUser = await userRepository.updateWalletBalance(
        withdrawal.user_id,
        parseFloat(withdrawal.amount),
        0,
        0,
        client
      );

      await withdrawalRepository.updateStatus(withdrawalId, 'rejected', adminId, reason || null, null, client);

      // Ledger refund record
      await walletTransactionRepository.create(
        {
          userId: withdrawal.user_id,
          type: 'refund',
          amount: parseFloat(withdrawal.amount),
          description: `Withdrawal rejected: ${reason || 'Admin rejected'}`,
          reference: `refund_wd_${withdrawalId}`,
          status: 'completed',
          balanceAfter: parseFloat(updatedUser ? updatedUser.wallet_balance : 0),
          relatedWithdrawalId: withdrawalId,
        },
        client
      );

      await logAction(adminId, 'REJECT_WITHDRAWAL', { reason }, req.ip, withdrawal.user_id, withdrawalId);

      await notificationRepository.create(
        {
          userId: withdrawal.user_id,
          type: 'withdrawal_failed',
          title: 'Withdrawal Rejected',
          message: `Your withdrawal request of KES ${withdrawal.amount} was rejected and refunded. Reason: ${reason || 'Admin rejected'}`,
          metadata: { withdrawalId, amount: parseFloat(withdrawal.amount), reason },
        },
        client
      );
    });

    res.json({ success: true, message: 'Withdrawal rejected and amount refunded to wallet.' });
  } catch (error) {
    if (error.message === 'WITHDRAWAL_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Withdrawal not found.' });
    }
    if (error.message === 'WITHDRAWAL_ALREADY_PROCESSED') {
      return res.status(400).json({ success: false, message: 'Withdrawal already processed.' });
    }
    logger.error('Reject withdrawal error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject withdrawal.' });
  }
};


// Get all transactions (admin)
exports.getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    const limitNum = parseInt(limit, 10);
    const offset = (parseInt(page, 10) - 1) * limitNum;

    let whereClauses = [];
    let params = [];
    let paramIdx = 1;

    if (status) {
      whereClauses.push(`t.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }
    if (type) {
      whereClauses.push(`t.type = $${paramIdx}`);
      params.push(type);
      paramIdx++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await db.query(`SELECT COUNT(*) FROM transactions t ${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const txRes = await db.query(
      `
      SELECT t.*, u.full_name, u.email, u.phone
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      ${whereSql}
      ORDER BY t.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `,
      [...params, limitNum, offset]
    );

    const transactions = txRes.rows.map((t) => ({
      id: t.id,
      _id: t.id,
      amount: parseFloat(t.amount),
      type: t.type,
      status: t.status,
      description: t.description,
      mpesaReceiptNumber: t.mpesa_receipt_number,
      createdAt: t.created_at,
      user: {
        id: t.user_id,
        fullName: t.full_name,
        email: t.email,
        phone: t.phone,
      },
    }));

    res.json({ success: true, transactions, total });
  } catch (error) {
    logger.error('Admin getTransactions error:', error);
    res.status(500).json({ success: false, message: 'Failed.' });
  }
};

// Admin logs
exports.getAdminLogs = async (req, res) => {
  try {
    const logsRes = await db.query(`
      SELECT l.*, a.full_name AS admin_name, a.email AS admin_email,
             tu.full_name AS target_user_name, tu.email AS target_user_email
      FROM admin_logs l
      JOIN users a ON l.admin_id = a.id
      LEFT JOIN users tu ON l.target_user_id = tu.id
      ORDER BY l.created_at DESC
      LIMIT 100
    `);

    const logs = logsRes.rows.map((l) => ({
      id: l.id,
      _id: l.id,
      action: l.action,
      details: l.details,
      ipAddress: l.ip_address,
      createdAt: l.created_at,
      admin: {
        fullName: l.admin_name,
        email: l.admin_email,
      },
      targetUser: l.target_user_name
        ? { fullName: l.target_user_name, email: l.target_user_email }
        : null,
    }));

    res.json({ success: true, logs });
  } catch (error) {
    logger.error('Admin getAdminLogs error:', error);
    res.status(500).json({ success: false, message: 'Failed.' });
  }
};

// Get fraud flags
exports.getFraudFlags = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const limitNum = parseInt(limit, 10);
    const offset = (parseInt(page, 10) - 1) * limitNum;

    let whereClauses = [];
    let params = [];
    let paramIdx = 1;

    if (status) {
      whereClauses.push(`f.risk_status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await db.query(`SELECT COUNT(*) FROM fraud_flags f ${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const flagsRes = await db.query(
      `
      SELECT f.*, u.full_name, u.email, u.phone
      FROM fraud_flags f
      JOIN users u ON f.user_id = u.id
      ${whereSql}
      ORDER BY f.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `,
      [...params, limitNum, offset]
    );

    const flags = flagsRes.rows.map((f) => ({
      id: f.id,
      _id: f.id,
      userId: f.user_id,
      type: f.type,
      riskStatus: f.risk_status,
      description: f.description,
      relatedTransactionId: f.related_transaction_id,
      relatedWithdrawalId: f.related_withdrawal_id,
      metadata: f.metadata,
      reviewedById: f.reviewed_by_id,
      reviewNote: f.review_note,
      reviewedAt: f.reviewed_at,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
      user: {
        id: f.user_id,
        fullName: f.full_name,
        email: f.email,
        phone: f.phone,
      },
    }));

    res.json({ success: true, flags, total, page: parseInt(page, 10), pages: Math.ceil(total / limitNum) });
  } catch (error) {
    logger.error('Admin getFraudFlags error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fraud flags.' });
  }
};

// Update fraud flag status
exports.updateFraudFlagStatus = async (req, res) => {
  try {
    const { flagId } = req.params;
    const { status, note } = req.body;
    const adminId = req.user.id || req.user._id;

    if (!['clear', 'review', 'block', 'flagged', 'under_review', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid risk status.' });
    }

    const updatedFlag = await fraudFlagRepository.updateRiskStatus(flagId, status, adminId, note || null);
    if (!updatedFlag) {
      return res.status(404).json({ success: false, message: 'Fraud flag not found.' });
    }

    await logAction(
      adminId,
      'UPDATE_FRAUD_FLAG_STATUS',
      { newStatus: status, note },
      req.ip,
      updatedFlag.user_id
    );

    res.json({ success: true, message: `Fraud flag status updated to ${status}.`, flag: updatedFlag });
  } catch (error) {
    logger.error('Admin updateFraudFlagStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to update fraud flag status.' });
  }
};

