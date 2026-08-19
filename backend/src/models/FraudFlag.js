const mongoose = require('mongoose');

// Fraud review queue (spec sections 20-21). Flags never auto-punish a user — they set
// riskStatus to 'review' and wait for an admin. Nothing here bans or suspends anyone
// by itself.
const fraudFlagSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'multiple_accounts',
        'repeated_payment_failures',
        'suspicious_referral_velocity',
        'phone_reused',
        'abnormal_withdrawal_activity',
        'repeated_reversals',
        'circular_referral_attempt',
        'other',
      ],
      required: true,
    },
    riskStatus: {
      type: String,
      enum: ['review', 'cleared', 'confirmed'],
      default: 'review',
    },
    description: {
      type: String,
      required: true,
    },
    relatedTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    relatedWithdrawal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Withdrawal',
    },
    metadata: mongoose.Schema.Types.Mixed,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: Date,
    reviewNote: String,
  },
  { timestamps: true }
);

fraudFlagSchema.index({ riskStatus: 1, createdAt: -1 });

const FraudFlag = mongoose.model('FraudFlag', fraudFlagSchema);
module.exports = FraudFlag;
