'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, Wallet, ArrowDownCircle, LogOut, Zap, Menu, X, Settings } from 'lucide-react';
import useAuthStore from '../lib/store';
import { useState } from 'react';
import clsx from 'clsx';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/referrals', icon: Users, label: 'My Referrals' },
  { href: '/withdraw', icon: ArrowDownCircle, label: 'Withdraw' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  const NavLinks = () => (
    <nav className="flex-1 space-y-1">
      {navItems.map(({ href, icon: Icon, label }) => (
        <Link key={href} href={href}
          onClick={() => setMobileOpen(false)}
          className={clsx(
            'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150',
            pathname === href
              ? 'bg-brand-500/15 text-brand-400 border border-brand-500/20'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
          )}>
          <Icon className="w-5 h-5 flex-shrink-0" />
          {label}
        </Link>
      ))}
      {user?.role === 'admin' && (
        <Link href="/admin"
          onClick={() => setMobileOpen(false)}
          className={clsx(
            'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150',
            pathname.startsWith('/admin')
              ? 'bg-brand-500/15 text-brand-400 border border-brand-500/20'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
          )}>
          <Settings className="w-5 h-5 flex-shrink-0" />
          Admin Panel
        </Link>
      )}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-dark-900 border-r border-slate-800 min-h-screen p-4">
        <Link href="/" className="flex items-center gap-2 px-2 py-3 mb-6">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white">Ref<span className="text-brand-400">rix</span></span>
        </Link>

        {/* User card */}
        <div className="mb-6 p-3 bg-dark-800 rounded-xl border border-slate-700">
          <div className="w-10 h-10 bg-brand-500/20 rounded-full flex items-center justify-center mb-2">
            <span className="text-brand-400 font-bold text-sm">
              {user?.fullName?.charAt(0).toUpperCase()}
            </span>
          </div>
          <p className="text-white font-medium text-sm truncate">{user?.fullName}</p>
          <p className="text-slate-400 text-xs truncate">{user?.email}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-xs bg-dark-900 text-brand-400 border border-brand-500/20 px-2 py-0.5 rounded">
              {user?.referralCode}
            </span>
            {user?.isPaid ? (
              <span className="badge-green text-xs">Active</span>
            ) : (
              <span className="badge-yellow text-xs">Unpaid</span>
            )}
          </div>
        </div>

        <NavLinks />

        <div className="mt-auto pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between px-2 mb-3">
            <div>
              <p className="text-xs text-slate-500">Wallet</p>
              <p className="text-brand-400 font-bold">KES {(user?.walletBalance || 0).toLocaleString()}</p>
            </div>
            <Wallet className="w-5 h-5 text-slate-500" />
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/5 w-full transition-colors">
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-dark-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white">Refrix</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-brand-400 font-bold text-sm">KES {(user?.walletBalance || 0).toLocaleString()}</span>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-slate-400 hover:text-white">
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setMobileOpen(false)}>
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-dark-900 border-r border-slate-800 p-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 mt-2 p-3 bg-dark-800 rounded-xl border border-slate-700">
              <p className="text-white font-medium text-sm">{user?.fullName}</p>
              <p className="text-slate-400 text-xs">{user?.email}</p>
            </div>
            <NavLinks />
            <button onClick={handleLogout}
              className="mt-auto flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-slate-400 hover:text-red-400">
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
