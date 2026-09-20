const db = require('../db');
const {
  userRepository,
  transactionRepository,
  fraudFlagRepository,
  notificationRepository,
} = require('../repositories');
const { initiateSTKPush, querySTKPush, normalizePhone } = require('../services/mpesa');
const { processCommissions } = require('../services/commission');
const logger = require('../utils/logger');


const REGISTRATION_FEE = parseInt(process.env.REGISTRATION_FEE) || 500;

// Initiate STK Push for registration payment
exports.initiatePayment = async (req, res) => {
  try {
    const user = req.user;
    const userId = user.id || user._id;

    if (user.isPaid || user.is_paid) {
      return res.status(400).json({ success: false, message: 'Payment already completed.' });
    }

    // Check for existing pending transaction
    const recentTxs = await transactionRepository.findByUser(userId, 10);
    const pendingTx = recentTxs.find(
      (t) =>
        t.type === 'registration' &&
        t.status === 'pending' &&
        new Date(t.created_at) > new Date(Date.now() - 5 * 60 * 1000)
    );

    if (pendingTx) {
      return res.status(400).json({
        success: false,
        message: 'A payment request is already pending. Please check your phone.',
        checkoutRequestId: pendingTx.mpesa_checkout_request_id,
      });
    }

    const phone = normalizePhone(user.phone);
    const ip = req.ip || req.headers['x-forwarded-for'];
    const referralCode = user.referralCode || user.referral_code;

    const stkResult = await initiateSTKPush({
      phone,
      amount: REGISTRATION_FEE,
      accountReference: `RC-${referralCode}`,
      transactionDesc: 'Refrix Registration Fee',
    });

    if (stkResult.responseCode !== '0') {
      return res.status(400).json({ success: false, message: 'M-Pesa request failed. Try again.' });
    }

    // Save pending transaction
    const transaction = await transactionRepository.create({
      userId,
      type: 'registration',
      amount: REGISTRATION_FEE,
      status: 'pending',
      mpesaCheckoutRequestId: stkResult.checkoutRequestId,
      mpesaMerchantRequestId: stkResult.merchantRequestId,
      mpesaPhoneUsed: phone,
      description: 'Registration fee payment',
      ipAddress: ip,
      deviceFingerprint: req.headers['x-device-fingerprint'],
    });

    res.json({
      success: true,
      message: 'STK Push sent. Check your phone and enter M-Pesa PIN.',
      checkoutRequestId: stkResult.checkoutRequestId,
      transactionId: transaction.id,
    });
  } catch (error) {
    logger.error('Initiate payment error:', error);
    res.status(500).json({ success: false, message: error.message || 'Payment initiation failed.' });
  }
};

// M-Pesa Callback
exports.mpesaCallback = async (req, res) => {
  // Always respond 200 to Safaricom immediately
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  try {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) return;

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;

    logger.info(`M-Pesa callback received: ${CheckoutRequestID}, ResultCode: ${ResultCode}`);

    const transaction = await transactionRepository.findByCheckoutRequestId(CheckoutRequestID);
    if (!transaction) {
      logger.warn(`No transaction found for CheckoutRequestID: ${CheckoutRequestID}`);
      return;
    }

    if (transaction.status !== 'pending') {
      logger.info(`Transaction ${transaction.id} already in status '${transaction.status}'. Skipping callback processing.`);
      return;
    }

    if (ResultCode !== 0) {
      await transactionRepository.updateStatus(transaction.id, 'failed', {
        rawCallbackData: req.body,
      });
      logger.info(`Payment failed for transaction ${transaction.id}: ${ResultDesc}`);
      return;
    }

    // Extract callback metadata
    const meta = {};
    CallbackMetadata?.Item?.forEach((item) => {
      meta[item.Name] = item.Value;
    });

    const receiptNumber = meta['MpesaReceiptNumber'];
    const amount = meta['Amount'];
    const transactionDate = meta['TransactionDate']?.toString();
    const mpesaPhone = meta['PhoneNumber']?.toString();

    // Duplicate receipt check
    const existing = await transactionRepository.findByReceiptNumber(receiptNumber);
    if (existing && existing.id !== transaction.id) {
      logger.warn(`Duplicate receipt: ${receiptNumber}`);
      await transactionRepository.updateStatus(transaction.id, 'suspicious', {
        mpesaReceiptNumber: receiptNumber,
        mpesaTransactionDate: transactionDate,
        rawCallbackData: req.body,
        isSuspicious: true,
        suspiciousReason: 'Duplicate M-Pesa receipt number',
      });
      await fraudFlagRepository.create({
        userId: transaction.user_id,
        type: 'repeated_payment_failures',
        riskStatus: 'review',
        description: 'Duplicate M-Pesa receipt number',
        relatedTransactionId: transaction.id,
        metadata: { receiptNumber },
      });
      return;
    }

    // Load user
    const user = await userRepository.findById(transaction.user_id);
    if (!user) {
      await transactionRepository.updateStatus(transaction.id, 'suspicious', {
        rawCallbackData: req.body,
        isSuspicious: true,
        suspiciousReason: 'User not found at callback',
      });
      return;
    }

    // Phone match validation
    const normalizedUserPhone = normalizePhone(user.phone);
    const normalizedMpesaPhone = mpesaPhone?.toString() || '';

    const phoneMatches =
      normalizedUserPhone === normalizedMpesaPhone ||
      normalizedUserPhone.endsWith(normalizedMpesaPhone.slice(-9));

    if (!phoneMatches) {
      await transactionRepository.updateStatus(transaction.id, 'suspicious', {
        mpesaReceiptNumber: receiptNumber,
        mpesaTransactionDate: transactionDate,
        rawCallbackData: req.body,
        isSuspicious: true,
        suspiciousReason: `Phone mismatch: registered ${normalizedUserPhone}, paid from ${normalizedMpesaPhone}`,
      });

      await fraudFlagRepository.create({
        userId: user.id,
        type: 'phone_reused',
        riskStatus: 'review',
        description: `Phone mismatch: registered ${normalizedUserPhone}, paid from ${normalizedMpesaPhone}`,
        relatedTransactionId: transaction.id,
      });

      logger.warn(`Phone mismatch for user ${user.id}: ${normalizedUserPhone} vs ${normalizedMpesaPhone}`);
      return;
    }

    // Amount check
    if (parseFloat(amount) < REGISTRATION_FEE) {
      await transactionRepository.updateStatus(transaction.id, 'suspicious', {
        mpesaReceiptNumber: receiptNumber,
        mpesaTransactionDate: transactionDate,
        rawCallbackData: req.body,
        isSuspicious: true,
        suspiciousReason: `Insufficient amount: ${amount} < ${REGISTRATION_FEE}`,
      });
      return;
    }

    // Process payment and commissions atomically with row locking
    await db.withTransaction(async (client) => {
      const lockedTx = await transactionRepository.findByIdForUpdate(transaction.id, client);
      if (!lockedTx || lockedTx.status !== 'pending') {
        logger.info(`Transaction ${transaction.id} locked and was already processed by concurrent callback.`);
        return;
      }

      const lockedUser = await userRepository.findByIdForUpdate(user.id, client);
      if (!lockedUser) return;

      if (lockedUser.is_paid) {
        logger.info(`User ${user.id} is already marked as paid. Skipping duplicate commission payout.`);
        await transactionRepository.updateStatus(
          transaction.id,
          'completed',
          {
            mpesaReceiptNumber: receiptNumber,
            mpesaTransactionDate: transactionDate,
            rawCallbackData: req.body,
          },
          client
        );
        return;
      }

      await transactionRepository.updateStatus(
        transaction.id,
        'completed',
        {
          mpesaReceiptNumber: receiptNumber,
          mpesaTransactionDate: transactionDate,
          rawCallbackData: req.body,
        },
        client
      );

      await client.query('UPDATE users SET is_paid = true, updated_at = NOW() WHERE id = $1', [user.id]);

      await notificationRepository.create(
        {
          userId: user.id,
          type: 'payment_success',
          channel: 'in_app',
          title: 'Payment Received',
          message: 'Your registration payment of KES 500 has been verified.',
        },
        client
      );

      // Process commissions up 2 levels
      await processCommissions(user.id, client);
    });

    logger.info(`Payment verified for user ${user.id}. Commissions processed.`);
  } catch (error) {
    logger.error('Callback processing error:', error);
  }
};


// Query payment status
exports.queryPayment = async (req, res) => {
  try {
    const { checkoutRequestId } = req.params;
    const userId = req.user.id || req.user._id;

    const transaction = await transactionRepository.findByCheckoutRequestId(checkoutRequestId);

    if (!transaction || transaction.user_id !== userId) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    // If still pending, query Safaricom
    if (transaction.status === 'pending') {
      try {
        const result = await querySTKPush(checkoutRequestId);
        if (result.ResultCode === '0' || result.ResultCode === 0) {
          const refreshed = await transactionRepository.findById(transaction.id);
          return res.json({ success: true, status: refreshed.status, transaction: refreshed });
        }
      } catch (_) { /* ignore query errors */ }
    }

    res.json({ success: true, status: transaction.status, transaction });
  } catch (error) {
    logger.error('Query payment error:', error);
    res.status(500).json({ success: false, message: 'Query failed.' });
  }
};

// Get user's transactions
exports.getMyTransactions = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const userId = req.user.id || req.user._id;
    const transactions = await transactionRepository.findByUser(userId, parseInt(limit, 10));

    res.json({
      success: true,
      transactions,
      total: transactions.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch transactions.' });
  }
};

