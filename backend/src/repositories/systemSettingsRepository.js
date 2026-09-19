const db = require('../db');

/**
 * Repository for `system_settings` PostgreSQL table
 */
const systemSettingsRepository = {
  async getSettings(dbClient = db) {
    const res = await dbClient.query("SELECT * FROM system_settings WHERE singleton_key = 'default'");
    if (res.rows[0]) {
      return res.rows[0];
    }
    // Fallback insertion if missing
    const insertRes = await dbClient.query(
      "INSERT INTO system_settings (singleton_key) VALUES ('default') ON CONFLICT (singleton_key) DO UPDATE SET updated_at = NOW() RETURNING *"
    );
    return insertRes.rows[0];
  },

  async updateSettings(updateData, updatedById = null, dbClient = db) {
    const {
      entryAmount,
      level1Reward,
      level2Reward,
      level3Reward,
      maxRewardLevel,
      minWithdrawal,
      maxDailyWithdrawal,
      maxWithdrawalsPerDay,
      withdrawalCooldownMinutes,
      minWithdrawalBalance,
      minQualifiedReferrals,
    } = updateData;

    const sql = `
      UPDATE system_settings
      SET entry_amount = COALESCE($1, entry_amount),
          level1_reward = COALESCE($2, level1_reward),
          level2_reward = COALESCE($3, level2_reward),
          level3_reward = COALESCE($4, level3_reward),
          max_reward_level = COALESCE($5, max_reward_level),
          min_withdrawal = COALESCE($6, min_withdrawal),
          max_daily_withdrawal = COALESCE($7, max_daily_withdrawal),
          max_withdrawals_per_day = COALESCE($8, max_withdrawals_per_day),
          withdrawal_cooldown_minutes = COALESCE($9, withdrawal_cooldown_minutes),
          min_withdrawal_balance = COALESCE($10, min_withdrawal_balance),
          min_qualified_referrals = COALESCE($11, min_qualified_referrals),
          last_updated_by_id = $12,
          updated_at = NOW()
      WHERE singleton_key = 'default'
      RETURNING *
    `;

    const params = [
      entryAmount,
      level1Reward,
      level2Reward,
      level3Reward,
      maxRewardLevel,
      minWithdrawal,
      maxDailyWithdrawal,
      maxWithdrawalsPerDay,
      withdrawalCooldownMinutes,
      minWithdrawalBalance,
      minQualifiedReferrals,
      updatedById,
    ];

    const res = await dbClient.query(sql, params);
    return res.rows[0];
  }
};

module.exports = systemSettingsRepository;
