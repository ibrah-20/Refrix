const mongoose = require('mongoose');
const crypto = require('crypto');

// Phone verification (spec section 6). The OTP itself is NEVER stored in plaintext —
// only a SHA-256 hash, compared via a constant-time check in `verifyCode`.
const otpVerificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ['registration', 'password_reset', 'phone_change'],
      default: 'registration',
    },
    otpHash: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    resendCount: {
      type: Number,
      default: 0,
    },
    resendCooldownUntil: {
      type: Date,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: Date,
  },
  { timestamps: true }
);

otpVerificationSchema.index({ user: 1, purpose: 1, verified: 1 });

// Hash a raw OTP the same way every time it's created or checked.
otpVerificationSchema.statics.hashCode = function (rawCode) {
  return crypto.createHash('sha256').update(String(rawCode)).digest('hex');
};

// Compare a raw code against this record's stored hash, honoring expiry and attempt limits.
// Returns { ok: boolean, reason?: string } rather than throwing, so callers can turn
// `reason` into a friendly message without leaking implementation details.
otpVerificationSchema.methods.verifyCode = function (rawCode) {
  if (this.verified) return { ok: false, reason: 'already_verified' };
  if (this.expiresAt < new Date()) return { ok: false, reason: 'expired' };
  if (this.attempts >= this.maxAttempts) return { ok: false, reason: 'too_many_attempts' };

  const candidateHash = this.constructor.hashCode(rawCode);
  const match =
    candidateHash.length === this.otpHash.length &&
    crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(this.otpHash));

  return match ? { ok: true } : { ok: false, reason: 'incorrect' };
};

const OtpVerification = mongoose.model('OtpVerification', otpVerificationSchema);
module.exports = OtpVerification;
