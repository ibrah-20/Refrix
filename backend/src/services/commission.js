const User = require('../models/User');
const Referral = require('../models/Referral');
const Transaction = require('../models/Transaction');
const logger = require('../utils/logger');

const DIRECT_COMMISSION = parseInt(process.env.DIRECT_REFERRAL_COMMISSION) || 300;
const SECOND_COMMISSION = parseInt(process.env.SECOND_LEVEL_COMMISSION) || 100;

/**
 * Process commissions up to 2 levels for a newly qualified user
 */
const processCommissions = async (qualifiedUserId, session) => {
  try {
    const qualifiedUser = await User.findById(qualifiedUserId).session(session);
    if (!qualifiedUser || !qualifiedUser.referredBy) {
      logger.info(`User ${qualifiedUserId} has no referrer. No commissions.`);
      return;
    }

    // Level 1: Direct referrer
    const level1Referrer = await User.findById(qualifiedUser.referredBy).session(session);
    if (!level1Referrer) return;

    // Check self-referral (anti-fraud)
    if (level1Referrer._id.toString() === qualifiedUserId.toString()) {
      logger.warn(`Self-referral detected for user ${qualifiedUserId}`);
      return;
    }

    // Pay level 1 commission
    await _payCommission(level1Referrer, qualifiedUserId, 1, DIRECT_COMMISSION, session);

    // Level 2: Referrer's referrer
    if (level1Referrer.referredBy) {
      const level2Referrer = await User.findById(level1Referrer.referredBy).session(session);
      if (level2Referrer && level2Referrer._id.toString() !== qualifiedUserId.toString()) {
        await _payCommission(level2Referrer, qualifiedUserId, 2, SECOND_COMMISSION, session);
      }
    }
  } catch (error) {
    logger.error('Commission processing error:', error);
    throw error;
  }
};

const _payCommission = async (referrer, refereeId, level, amount, session) => {
  // Update or create referral record
  await Referral.findOneAndUpdate(
    { referrer: referrer._id, referee: refereeId, level },
    {
      status: 'qualified',
      commissionAmount: amount,
      commissionPaid: true,
      qualifiedAt: new Date(),
    },
    { upsert: true, new: true, session }
  );

  // Credit wallet
  await User.findByIdAndUpdate(
    referrer._id,
    {
      $inc: {
        walletBalance: amount,
        totalEarned: amount,
        ...(level === 1 ? { qualifiedReferralsCount: 1 } : {}),
      },
    },
    { session }
  );

  // Log commission transaction
  await Transaction.create(
    [
      {
        user: referrer._id,
        type: 'commission',
        amount,
        status: 'completed',
        description: `Level ${level} referral commission from user ${refereeId}`,
        phoneMatchVerified: true,
      },
    ],
    { session }
  );

  logger.info(`Paid KES ${amount} level-${level} commission to user ${referrer._id}`);
};

module.exports = { processCommissions };
