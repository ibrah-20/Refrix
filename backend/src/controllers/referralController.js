const { userRepository, referralRepository } = require('../repositories');

// Get user's referrals
exports.getMyReferrals = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const rawReferrals = await referralRepository.findByReferrer(userId);

    const referrals = await Promise.all(
      rawReferrals.map(async (r) => {
        const refereeUser = await userRepository.findById(r.referee_id);
        return {
          id: r.id,
          _id: r.id,
          referrer: r.referrer_id,
          referee: refereeUser
            ? {
                id: refereeUser.id,
                _id: refereeUser.id,
                fullName: refereeUser.full_name,
                email: refereeUser.email,
                phone: refereeUser.phone,
                isPaid: refereeUser.is_paid,
                createdAt: refereeUser.created_at,
              }
            : null,
          level: r.level,
          status: r.status,
          commissionAmount: parseFloat(r.commission_amount),
          commissionPaid: r.commission_paid,
          qualifiedAt: r.qualified_at,
          createdAt: r.created_at,
        };
      })
    );

    const stats = {
      total: referrals.length,
      qualified: referrals.filter((r) => r.status === 'qualified').length,
      pending: referrals.filter((r) => r.status === 'pending').length,
      level1: referrals.filter((r) => r.level === 1).length,
      level2: referrals.filter((r) => r.level === 2).length,
      totalCommissionEarned: referrals
        .filter((r) => r.status === 'qualified')
        .reduce((sum, r) => sum + r.commissionAmount, 0),
    };

    res.json({ success: true, referrals, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch referrals.' });
  }
};

// Get referral link
exports.getReferralLink = async (req, res) => {
  const baseUrl = process.env.FRONTEND_URL || 'https://refrix.com';
  const referralCode = req.user.referralCode || req.user.referral_code;
  const link = `${baseUrl}/auth/register?ref=${referralCode}`;
  res.json({ success: true, referralCode, link });
};

// Get referred-by info
exports.getReferredBy = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await userRepository.findById(userId);

    let referredBy = null;
    if (user && user.referred_by_id) {
      const refUser = await userRepository.findById(user.referred_by_id);
      if (refUser) {
        referredBy = {
          fullName: refUser.full_name,
          referralCode: refUser.referral_code,
        };
      }
    }

    res.json({ success: true, referredBy });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
};

