const {
  userRepository,
  referralRepository,
  transactionRepository,
  walletTransactionRepository,
  notificationRepository,
} = require('../repositories');
const db = require('../db');
const logger = require('../utils/logger');

const DIRECT_COMMISSION = parseInt(process.env.DIRECT_REFERRAL_COMMISSION) || 300;
const SECOND_COMMISSION = parseInt(process.env.SECOND_LEVEL_COMMISSION) || 100;

/**
 * Process commissions up to 2 levels for a newly qualified user
 */
const processCommissions = async (qualifiedUserId, dbClient = db) => {
  try {
    const qualifiedUser = await userRepository.findById(qualifiedUserId, dbClient);
    if (!qualifiedUser || !qualifiedUser.referred_by_id) {
      logger.info(`User ${qualifiedUserId} has no referrer. No commissions.`);
      return;
    }

    // Level 1: Direct referrer
    const level1Referrer = await userRepository.findById(qualifiedUser.referred_by_id, dbClient);
    if (!level1Referrer) return;

    // Check self-referral (anti-fraud)
    if (level1Referrer.id.toString() === qualifiedUserId.toString()) {
      logger.warn(`Self-referral detected for user ${qualifiedUserId}`);
      return;
    }

    // Pay level 1 commission
    await _payCommission(level1Referrer, qualifiedUserId, 1, DIRECT_COMMISSION, dbClient);

    // Level 2: Referrer's referrer
    if (level1Referrer.referred_by_id) {
      const level2Referrer = await userRepository.findById(level1Referrer.referred_by_id, dbClient);
      if (level2Referrer && level2Referrer.id.toString() !== qualifiedUserId.toString()) {
        await _payCommission(level2Referrer, qualifiedUserId, 2, SECOND_COMMISSION, dbClient);
      }
    }
  } catch (error) {
    logger.error('Commission processing error:', error);
    throw error;
  }
};

const _payCommission = async (referrer, refereeId, level, amount, dbClient = db) => {
  const referrerId = referrer.id;

  // Find or create referral record
  let referral = await referralRepository.findPair(referrerId, refereeId, dbClient);
  if (!referral) {
    referral = await referralRepository.create(referrerId, refereeId, level, dbClient);
  }

  // Idempotency check: if referral is ALREADY qualified/paid, DO NOT CREDIT WALLET AGAIN!
  if (referral && (referral.status === 'qualified' || referral.commission_paid)) {
    logger.info(`Referral between ${referrerId} and ${refereeId} already qualified. Skipping duplicate payout.`);
    return;
  }

  const updatedReferral = await referralRepository.markQualified(referral.id, amount, dbClient);
  if (!updatedReferral) {
    logger.info(`Referral ${referral.id} was marked qualified by concurrent process. Skipping duplicate payout.`);
    return;
  }

  // Credit wallet: balance delta = amount, total_earned delta = amount
  const updatedUser = await userRepository.updateWalletBalance(referrerId, amount, amount, 0, dbClient);

  if (level === 1) {
    await userRepository.incrementQualifiedReferrals(referrerId, dbClient);
  }

  // Log commission transaction
  await transactionRepository.create(
    {
      userId: referrerId,
      type: 'commission',
      amount,
      status: 'completed',
      description: `Level ${level} referral commission from user ${refereeId}`,
      phoneMatchVerified: true,
    },
    dbClient
  );

  // Log immutable wallet ledger entry
  await walletTransactionRepository.create(
    {
      userId: referrerId,
      type: 'referral_reward',
      amount,
      description: `Level ${level} referral commission`,
      reference: `comm_L${level}_${referrerId}_${refereeId}`,
      status: 'completed',
      balanceAfter: parseFloat(updatedUser ? updatedUser.wallet_balance : 0),
      relatedCommissionId: referral ? referral.id : null,
    },
    dbClient
  );

  // Send in-app notification to referrer
  await notificationRepository.create(
    {
      userId: referrerId,
      type: 'reward_credited',
      title: 'Referral Reward Credited!',
      message: `You earned KES ${amount} from a Level ${level} referral.`,
      metadata: { refereeId, level, amount },
    },
    dbClient
  );

  logger.info(`Paid KES ${amount} level-${level} commission to user ${referrerId}`);
};


module.exports = { processCommissions };

