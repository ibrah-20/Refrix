require('dotenv').config();
const SystemSettings = require('../models/SystemSettings');
const connectDB = require('../config/database');

// Seeds the singleton SystemSettings row from env vars ONLY if it doesn't exist yet.
// After the first run, these values live in the DB and are meant to be changed from the
// admin dashboard, not by re-running this script or editing .env.
const seedSettings = async () => {
  await connectDB();

  const existing = await SystemSettings.findOne({ singletonKey: 'default' });
  if (existing) {
    console.log('SystemSettings already seeded — no changes made.');
    process.exit(0);
  }

  const settings = await SystemSettings.create({
    singletonKey: 'default',
    entryAmount: parseInt(process.env.ENTRY_AMOUNT) || 200,
    level1Reward: parseInt(process.env.LEVEL_1_REWARD) || 100,
    level2Reward: parseInt(process.env.LEVEL_2_REWARD) || 50,
    level3Reward: parseInt(process.env.LEVEL_3_REWARD) || 0,
    maxRewardLevel: parseInt(process.env.MAX_REWARD_LEVEL) || 2,
    minWithdrawal: parseInt(process.env.MIN_WITHDRAWAL) || 100,
    maxDailyWithdrawal: parseInt(process.env.MAX_DAILY_WITHDRAWAL) || 5000,
    maxWithdrawalsPerDay: parseInt(process.env.MAX_WITHDRAWALS_PER_DAY) || 3,
    minWithdrawalBalance: parseInt(process.env.MIN_WITHDRAWAL_BALANCE) || 1500,
    minQualifiedReferrals: parseInt(process.env.MIN_QUALIFIED_REFERRALS) || 3,
  });

  console.log('SystemSettings seeded:', settings.toObject());
  process.exit(0);
};

seedSettings().catch((err) => {
  console.error(err);
  process.exit(1);
});
