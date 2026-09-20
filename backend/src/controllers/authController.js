const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const { validationResult } = require('express-validator');
const { userRepository, referralRepository, adminLogRepository } = require('../repositories');
const db = require('../db');
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
    const normalizedEmail = email.toLowerCase().trim();

    // Check duplicate email or phone
    const existingEmail = await userRepository.findByEmail(normalizedEmail);
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const existingPhone = await userRepository.findByPhone(normalizedPhone);
    if (existingPhone) {
      return res.status(400).json({ success: false, message: 'Phone number already registered.' });
    }

    // Resolve referrer
    let referrer = null;
    if (referralCode) {
      referrer = await userRepository.findByReferralCode(referralCode.trim());
      if (!referrer) {
        return res.status(400).json({ success: false, message: 'Invalid referral code.' });
      }
      // Self-referral check
      if (referrer.phone === normalizedPhone || referrer.email === normalizedEmail) {
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
    } while (await userRepository.findByReferralCode(newReferralCode));

    const passwordHash = await bcrypt.hash(password, 12);

    // Create user and pending referral records within an atomic database transaction
    const user = await db.withTransaction(async (client) => {
      const newUser = await userRepository.create(
        {
          fullName,
          email: normalizedEmail,
          phone: normalizedPhone,
          passwordHash,
          referralCode: newReferralCode,
          referredById: referrer ? referrer.id : null,
          isPaid: false,
          registrationIP: ip,
          deviceFingerprint,
        },
        client
      );

      if (referrer) {
        // Level 1 pending referral
        await referralRepository.create(referrer.id, newUser.id, 1, client);

        // Level 2 pending referral if referrer has a referrer
        if (referrer.referred_by_id) {
          const level2Referrer = await userRepository.findById(referrer.referred_by_id, client);
          if (level2Referrer && level2Referrer.id !== newUser.id) {
            await referralRepository.create(level2Referrer.id, newUser.id, 2, client);
          }
        }
      }

      return newUser;
    });

    const token = signToken(user.id);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please complete payment of KES 500 to activate your account.',
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        referralCode: user.referral_code,
        isPaid: user.is_paid,
        walletBalance: parseFloat(user.wallet_balance),
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

    const user = await userRepository.findByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (user.is_banned) {
      return res.status(403).json({ success: false, message: `Account banned: ${user.ban_reason || 'Policy violation'}` });
    }

    await userRepository.updateLastLogin(user.id, ip);

    const token = signToken(user.id);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        referralCode: user.referral_code,
        isPaid: user.is_paid,
        walletBalance: parseFloat(user.wallet_balance),
        qualifiedReferralsCount: parseInt(user.qualified_referrals_count, 10),
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
      id: user.id || user._id,
      fullName: user.fullName || user.full_name,
      email: user.email,
      phone: user.phone,
      referralCode: user.referralCode || user.referral_code,
      isPaid: user.isPaid !== undefined ? user.isPaid : user.is_paid,
      walletBalance: user.walletBalance !== undefined ? user.walletBalance : parseFloat(user.wallet_balance),
      totalEarned: user.totalEarned !== undefined ? user.totalEarned : parseFloat(user.total_earned),
      totalWithdrawn: user.totalWithdrawn !== undefined ? user.totalWithdrawn : parseFloat(user.total_withdrawn),
      qualifiedReferralsCount: user.qualifiedReferralsCount !== undefined ? user.qualifiedReferralsCount : parseInt(user.qualified_referrals_count, 10),
      role: user.role,
      createdAt: user.createdAt || user.created_at,
    },
  });
};

