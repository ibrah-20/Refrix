const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      match: [/^(\+?254|0)[17]\d{8}$/, 'Invalid Kenyan phone number'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    referralCode: {
      type: String,
      unique: true,
      uppercase: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    banReason: {
      type: String,
      default: null,
    },
    isPaid: {
      type: Boolean,
      default: true,
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalEarned: {
      type: Number,
      default: 0,
    },
    totalWithdrawn: {
      type: Number,
      default: 0,
    },
    qualifiedReferralsCount: {
      type: Number,
      default: 0,
    },
    // Anti-fraud fields
    registrationIP: String,
    lastLoginIP: String,
    deviceFingerprint: String,
    isSuspicious: {
      type: Boolean,
      default: false,
    },
    suspiciousReason: String,
    lastLogin: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Normalize phone to 254XXXXXXXXX format
userSchema.pre('save', function (next) {
  if (this.isModified('phone')) {
    let phone = this.phone.replace(/\s+/g, '');
    if (phone.startsWith('0')) {
      phone = '254' + phone.slice(1);
    } else if (phone.startsWith('+')) {
      phone = phone.slice(1);
    }
    this.phone = phone;
  }
  next();
});

// Hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if eligible for withdrawal
userSchema.methods.canWithdraw = function () {
  const minBalance = parseInt(process.env.MIN_WITHDRAWAL_BALANCE) || 1500;
  const minReferrals = parseInt(process.env.MIN_QUALIFIED_REFERRALS) || 3;
  return (
    this.walletBalance >= minBalance &&
    this.qualifiedReferralsCount >= minReferrals &&
    !this.isBanned
  );
};

const User = mongoose.model('User', userSchema);
module.exports = User;
