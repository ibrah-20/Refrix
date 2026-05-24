const User = require('../models/User');
const Referral = require('../models/Referral');

// Get user's referrals
exports.getMyReferrals = async (req, res) => {
  try {
    const referrals = await Referral.find({ referrer: req.user._id })
      .populate('referee', 'fullName email phone isPaid createdAt')
      .sort({ createdAt: -1 });

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
  const link = `${baseUrl}/register?ref=${req.user.referralCode}`;
  res.json({ success: true, referralCode: req.user.referralCode, link });
};

// Get referred-by info
exports.getReferredBy = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('referredBy', 'fullName referralCode');
    res.json({ success: true, referredBy: user.referredBy });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
};
