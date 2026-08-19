const mongoose = require('mongoose');

// Singleton document — there is only ever one SystemSettings row (singletonKey: 'default').
// Reward/withdrawal RULES live here so they can be changed by an admin without a redeploy.
// PAYMENTS_MODE and WITHDRAWALS_ENABLED are intentionally NOT stored here — those are the
// production safety switch (spec section 47) and must come from environment variables only,
// so a database write can never silently turn on real-money payouts.
const systemSettingsSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      default: 'default',
      unique: true,
    },

    // Referral reward engine (spec sections 9, 50)
    entryAmount: {
      type: Number,
      default: 200,
      min: 0,
    },
    level1Reward: {
      type: Number,
      default: 100,
      min: 0,
    },
    level2Reward: {
      type: Number,
      default: 50,
      min: 0,
    },
    level3Reward: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxRewardLevel: {
      type: Number,
      default: 2,
      min: 0,
    },

    // Withdrawal protection (spec section 19)
    minWithdrawal: {
      type: Number,
      default: 100,
      min: 0,
    },
    maxDailyWithdrawal: {
      type: Number,
      default: 5000,
      min: 0,
    },
    maxWithdrawalsPerDay: {
      type: Number,
      default: 3,
      min: 1,
    },
    withdrawalCooldownMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    minWithdrawalBalance: {
      type: Number,
      default: 1500,
      min: 0,
    },
    minQualifiedReferrals: {
      type: Number,
      default: 3,
      min: 0,
    },

    // Who last touched this row — every change must be paired with an AdminLog entry
    // by the controller that writes here (spec section 50: "Any change to financial
    // configuration must create an audit log").
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Convenience accessor: get the single settings row, creating it with defaults if missing.
systemSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ singletonKey: 'default' });
  if (!settings) {
    settings = await this.create({ singletonKey: 'default' });
  }
  return settings;
};

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);
module.exports = SystemSettings;
