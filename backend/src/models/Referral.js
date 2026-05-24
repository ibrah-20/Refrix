const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema(
  {
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    referee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    level: {
      type: Number,
      enum: [1, 2],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'qualified', 'rejected'],
      default: 'pending',
    },
    commissionAmount: {
      type: Number,
      default: 0,
    },
    commissionPaid: {
      type: Boolean,
      default: false,
    },
    qualifiedAt: Date,
    rejectionReason: String,
  },
  { timestamps: true }
);

referralSchema.index({ referrer: 1, referee: 1 }, { unique: true });

const Referral = mongoose.model('Referral', referralSchema);
module.exports = Referral;
