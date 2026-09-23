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
    const reqAmount = parseFloat(amount);

    const settings = await systemSettingsRepository.getSettings();
    const minWithdrawal = parseFloat(settings?.min_withdrawal || process.env.MIN_WITHDRAWAL || 100);

    if (!reqAmount || reqAmount < minWithdrawal) {
      return res.status(400).json({ success: false, message: `Minimum withdrawal is KES ${minWithdrawal}.` });
    }

    const isAdmin = user.role === 'admin';

    if (isAdmin) {
      // ADMIN WITHDRAWAL LOGIC: Can withdraw from Referral Wallet + Company Revenue Balance
      const withdrawal = await db.withTransaction(async (client) => {
        const lockedAdmin = await userRepository.findByIdForUpdate(userId, client);
        if (!lockedAdmin) throw new Error('USER_NOT_FOUND');

        const adminReferralBalance = parseFloat(lockedAdmin.wallet_balance);

        const regRes = await client.query(
          "SELECT COUNT(*) AS count FROM transactions WHERE type = 'registration' AND status = 'completed'"
        );
        const completedCount = parseInt(regRes.rows[0].count, 10);
        const companyRevenueGenerated = completedCount * 100.00;

        const companyWdRes = await client.query(
          "SELECT COALESCE(SUM(source_company_amount), 0) AS total FROM withdrawals WHERE status IN ('pending', 'approved', 'processed')"
        );
        const companyRevenueWithdrawn = parseFloat(companyWdRes.rows[0].total);
        const companyRevenueBalance = Math.max(0, companyRevenueGenerated - companyRevenueWithdrawn);

        const totalBusinessFunds = adminReferralBalance + companyRevenueBalance;

        if (reqAmount > totalBusinessFunds) {
          throw new Error('INSUFFICIENT_BUSINESS_FUNDS');
        }

        // Check pending withdrawal under lock
        const userWithdrawals = await withdrawalRepository.findByUser(userId, 50, client);
        const pendingExist = userWithdrawals.some((w) => w.status === 'pending');
        if (pendingExist) {
          throw new Error('PENDING_WITHDRAWAL_EXISTS');
        }

        let drawFromReferral = 0;
        let drawFromCompany = 0;

        if (adminReferralBalance >= reqAmount) {
          drawFromReferral = reqAmount;
          drawFromCompany = 0;
        } else {
          drawFromReferral = adminReferralBalance;
          drawFromCompany = reqAmount - adminReferralBalance;
        }

        let updatedAdmin = lockedAdmin;
        if (drawFromReferral > 0) {
          updatedAdmin = await userRepository.updateWalletBalance(userId, -drawFromReferral, 0, 0, client);
        }

        const newWithdrawal = await withdrawalRepository.create(
          {
            userId,
            amount: reqAmount,
            phoneNumber: user.phone,
            status: 'pending',
            sourceReferralAmount: drawFromReferral,
            sourceCompanyAmount: drawFromCompany,
          },
          client
        );

        await walletTransactionRepository.create(
          {
            userId,
            type: 'withdrawal',
            amount: -reqAmount,
            description: `Admin business withdrawal (Referral: KES ${drawFromReferral}, Company: KES ${drawFromCompany})`,
            reference: `wd_${newWithdrawal.id}`,
            status: 'pending',
            balanceAfter: parseFloat(updatedAdmin ? updatedAdmin.wallet_balance : 0),
            relatedWithdrawalId: newWithdrawal.id,
          },
          client
        );

        await notificationRepository.create(
          {
            userId,
            type: 'withdrawal_requested',
            title: 'Admin Business Withdrawal Requested',
            message: `Admin withdrawal request of KES ${reqAmount} logged.`,
            metadata: { withdrawalId: newWithdrawal.id, amount: reqAmount },
          },
          client
        );

        return newWithdrawal;
      });

      return res.status(201).json({
        success: true,
        message: 'Admin withdrawal request submitted successfully.',
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
    }

    // MEMBER WITHDRAWAL LOGIC: Strict checks required
    const minBalance = parseFloat(settings?.min_withdrawal_balance || process.env.MIN_WITHDRAWAL_BALANCE || 1500);
    const minReferrals = parseInt(settings?.min_qualified_referrals || process.env.MIN_QUALIFIED_REFERRALS || 3, 10);
    const maxDailyWithdrawal = parseFloat(settings?.max_daily_withdrawal || process.env.MAX_DAILY_WITHDRAWAL || 5000);
    const maxWithdrawalsPerDay = parseInt(settings?.max_withdrawals_per_day || process.env.MAX_WITHDRAWALS_PER_DAY || 3, 10);

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

    if (reqAmount > walletBalance) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance.' });
    }

    const withdrawal = await db.withTransaction(async (client) => {
      // Lock user row to prevent concurrent withdrawal submission races
      const lockedUser = await userRepository.findByIdForUpdate(userId, client);
      if (!lockedUser) throw new Error('USER_NOT_FOUND');

      const currentBalance = parseFloat(lockedUser.wallet_balance);
      if (reqAmount > currentBalance) {
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
      if (dailyStats.dailyTotal + reqAmount > maxDailyWithdrawal) {
        throw new Error('MAX_DAILY_AMOUNT_EXCEEDED');
      }

      // Deduct from wallet: amountChange = -reqAmount
      const updatedUser = await userRepository.updateWalletBalance(userId, -reqAmount, 0, 0, client);

      const newWithdrawal = await withdrawalRepository.create(
        {
          userId,
          amount: reqAmount,
          phoneNumber: user.phone,
          status: 'pending',
          sourceReferralAmount: reqAmount,
          sourceCompanyAmount: 0,
        },
        client
      );

      // Log to wallet ledger
      await walletTransactionRepository.create(
        {
          userId,
          type: 'withdrawal',
          amount: -reqAmount,
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
          message: `Your withdrawal request of KES ${reqAmount} has been received.`,
          metadata: { withdrawalId: newWithdrawal.id, amount: reqAmount },
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
    if (error.message === 'INSUFFICIENT_BUSINESS_FUNDS') {
      return res.status(400).json({ success: false, message: 'Insufficient total business funds available.' });
    }
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

