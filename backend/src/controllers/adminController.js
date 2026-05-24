const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const Referral = require('../models/Referral');
const AdminLog = require('../models/AdminLog');
const logger = require('../utils/logger');

const logAction = async (adminId, action, details, ip, targetUserId, targetWithdrawalId) => {
  await AdminLog.create({
    admin: adminId,
    action,
    details,
    ipAddress: ip,
    targetUser: targetUserId,
    targetWithdrawal: targetWithdrawalId,
  });
};

// Dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      paidUsers,
      totalRevenue,
      pendingWithdrawals,
      totalWithdrawals,
      suspiciousAccounts,
      recentTransactions,
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'user', isPaid: true }),
      Transaction.aggregate([
        { $match: { type: 'registration', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Withdrawal.countDocuments({ status: 'pending' }),
      Withdrawal.aggregate([
        { $match: { status: { $in: ['approved', 'processed'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      User.countDocuments({ isSuspicious: true }),
      Transaction.find({ type: 'registration' })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('user', 'fullName email phone'),
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        paidUsers,
        unpaidUsers: totalUsers - paidUsers,
        totalRevenue: totalRevenue[0]?.total || 0,
        pendingWithdrawals,
        totalWithdrawals: totalWithdrawals[0]?.total || 0,
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
    const query = { role: 'user' };

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    if (status === 'suspicious') query.isSuspicious = true;
    if (status === 'banned') query.isBanned = true;
    if (status === 'paid') query.isPaid = true;

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('referredBy', 'fullName email');

    const total = await User.countDocuments(query);

    res.json({ success: true, users, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
};

// Ban user
exports.banUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { isBanned: true, banReason: reason || 'Banned by admin' },
      { new: true }
    );

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    await logAction(req.user._id, 'BAN_USER', { reason }, req.ip, userId);

    res.json({ success: true, message: `User ${user.email} banned.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to ban user.' });
  }
};

// Unban user
exports.unbanUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      { isBanned: false, banReason: null },
      { new: true }
    );

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    await logAction(req.user._id, 'UNBAN_USER', {}, req.ip, userId);

    res.json({ success: true, message: `User ${user.email} unbanned.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to unban user.' });
  }
};

// Get pending withdrawals
exports.getWithdrawals = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const withdrawals = await Withdrawal.find({ status })
      .populate('user', 'fullName email phone walletBalance')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Withdrawal.countDocuments({ status });

    res.json({ success: true, withdrawals, total });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch withdrawals.' });
  }
};

// Approve withdrawal
exports.approveWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { mpesaReceiptNumber } = req.body;

    const withdrawal = await Withdrawal.findById(withdrawalId).populate('user');
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found.' });
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Withdrawal already processed.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      withdrawal.status = 'approved';
      withdrawal.processedBy = req.user._id;
      withdrawal.processedAt = new Date();
      if (mpesaReceiptNumber) withdrawal.mpesaReceiptNumber = mpesaReceiptNumber;
      await withdrawal.save({ session });

      await User.findByIdAndUpdate(
        withdrawal.user._id,
        { $inc: { totalWithdrawn: withdrawal.amount } },
        { session }
      );

      await logAction(req.user._id, 'APPROVE_WITHDRAWAL', { amount: withdrawal.amount }, req.ip, withdrawal.user._id, withdrawalId);

      await session.commitTransaction();
      res.json({ success: true, message: 'Withdrawal approved.' });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (error) {
    logger.error('Approve withdrawal error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve withdrawal.' });
  }
};

// Reject withdrawal
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { reason } = req.body;

    const withdrawal = await Withdrawal.findById(withdrawalId).populate('user');
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found.' });
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Withdrawal already processed.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Refund wallet
      await User.findByIdAndUpdate(
        withdrawal.user._id,
        { $inc: { walletBalance: withdrawal.amount } },
        { session }
      );

      withdrawal.status = 'rejected';
      withdrawal.adminNote = reason;
      withdrawal.processedBy = req.user._id;
      withdrawal.processedAt = new Date();
      await withdrawal.save({ session });

      await logAction(req.user._id, 'REJECT_WITHDRAWAL', { reason }, req.ip, withdrawal.user._id, withdrawalId);

      await session.commitTransaction();
      res.json({ success: true, message: 'Withdrawal rejected and amount refunded to wallet.' });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to reject withdrawal.' });
  }
};

// Get all transactions (admin)
exports.getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;

    const transactions = await Transaction.find(query)
      .populate('user', 'fullName email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(query);

    res.json({ success: true, transactions, total });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
};

// Admin logs
exports.getAdminLogs = async (req, res) => {
  try {
    const logs = await AdminLog.find()
      .populate('admin', 'fullName email')
      .populate('targetUser', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
};
