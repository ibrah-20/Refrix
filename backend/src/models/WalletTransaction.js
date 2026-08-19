const mongoose = require('mongoose');

// Append-only ledger (spec sections 15-16). Every wallet movement — reward, withdrawal,
// reversal, adjustment, refund, bonus — gets its own row here. User.walletBalance stays as
// a cached/denormalized figure that this ledger keeps in sync (inside the same Mongo
// session as the write below), so the ledger is always the source of truth if the two
// ever disagree.
const walletTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['referral_reward', 'withdrawal', 'reversal', 'adjustment', 'refund', 'bonus'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      // Positive = credit to wallet, negative = debit. Withdrawals and reversed rewards
      // are stored as negative amounts so `balance = sum(amount)` always holds.
    },
    description: {
      type: String,
      required: true,
    },
    // Unique external reference so the same event can never be ledgered twice
    // (spec section 11: idempotency). E.g. a commission ID, withdrawal ID, or
    // M-Pesa receipt number depending on `type`.
    reference: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'reversed'],
      default: 'completed',
    },
    // Balance snapshot immediately after this entry was applied — makes it cheap to
    // display running history without recomputing the whole ledger every time.
    balanceAfter: {
      type: Number,
      required: true,
    },
    relatedCommission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Referral',
    },
    relatedWithdrawal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Withdrawal',
    },
  },
  { timestamps: true }
);

// A given reference can appear at most once per type — this is the DB-level idempotency
// guard called out in spec section 11 (e.g. one M-Pesa receipt can never create two entries).
walletTransactionSchema.index({ reference: 1, type: 1 }, { unique: true });
walletTransactionSchema.index({ user: 1, createdAt: -1 });

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);
module.exports = WalletTransaction;
