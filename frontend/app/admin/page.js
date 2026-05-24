'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Users, DollarSign, AlertTriangle, Clock, CheckCircle, XCircle,
  Ban, UserCheck, TrendingUp, Shield, Search, RefreshCw
} from 'lucide-react';
import { adminAPI } from '../../lib/api';
import clsx from 'clsx';

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [banReason, setBanReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, wRes] = await Promise.all([
        adminAPI.dashboard(),
        adminAPI.users({ search }),
        adminAPI.withdrawals('pending'),
      ]);
      setStats(statsRes.data.stats);
      setUsers(usersRes.data.users);
      setWithdrawals(wRes.data.withdrawals);
    } catch (err) {
      toast.error('Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleBan = async (userId) => {
    const reason = prompt('Ban reason:');
    if (!reason) return;
    try {
      await adminAPI.banUser(userId, reason);
      toast.success('User banned.');
      loadData();
    } catch { toast.error('Failed.'); }
  };

  const handleUnban = async (userId) => {
    try {
      await adminAPI.unbanUser(userId);
      toast.success('User unbanned.');
      loadData();
    } catch { toast.error('Failed.'); }
  };

  const handleApproveWithdrawal = async (id) => {
    const receipt = prompt('M-Pesa receipt number (optional):');
    try {
      await adminAPI.approveWithdrawal(id, receipt);
      toast.success('Withdrawal approved!');
      loadData();
    } catch { toast.error('Failed.'); }
  };

  const handleRejectWithdrawal = async (id) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    try {
      await adminAPI.rejectWithdrawal(id, reason);
      toast.success('Withdrawal rejected. Amount refunded.');
      loadData();
    } catch { toast.error('Failed.'); }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'withdrawals', label: `Withdrawals ${withdrawals.length ? `(${withdrawals.length})` : ''}`, icon: DollarSign },
    { id: 'suspicious', label: 'Suspicious', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand-400" />
            Admin Panel
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage users, payments and withdrawals</p>
        </div>
        <button onClick={loadData} className="btn-secondary text-sm py-2 px-4">
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-slate-800 pb-0">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            )}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
              { label: 'Paid Users', value: stats.paidUsers, icon: CheckCircle, color: 'text-brand-400', bg: 'bg-brand-500/10' },
              { label: 'Total Revenue', value: `KES ${(stats.totalRevenue || 0).toLocaleString()}`, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: 'Suspicious', value: stats.suspiciousAccounts, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
            ].map((s) => (
              <div key={s.label} className="card-hover">
                <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center mb-3`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-slate-400 text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Recent transactions */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4">Recent Registrations</h2>
            <div className="space-y-2">
              {stats.recentTransactions?.map((tx) => (
                <div key={tx._id} className="flex items-center justify-between p-3 bg-dark-800 rounded-lg">
                  <div>
                    <p className="text-sm text-white">{tx.user?.fullName}</p>
                    <p className="text-xs text-slate-500">{tx.user?.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-brand-400">KES {tx.amount.toLocaleString()}</p>
                    <span className={clsx('text-xs', tx.status === 'completed' ? 'text-brand-400' : tx.status === 'pending' ? 'text-yellow-400' : 'text-red-400')}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Users */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input className="input pl-9" placeholder="Search by name, email, or phone..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()} />
            </div>
            <button onClick={loadData} className="btn-primary px-5 py-3 text-sm">Search</button>
          </div>
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-xs text-slate-500 font-medium px-6 py-4 text-left">User</th>
                    <th className="text-xs text-slate-500 font-medium px-4 py-4 text-left">Phone</th>
                    <th className="text-xs text-slate-500 font-medium px-4 py-4 text-left">Status</th>
                    <th className="text-xs text-slate-500 font-medium px-4 py-4 text-left">Balance</th>
                    <th className="text-xs text-slate-500 font-medium px-4 py-4 text-left">Referrals</th>
                    <th className="text-xs text-slate-500 font-medium px-4 py-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id} className="border-b border-slate-800/50 hover:bg-dark-800/40">
                      <td className="px-6 py-4">
                        <p className="text-sm text-white">{u.fullName}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-300 font-mono">{u.phone}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          {u.isBanned && <span className="badge-red">Banned</span>}
                          {u.isSuspicious && <span className="badge-yellow">Suspicious</span>}
                          {u.isPaid && !u.isBanned && <span className="badge-green">Active</span>}
                          {!u.isPaid && !u.isBanned && <span className="text-xs text-slate-500">Unpaid</span>}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-brand-400">
                        KES {(u.walletBalance || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-300">{u.qualifiedReferralsCount || 0}</td>
                      <td className="px-4 py-4">
                        {u.isBanned ? (
                          <button onClick={() => handleUnban(u._id)}
                            className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 font-medium">
                            <UserCheck className="w-3.5 h-3.5" /> Unban
                          </button>
                        ) : (
                          <button onClick={() => handleBan(u._id)}
                            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-medium">
                            <Ban className="w-3.5 h-3.5" /> Ban
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!users.length && (
                <div className="py-12 text-center text-slate-400">No users found</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Withdrawals */}
      {activeTab === 'withdrawals' && (
        <div className="card overflow-hidden p-0">
          {!withdrawals.length ? (
            <div className="py-16 text-center">
              <CheckCircle className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400">No pending withdrawals</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-xs text-slate-500 font-medium px-6 py-4 text-left">User</th>
                    <th className="text-xs text-slate-500 font-medium px-4 py-4 text-left">Amount</th>
                    <th className="text-xs text-slate-500 font-medium px-4 py-4 text-left">Phone</th>
                    <th className="text-xs text-slate-500 font-medium px-4 py-4 text-left">Requested</th>
                    <th className="text-xs text-slate-500 font-medium px-4 py-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w._id} className="border-b border-slate-800/50 hover:bg-dark-800/40">
                      <td className="px-6 py-4">
                        <p className="text-sm text-white">{w.user?.fullName}</p>
                        <p className="text-xs text-slate-500">{w.user?.email}</p>
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-brand-400">
                        KES {w.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-sm font-mono text-slate-300">{w.phoneNumber}</td>
                      <td className="px-4 py-4 text-xs text-slate-500">
                        {new Date(w.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => handleApproveWithdrawal(w._id)}
                            className="flex items-center gap-1.5 text-xs bg-brand-500/10 text-brand-400 border border-brand-500/20 px-3 py-1.5 rounded-lg hover:bg-brand-500/20 transition-colors">
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button onClick={() => handleRejectWithdrawal(w._id)}
                            className="btn-danger text-xs py-1.5 px-3">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Suspicious */}
      {activeTab === 'suspicious' && (
        <SuspiciousTab />
      )}
    </div>
  );
}

function SuspiciousTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.users({ status: 'suspicious' })
      .then(({ data }) => setData(data.users || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="card overflow-hidden p-0">
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : !data.length ? (
        <div className="py-16 text-center">
          <Shield className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400">No suspicious accounts</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-xs text-slate-500 font-medium px-6 py-4 text-left">User</th>
                <th className="text-xs text-slate-500 font-medium px-4 py-4 text-left">Reason</th>
                <th className="text-xs text-slate-500 font-medium px-4 py-4 text-left">IP</th>
                <th className="text-xs text-slate-500 font-medium px-4 py-4 text-left">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u._id} className="border-b border-slate-800/50">
                  <td className="px-6 py-4">
                    <p className="text-sm text-white">{u.fullName}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
                      {u.suspiciousReason || 'Flagged'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs font-mono text-slate-400">{u.registrationIP || '—'}</td>
                  <td className="px-4 py-4 text-xs text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
