const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['registration', 'commission', 'withdrawal'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'suspicious'],
      default: 'pending',
    },
    // M-Pesa specific
    mpesaCheckoutRequestId: {
      type: String,
      sparse: true,
    },
    mpesaMerchantRequestId: String,
    mpesaReceiptNumber: {
      type: String,
      sparse: true,
    },
    mpesaTransactionDate: String,
    mpesaPhoneUsed: String,
    // Phone match validation
    phoneMatchVerified: {
      type: Boolean,
      default: false,
    },
    phoneMismatch: {
      type: Boolean,
      default: false,
    },
    // Meta
    description: String,
    ipAddress: String,
    deviceFingerprint: String,
    isSuspicious: {
      type: Boolean,
      default: false,
    },
    suspiciousReason: String,
    rawCallbackData: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

transactionSchema.index({ mpesaCheckoutRequestId: 1 });
transactionSchema.index({ mpesaReceiptNumber: 1 });
transactionSchema.index({ user: 1, type: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
