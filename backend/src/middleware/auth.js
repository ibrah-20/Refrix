const jwt = require('jsonwebtoken');
const { userRepository } = require('../repositories');

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated. Please log in.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userRow = await userRepository.findById(decoded.id);

    if (!userRow) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    if (userRow.is_banned) {
      return res.status(403).json({ success: false, message: 'Your account has been banned.' });
    }

    const { password_hash, ...sanitizedUser } = userRow;

    const user = {
      ...sanitizedUser,
      _id: userRow.id,
      id: userRow.id,
      fullName: userRow.full_name,
      email: userRow.email,
      phone: userRow.phone,
      referralCode: userRow.referral_code,
      referredBy: userRow.referred_by_id,
      role: userRow.role,
      isActive: userRow.is_active,
      isBanned: userRow.is_banned,
      banReason: userRow.ban_reason,
      isPaid: userRow.is_paid,
      walletBalance: parseFloat(userRow.wallet_balance),
      totalEarned: parseFloat(userRow.total_earned),
      totalWithdrawn: parseFloat(userRow.total_withdrawn),
      qualifiedReferralsCount: parseInt(userRow.qualified_referrals_count, 10),
      createdAt: userRow.created_at,
      canWithdraw() {
        const minBalance = parseFloat(process.env.MIN_WITHDRAWAL_BALANCE || 1500);
        const minReferrals = parseInt(process.env.MIN_QUALIFIED_REFERRALS || 3, 10);
        return this.isPaid && this.walletBalance >= minBalance && this.qualifiedReferralsCount >= minReferrals;
      },
    };

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
    }
    next();
  };
};

