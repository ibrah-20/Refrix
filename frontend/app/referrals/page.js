'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Users, Copy, CheckCircle, Clock, XCircle, TrendingUp } from 'lucide-react';
import { referralAPI } from '../../lib/api';
import useAuthStore from '../../lib/store';
import clsx from 'clsx';

export default function ReferralsPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [referralLink, setReferralLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    Promise.all([referralAPI.myReferrals(), referralAPI.getLink()])
      .then(([refRes, linkRes]) => {
        setData(refRes.data);
        setReferralLink(linkRes.data.link);
      })
      .catch(() => toast.error('Failed to load referrals'))
      .finally(() => setLoading(false));
  }, []);

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const filtered = data?.referrals?.filter((r) => {
    if (activeTab === 'qualified') return r.status === 'qualified';
    if (activeTab === 'pending') return r.status === 'pending';
    if (activeTab === 'level1') return r.level === 1;
    if (activeTab === 'level2') return r.level === 2;
    return true;
  });

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-2xl font-bold text-white">My Referrals</h1>
        <p className="text-slate-400 text-sm mt-1">Track everyone you've referred and your earnings</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Referred', value: data?.stats?.total || 0, icon: Users, color: 'text-blue-400' },
          { label: 'Qualified', value: data?.stats?.qualified || 0, icon: CheckCircle, color: 'text-brand-400' },
          { label: 'Pending', value: data?.stats?.pending || 0, icon: Clock, color: 'text-yellow-400' },
          { label: 'Total Earned', value: `KES ${(data?.stats?.totalCommissionEarned || 0).toLocaleString()}`, icon: TrendingUp, color: 'text-purple-400' },
        ].map((s) => (
          <div key={s.label} className="card-hover">
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <p className="text-xl font-bold text-white">{s.value}</p>
            <p className="text-slate-500 text-xs">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Referral link */}
      {user?.isPaid && (
        <div className="card">
          <h2 className="font-semibold text-white mb-3">Share Your Link</h2>
          <div className="flex gap-2">
            <input readOnly value={referralLink} className="input font-mono text-sm flex-1 text-brand-300" />
            <button onClick={copyLink} className={clsx('btn-primary px-4', copied && 'bg-emerald-600')}>
              {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['all', 'qualified', 'pending', 'level1', 'level2'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
              activeTab === tab
                ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                : 'bg-dark-800 text-slate-400 border border-slate-700 hover:text-slate-200'
            )}>
            {tab === 'level1' ? 'Level 1' : tab === 'level2' ? 'Level 2' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Referrals table */}
      <div className="card overflow-hidden p-0">
        {!filtered?.length ? (
          <div className="py-16 text-center">
            <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400">No referrals found</p>
            <p className="text-slate-500 text-sm mt-1">Share your link to start earning</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  <th className="text-xs text-slate-500 font-medium px-6 py-4">User</th>
                  <th className="text-xs text-slate-500 font-medium px-4 py-4">Level</th>
                  <th className="text-xs text-slate-500 font-medium px-4 py-4">Status</th>
                  <th className="text-xs text-slate-500 font-medium px-4 py-4">Commission</th>
                  <th className="text-xs text-slate-500 font-medium px-4 py-4">Joined</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r._id} className="border-b border-slate-800/50 hover:bg-dark-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm text-white">{r.referee?.fullName || '—'}</p>
                      <p className="text-xs text-slate-500">{r.referee?.email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={clsx('text-xs font-medium px-2.5 py-1 rounded-full',
                        r.level === 1 ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400')}>
                        L{r.level}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {r.status === 'qualified' && <span className="badge-green">Qualified</span>}
                      {r.status === 'pending' && <span className="badge-yellow">Pending</span>}
                      {r.status === 'rejected' && <span className="badge-red">Rejected</span>}
                    </td>
                    <td className="px-4 py-4">
                      <span className={clsx('text-sm font-semibold',
                        r.commissionPaid ? 'text-brand-400' : 'text-slate-500')}>
                        {r.commissionPaid ? `+KES ${r.commissionAmount}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
