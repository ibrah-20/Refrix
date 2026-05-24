const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const AdminLog = require('../models/AdminLog');
const logger = require('../utils/logger');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const normalizePhone = (phone) => {
  let p = phone.replace(/\s+/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = '254' + p.slice(1);
  return p;
};

exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { fullName, email, phone, password, referralCode } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'];
    const deviceFingerprint = req.headers['x-device-fingerprint'] || 'unknown';

    const normalizedPhone = normalizePhone(phone);

    // Check duplicates
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: normalizedPhone }],
    });

    if (existingUser) {
      const field = existingUser.email === email.toLowerCase() ? 'Email' : 'Phone number';
      return res.status(400).json({ success: false, message: `${field} already registered.` });
    }

    // Resolve referrer
    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
      if (!referrer) {
        return res.status(400).json({ success: false, message: 'Invalid referral code.' });
      }
      /* if (!referrer.isPaid) {
        return res.status(400).json({ success: false, message: 'Referrer has not completed registration payment.' });
      } */
      // Self-referral check
      if (referrer.phone === normalizedPhone || referrer.email === email.toLowerCase()) {
        return res.status(400).json({ success: false, message: 'Self-referral is not allowed.' });
      }
    }

    // Generate unique referral code
    let newReferralCode;
    let attempts = 0;
    do {
      newReferralCode = nanoid(8).toUpperCase();
      attempts++;
      if (attempts > 10) throw new Error('Could not generate unique referral code');
    } while (await User.findOne({ referralCode: newReferralCode }));

    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      phone: normalizedPhone,
      password,
      referralCode: newReferralCode,
      referredBy: referrer?._id || null,
      registrationIP: ip,
      deviceFingerprint,
    });

    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please complete payment of KES 500 to activate your account.',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        referralCode: user.referralCode,
        isPaid: user.isPaid,
        walletBalance: user.walletBalance,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('Register error:', error);
    res.status(500).json({ success: false, message: error.message || 'Registration failed.' });
  }
};

exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'];

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (user.isBanned) {
      return res.status(403).json({ success: false, message: `Account banned: ${user.banReason || 'Policy violation'}` });
    }

    user.lastLogin = new Date();
    user.lastLoginIP = ip;
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        referralCode: user.referralCode,
        isPaid: user.isPaid,
        walletBalance: user.walletBalance,
        qualifiedReferralsCount: user.qualifiedReferralsCount,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed.' });
  }
};

exports.getMe = async (req, res) => {
  const user = req.user;
  res.json({
    success: true,
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      referralCode: user.referralCode,
      isPaid: user.isPaid,
      walletBalance: user.walletBalance,
      totalEarned: user.totalEarned,
      totalWithdrawn: user.totalWithdrawn,
      qualifiedReferralsCount: user.qualifiedReferralsCount,
      role: user.role,
      createdAt: user.createdAt,
    },
  });
};
