const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    targetWithdrawal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Withdrawal',
    },
    details: mongoose.Schema.Types.Mixed,
    ipAddress: String,
  },
  { timestamps: true }
);

const AdminLog = mongoose.model('AdminLog', adminLogSchema);
module.exports = AdminLog;
