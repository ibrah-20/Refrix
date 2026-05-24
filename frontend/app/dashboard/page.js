'use client';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Wallet, Users, TrendingUp, Copy, CheckCircle, AlertTriangle, CreditCard, ExternalLink, Clock } from 'lucide-react';
import useAuthStore from '../../lib/store';
import { authAPI, paymentAPI, referralAPI } from '../../lib/api';

export default function DashboardPage() {
  const { user, setUser } = useAuthStore();
  const [referralLink, setReferralLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [checkoutId, setCheckoutId] = useState(null);
  const [polling, setPolling] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await authAPI.getMe();
      setUser(data.user);
    } catch (_) {}
  }, [setUser]);

  useEffect(() => {
    refreshUser();
    loadReferralLink();
    loadTransactions();
  }, []);

  // Poll payment status
  useEffect(() => {
    if (!checkoutId || !polling) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await paymentAPI.query(checkoutId);
        if (data.status === 'completed') {
          clearInterval(interval);
          setPolling(false);
          setCheckoutId(null);
          toast.success('🎉 Payment verified! Account activated.');
          refreshUser();
        } else if (data.status === 'failed' || data.status === 'suspicious') {
          clearInterval(interval);
          setPolling(false);
          setCheckoutId(null);
          toast.error('Payment failed or flagged. Please try again.');
        }
      } catch (_) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [checkoutId, polling, refreshUser]);

  const loadReferralLink = async () => {
    try {
      const { data } = await referralAPI.getLink();
      setReferralLink(data.link);
    } catch (_) {}
  };

  const loadTransactions = async () => {
    try {
      const { data } = await paymentAPI.myTransactions();
      setTransactions(data.transactions || []);
    } catch (_) {}
  };

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePayment = async () => {
    if (!user?.isPaid === false && user?.isPaid) return;
    setPaymentLoading(true);
    try {
      const { data } = await paymentAPI.initiate();
      setCheckoutId(data.checkoutRequestId);
      setPolling(true);
      toast.success('STK Push sent! Check your phone and enter M-Pesa PIN.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment initiation failed.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const minBalance = 1500;
  const minReferrals = 3;
  const canWithdraw = user?.walletBalance >= minBalance && user?.qualifiedReferralsCount >= minReferrals;

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
          <span className="text-brand-400">{user?.fullName?.split(' ')[0]}</span> 👋
        </h1>
        <p className="text-slate-400 text-sm mt-1">Here's your earnings overview</p>
      </div>

      {/* Payment banner */}
      {!user?.isPaid && (
        <div className="p-5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-yellow-300 font-semibold">Account Not Activated</p>
            <p className="text-yellow-400/70 text-sm">Pay KES 500 via M-Pesa to activate your account and start earning commissions.</p>
          </div>
          {polling ? (
            <div className="flex items-center gap-2 text-yellow-300 text-sm">
              <Clock className="w-4 h-4 animate-pulse" />
              Waiting for payment...
            </div>
          ) : (
            <button onClick={handlePayment} disabled={paymentLoading}
              className="btn-primary bg-yellow-500 hover:bg-yellow-600 text-black whitespace-nowrap text-sm py-2.5 px-5">
              {paymentLoading ? 'Sending...' : <><CreditCard className="w-4 h-4" /> Pay KES 500</>}
            </button>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Wallet Balance', value: `KES ${(user?.walletBalance || 0).toLocaleString()}`, icon: Wallet, color: 'text-brand-400', bg: 'bg-brand-500/10' },
          { label: 'Total Earned', value: `KES ${(user?.totalEarned || 0).toLocaleString()}`, icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Qualified Referrals', value: user?.qualifiedReferralsCount || 0, icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'Total Withdrawn', value: `KES ${(user?.totalWithdrawn || 0).toLocaleString()}`, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        ].map((stat) => (
          <div key={stat.label} className="card-hover">
            <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-slate-400 text-xs mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Referral link */}
      {user?.isPaid && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-brand-400" />
            Your Referral Link
          </h2>
          <div className="flex gap-2">
            <input readOnly value={referralLink} className="input font-mono text-sm flex-1 text-brand-300" />
            <button onClick={copyLink}
              className={`btn-primary px-4 py-3 transition-all ${copied ? 'bg-emerald-600' : ''}`}>
              {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-slate-500 text-xs mt-2">Share this link to earn KES 300 per qualified referral</p>
        </div>
      )}

      {/* Withdrawal eligibility */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Withdrawal Eligibility</h2>
        <div className="space-y-3">
          {[
            {
              label: `Qualified Referrals (${user?.qualifiedReferralsCount || 0} / ${minReferrals})`,
              met: (user?.qualifiedReferralsCount || 0) >= minReferrals,
            },
            {
              label: `Wallet Balance (KES ${(user?.walletBalance || 0).toLocaleString()} / ${minBalance.toLocaleString()})`,
              met: (user?.walletBalance || 0) >= minBalance,
            },
          ].map((req) => (
            <div key={req.label} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                ${req.met ? 'bg-brand-500/20' : 'bg-slate-700'}`}>
                {req.met
                  ? <CheckCircle className="w-3 h-3 text-brand-400" />
                  : <span className="w-1.5 h-1.5 bg-slate-500 rounded-full" />}
              </div>
              <span className={`text-sm ${req.met ? 'text-brand-300' : 'text-slate-400'}`}>{req.label}</span>
            </div>
          ))}
        </div>
        {canWithdraw && (
          <a href="/withdraw" className="btn-primary mt-4 w-fit text-sm py-2.5 px-5">
            Request Withdrawal →
          </a>
        )}
      </div>

      {/* Recent transactions */}
      {transactions.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Recent Transactions</h2>
          <div className="space-y-2">
            {transactions.slice(0, 5).map((tx) => (
              <div key={tx._id} className="flex items-center justify-between p-3 bg-dark-800 rounded-lg">
                <div>
                  <p className="text-sm text-white capitalize">{tx.type === 'commission' ? '💰 Commission' : tx.type === 'registration' ? '📋 Registration' : '💸 Withdrawal'}</p>
                  <p className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${tx.type === 'withdrawal' ? 'text-red-400' : 'text-brand-400'}`}>
                    {tx.type === 'withdrawal' ? '-' : '+'}KES {tx.amount.toLocaleString()}
                  </p>
                  <span className={`text-xs ${tx.status === 'completed' ? 'text-brand-400' : tx.status === 'pending' ? 'text-yellow-400' : 'text-red-400'}`}>
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
