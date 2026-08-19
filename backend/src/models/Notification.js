const mongoose = require('mongoose');

// In-app notification feed (spec section 25). Email/SMS channels reuse this same row —
// `channel` records where it was actually delivered, `read` only applies to in_app.
const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'registration_success',
        'phone_verified',
        'payment_success',
        'payment_failed',
        'referral_qualified',
        'reward_credited',
        'withdrawal_requested',
        'withdrawal_completed',
        'withdrawal_failed',
        'account_warning',
        'security_event',
      ],
      required: true,
    },
    channel: {
      type: String,
      enum: ['in_app', 'email', 'sms'],
      default: 'in_app',
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
