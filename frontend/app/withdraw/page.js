'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ArrowDownCircle, CheckCircle, XCircle, Clock, AlertTriangle, Wallet } from 'lucide-react';
import { withdrawalAPI } from '../../lib/api';
import useAuthStore from '../../lib/store';
import clsx from 'clsx';

const statusIcon = { pending: Clock, approved: CheckCircle, rejected: XCircle, processed: CheckCircle };
const statusColor = { pending: 'text-yellow-400', approved: 'text-brand-400', rejected: 'text-red-400', processed: 'text-emerald-400' };

export default function WithdrawPage() {
  const { user } = useAuthStore();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const minBalance = 1500;
  const minReferrals = 3;
  const canWithdraw = (user?.walletBalance || 0) >= minBalance && (user?.qualifiedReferralsCount || 0) >= minReferrals;

  useEffect(() => {
    withdrawalAPI.myWithdrawals()
      .then(({ data }) => setWithdrawals(data.withdrawals || []))
      .finally(() => setLoadingHistory(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt < 100) return toast.error('Minimum withdrawal is KES 100.');
    if (amt > (user?.walletBalance || 0)) return toast.error('Insufficient balance.');
    if (!canWithdraw) return toast.error('You do not meet withdrawal requirements.');

    setLoading(true);
    try {
      const { data } = await withdrawalAPI.request(amt);
      toast.success('Withdrawal request submitted! Admin will process within 24-48 hours.');
      setAmount('');
      setWithdrawals((prev) => [data.withdrawal, ...prev]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Withdraw Funds</h1>
        <p className="text-slate-400 text-sm mt-1">Request M-Pesa withdrawal to your registered number</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Request form */}
        <div className="space-y-4">
          {/* Balance card */}
          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-500/10 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Available Balance</p>
              <p className="text-3xl font-bold text-brand-400">KES {(user?.walletBalance || 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Requirements */}
          {!canWithdraw && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <div className="flex items-center gap-2 text-yellow-400 font-medium mb-2">
                <AlertTriangle className="w-4 h-4" />
                Requirements not met
              </div>
              <ul className="space-y-1.5 text-sm text-yellow-400/70">
                {(user?.qualifiedReferralsCount || 0) < minReferrals && (
                  <li>• Need {minReferrals - (user?.qualifiedReferralsCount || 0)} more qualified referral(s)</li>
                )}
                {(user?.walletBalance || 0) < minBalance && (
                  <li>• Need KES {(minBalance - (user?.walletBalance || 0)).toLocaleString()} more in wallet</li>
                )}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmit} className="card space-y-4">
            <h2 className="font-semibold text-white">New Withdrawal Request</h2>

            <div>
              <label className="label">Amount (KES)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="input" placeholder="Enter amount (min. 100)" min="100"
                max={user?.walletBalance} step="1" disabled={!canWithdraw} />
            </div>

            <div className="p-3 bg-dark-800 rounded-lg">
              <p className="text-xs text-slate-500">Payment to:</p>
              <p className="text-white font-medium font-mono">{user?.phone}</p>
              <p className="text-xs text-slate-500 mt-0.5">Your registered M-Pesa number</p>
            </div>

            <button type="submit" disabled={loading || !canWithdraw} className="btn-primary w-full">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Submitting...
                </span>
              ) : (
                <><ArrowDownCircle className="w-4 h-4" /> Request Withdrawal</>
              )}
            </button>
          </form>
        </div>

        {/* Withdrawal history */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Withdrawal History</h2>
          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : !withdrawals.length ? (
            <div className="py-12 text-center">
              <ArrowDownCircle className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No withdrawals yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w) => {
                const Icon = statusIcon[w.status] || Clock;
                return (
                  <div key={w._id} className="flex items-center justify-between p-3 bg-dark-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${statusColor[w.status]}`} />
                      <div>
                        <p className="text-sm font-semibold text-white">KES {w.amount.toLocaleString()}</p>
                        <p className="text-xs text-slate-500">{new Date(w.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className={clsx('text-xs font-medium capitalize', statusColor[w.status])}>
                      {w.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
