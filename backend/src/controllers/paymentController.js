const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { initiateSTKPush, querySTKPush, normalizePhone } = require('../services/mpesa');
const { processCommissions } = require('../services/commission');
const logger = require('../utils/logger');

const REGISTRATION_FEE = parseInt(process.env.REGISTRATION_FEE) || 500;

// Initiate STK Push for registration payment
exports.initiatePayment = async (req, res) => {
  try {
    const user = req.user;

    if (user.isPaid) {
      return res.status(400).json({ success: false, message: 'Payment already completed.' });
    }

    // Check for existing pending transaction
    const pendingTx = await Transaction.findOne({
      user: user._id,
      type: 'registration',
      status: 'pending',
      createdAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) }, // last 5 mins
    });
    if (pendingTx) {
      return res.status(400).json({
        success: false,
        message: 'A payment request is already pending. Please check your phone.',
        checkoutRequestId: pendingTx.mpesaCheckoutRequestId,
      });
    }

    const phone = normalizePhone(user.phone);
    const ip = req.ip || req.headers['x-forwarded-for'];

    const stkResult = await initiateSTKPush({
      phone,
      amount: REGISTRATION_FEE,
      accountReference: `RC-${user.referralCode}`,
      transactionDesc: 'Refrix Registration Fee',
    });

    if (stkResult.responseCode !== '0') {
      return res.status(400).json({ success: false, message: 'M-Pesa request failed. Try again.' });
    }

    // Save pending transaction
    const transaction = await Transaction.create({
      user: user._id,
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
      transactionId: transaction._id,
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

    const transaction = await Transaction.findOne({ mpesaCheckoutRequestId: CheckoutRequestID });
    if (!transaction) {
      logger.warn(`No transaction found for CheckoutRequestID: ${CheckoutRequestID}`);
      return;
    }

    transaction.rawCallbackData = req.body;

    if (ResultCode !== 0) {
      transaction.status = 'failed';
      await transaction.save();
      logger.info(`Payment failed for transaction ${transaction._id}: ${ResultDesc}`);
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
    const existing = await Transaction.findOne({ mpesaReceiptNumber: receiptNumber });
    if (existing) {
      logger.warn(`Duplicate receipt: ${receiptNumber}`);
      transaction.status = 'suspicious';
      transaction.isSuspicious = true;
      transaction.suspiciousReason = 'Duplicate M-Pesa receipt number';
      await transaction.save();
      return;
    }

    transaction.mpesaReceiptNumber = receiptNumber;
    transaction.mpesaTransactionDate = transactionDate;
    transaction.mpesaPhoneUsed = mpesaPhone;

    // Load user
    const user = await User.findById(transaction.user);
    if (!user) {
      transaction.status = 'suspicious';
      transaction.isSuspicious = true;
      transaction.suspiciousReason = 'User not found at callback';
      await transaction.save();
      return;
    }

    // Phone match validation
    const normalizedUserPhone = normalizePhone(user.phone);
    const normalizedMpesaPhone = mpesaPhone?.toString() || '';

    const phoneMatches =
      normalizedUserPhone === normalizedMpesaPhone ||
      normalizedUserPhone.endsWith(normalizedMpesaPhone.slice(-9));

    if (!phoneMatches) {
      transaction.status = 'suspicious';
      transaction.isSuspicious = true;
      transaction.phoneMismatch = true;
      transaction.suspiciousReason = `Phone mismatch: registered ${normalizedUserPhone}, paid from ${normalizedMpesaPhone}`;
      await transaction.save();

      // Flag user as suspicious
      await User.findByIdAndUpdate(user._id, {
        isSuspicious: true,
        suspiciousReason: 'Payment phone mismatch',
      });

      logger.warn(`Phone mismatch for user ${user._id}: ${normalizedUserPhone} vs ${normalizedMpesaPhone}`);
      return;
    }

    // Amount check
    if (parseFloat(amount) < REGISTRATION_FEE) {
      transaction.status = 'suspicious';
      transaction.isSuspicious = true;
      transaction.suspiciousReason = `Insufficient amount: ${amount} < ${REGISTRATION_FEE}`;
      await transaction.save();
      return;
    }

    // All good — process with a Mongoose session for atomicity
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      transaction.status = 'completed';
      transaction.phoneMatchVerified = true;
      await transaction.save({ session });

      user.isPaid = true;
      await user.save({ session });

      // Process commissions up 2 levels
      await processCommissions(user._id, session);

      await session.commitTransaction();
      logger.info(`Payment verified for user ${user._id}. Commissions processed.`);
    } catch (err) {
      await session.abortTransaction();
      logger.error('Commission processing failed:', err);
    } finally {
      session.endSession();
    }
  } catch (error) {
    logger.error('Callback processing error:', error);
  }
};

// Query payment status
exports.queryPayment = async (req, res) => {
  try {
    const { checkoutRequestId } = req.params;

    const transaction = await Transaction.findOne({
      mpesaCheckoutRequestId: checkoutRequestId,
      user: req.user._id,
    });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    // If still pending, query Safaricom
    if (transaction.status === 'pending') {
      try {
        const result = await querySTKPush(checkoutRequestId);
        if (result.ResultCode === '0' || result.ResultCode === 0) {
          // Callback may have already processed, re-check
          const refreshed = await Transaction.findById(transaction._id);
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
    const { page = 1, limit = 20 } = req.query;
    const transactions = await Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments({ user: req.user._id });

    res.json({ success: true, transactions, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch transactions.' });
  }
};
