const db = require('../db');
const {
  userRepository,
  withdrawalRepository,
  systemSettingsRepository,
  walletTransactionRepository,
  notificationRepository,
} = require('../repositories');
const logger = require('../utils/logger');

exports.requestWithdrawal = async (req, res) => {
  try {
    const user = req.user;
    const userId = user.id || user._id;
    const { amount } = req.body;

    const settings = await systemSettingsRepository.getSettings();
    const minWithdrawal = parseFloat(settings?.min_withdrawal || process.env.MIN_WITHDRAWAL || 100);
    const minBalance = parseFloat(settings?.min_withdrawal_balance || process.env.MIN_WITHDRAWAL_BALANCE || 1500);
    const minReferrals = parseInt(settings?.min_qualified_referrals || process.env.MIN_QUALIFIED_REFERRALS || 3, 10);
    const maxDailyWithdrawal = parseFloat(settings?.max_daily_withdrawal || process.env.MAX_DAILY_WITHDRAWAL || 5000);
    const maxWithdrawalsPerDay = parseInt(settings?.max_withdrawals_per_day || process.env.MAX_WITHDRAWALS_PER_DAY || 3, 10);

    if (!amount || amount < minWithdrawal) {
      return res.status(400).json({ success: false, message: `Minimum withdrawal is KES ${minWithdrawal}.` });
    }

    const walletBalance = user.walletBalance !== undefined ? user.walletBalance : parseFloat(user.wallet_balance);
    const qualifiedReferralsCount =
      user.qualifiedReferralsCount !== undefined
        ? user.qualifiedReferralsCount
        : parseInt(user.qualified_referrals_count, 10);
    const isPaid = user.isPaid !== undefined ? user.isPaid : user.is_paid;

    if (!isPaid || walletBalance < minBalance || qualifiedReferralsCount < minReferrals) {
      return res.status(400).json({
        success: false,
        message: `Cannot withdraw yet. Need at least ${minReferrals} qualified referrals and KES ${minBalance} balance.`,
        walletBalance,
        qualifiedReferrals: qualifiedReferralsCount,
      });
    }

    if (amount > walletBalance) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance.' });
    }

    const withdrawal = await db.withTransaction(async (client) => {
      // Lock user row to prevent concurrent withdrawal submission races
      const lockedUser = await userRepository.findByIdForUpdate(userId, client);
      if (!lockedUser) throw new Error('USER_NOT_FOUND');

      const currentBalance = parseFloat(lockedUser.wallet_balance);
      if (amount > currentBalance) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      // Check for pending withdrawal under lock
      const userWithdrawals = await withdrawalRepository.findByUser(userId, 50, client);
      const pendingExist = userWithdrawals.some((w) => w.status === 'pending');
      if (pendingExist) {
        throw new Error('PENDING_WITHDRAWAL_EXISTS');
      }

      // Enforce 24h daily rate limits under lock
      const dailyStats = await withdrawalRepository.getDailyWithdrawalStats(userId, client);
      if (dailyStats.dailyCount + 1 > maxWithdrawalsPerDay) {
        throw new Error('MAX_DAILY_WITHDRAWALS_EXCEEDED');
      }
      if (dailyStats.dailyTotal + amount > maxDailyWithdrawal) {
        throw new Error('MAX_DAILY_AMOUNT_EXCEEDED');
      }

      // Deduct from wallet: amountChange = -amount
      const updatedUser = await userRepository.updateWalletBalance(userId, -amount, 0, 0, client);

      const newWithdrawal = await withdrawalRepository.create(
        {
          userId,
          amount,
          phoneNumber: user.phone,
          status: 'pending',
        },
        client
      );

      // Log to wallet ledger
      await walletTransactionRepository.create(
        {
          userId,
          type: 'withdrawal',
          amount: -amount,
          description: 'Withdrawal request created',
          reference: `wd_${newWithdrawal.id}`,
          status: 'pending',
          balanceAfter: parseFloat(updatedUser ? updatedUser.wallet_balance : 0),
          relatedWithdrawalId: newWithdrawal.id,
        },
        client
      );

      // Send in-app notification
      await notificationRepository.create(
        {
          userId,
          type: 'withdrawal_requested',
          title: 'Withdrawal Requested',
          message: `Your withdrawal request of KES ${amount} has been received.`,
          metadata: { withdrawalId: newWithdrawal.id, amount },
        },
        client
      );

      return newWithdrawal;
    });

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted. Admin will process within 24-48 hours.',
      withdrawal: {
        id: withdrawal.id,
        _id: withdrawal.id,
        user: userId,
        amount: parseFloat(withdrawal.amount),
        phoneNumber: withdrawal.phone_number,
        status: withdrawal.status,
        createdAt: withdrawal.created_at,
      },
    });
  } catch (error) {
    if (error.message === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance.' });
    }
    if (error.message === 'PENDING_WITHDRAWAL_EXISTS') {
      return res.status(400).json({ success: false, message: 'You have a pending withdrawal request.' });
    }
    if (error.message === 'MAX_DAILY_WITHDRAWALS_EXCEEDED') {
      return res.status(400).json({ success: false, message: 'Maximum daily withdrawal count reached.' });
    }
    if (error.message === 'MAX_DAILY_AMOUNT_EXCEEDED') {
      return res.status(400).json({ success: false, message: 'Maximum daily withdrawal amount limit exceeded.' });
    }
    logger.error('Withdrawal request error:', error);
    res.status(500).json({ success: false, message: 'Withdrawal request failed.' });
  }
};



exports.getMyWithdrawals = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const rawWithdrawals = await withdrawalRepository.findByUser(userId, 50);

    const withdrawals = rawWithdrawals.map((w) => ({
      id: w.id,
      _id: w.id,
      user: w.user_id,
      amount: parseFloat(w.amount),
      phoneNumber: w.phone_number,
      status: w.status,
      adminNote: w.admin_note,
      processedAt: w.processed_at,
      mpesaReceiptNumber: w.mpesa_receipt_number,
      createdAt: w.created_at,
    }));

    res.json({ success: true, withdrawals });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch withdrawals.' });
  }
};

