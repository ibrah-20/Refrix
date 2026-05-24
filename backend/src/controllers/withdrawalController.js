const mongoose = require('mongoose');
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const AdminLog = require('../models/AdminLog');
const logger = require('../utils/logger');

exports.requestWithdrawal = async (req, res) => {
  try {
    const user = req.user;
    const { amount } = req.body;

    if (!amount || amount < 100) {
      return res.status(400).json({ success: false, message: 'Minimum withdrawal is KES 100.' });
    }

    if (!user.canWithdraw()) {
      const minBalance = parseInt(process.env.MIN_WITHDRAWAL_BALANCE) || 1500;
      const minReferrals = parseInt(process.env.MIN_QUALIFIED_REFERRALS) || 3;
      return res.status(400).json({
        success: false,
        message: `Cannot withdraw yet. Need at least ${minReferrals} qualified referrals and KES ${minBalance} balance.`,
        walletBalance: user.walletBalance,
        qualifiedReferrals: user.qualifiedReferralsCount,
      });
    }

    if (amount > user.walletBalance) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance.' });
    }

    // Check for pending withdrawal
    const pendingWithdrawal = await Withdrawal.findOne({ user: user._id, status: 'pending' });
    if (pendingWithdrawal) {
      return res.status(400).json({ success: false, message: 'You have a pending withdrawal request.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Deduct from wallet
      await User.findByIdAndUpdate(user._id, { $inc: { walletBalance: -amount } }, { session });

      const withdrawal = await Withdrawal.create(
        [{ user: user._id, amount, phoneNumber: user.phone, status: 'pending' }],
        { session }
      );

      await session.commitTransaction();

      res.status(201).json({
        success: true,
        message: 'Withdrawal request submitted. Admin will process within 24-48 hours.',
        withdrawal: withdrawal[0],
      });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (error) {
    logger.error('Withdrawal request error:', error);
    res.status(500).json({ success: false, message: 'Withdrawal request failed.' });
  }
};

exports.getMyWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, withdrawals });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch withdrawals.' });
  }
};
