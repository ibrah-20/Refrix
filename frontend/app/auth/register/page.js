'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Zap, ArrowRight, Users } from 'lucide-react';
import { authAPI } from '../../../lib/api';
import useAuthStore from '../../../lib/store';

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    referralCode: searchParams.get('ref') || '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.phone || !form.password) {
      return toast.error('Please fill in all required fields.');
    }
    if (form.password.length < 8) {
      return toast.error('Password must be at least 8 characters.');
    }

    setLoading(true);
    try {
      const { data } = await authAPI.register(form);
      setAuth(data.user, data.token);
      toast.success('Account created! Complete payment to activate.');
      router.push('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Registration failed.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Ref<span className="text-brand-400">Chain</span></span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-slate-400 mt-1 text-sm">Join and start earning through referrals</p>
        </div>

        {form.referralCode && (
          <div className="mb-6 p-4 bg-brand-500/10 border border-brand-500/30 rounded-xl flex items-center gap-3">
            <Users className="w-5 h-5 text-brand-400 flex-shrink-0" />
            <div>
              <p className="text-sm text-brand-300 font-medium">Referred by a friend</p>
              <p className="text-xs text-slate-400">Code: <span className="font-mono text-brand-400">{form.referralCode}</span></p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input name="fullName" value={form.fullName} onChange={handleChange}
              className="input" placeholder="John Doe" required />
          </div>

          <div>
            <label className="label">Email Address *</label>
            <input name="email" type="email" value={form.email} onChange={handleChange}
              className="input" placeholder="john@example.com" required />
          </div>

          <div>
            <label className="label">M-Pesa Phone Number *</label>
            <input name="phone" type="tel" value={form.phone} onChange={handleChange}
              className="input" placeholder="0712345678" required />
            <p className="text-xs text-slate-500 mt-1">Must match the phone used for M-Pesa payment</p>
          </div>

          <div>
            <label className="label">Password *</label>
            <div className="relative">
              <input name="password" type={showPassword ? 'text' : 'password'}
                value={form.password} onChange={handleChange}
                className="input pr-12" placeholder="Min. 8 characters" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Referral Code (Optional)</label>
            <input name="referralCode" value={form.referralCode} onChange={handleChange}
              className="input font-mono uppercase" placeholder="ABC12345" />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Creating account...
              </span>
            ) : (
              <>Create Account <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>

        <p className="text-center text-slate-400 text-sm mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-brand-400 hover:text-brand-300 font-medium">
            Sign in
          </Link>
        </p>

        <div className="mt-6 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
          <p className="text-xs text-yellow-400/80 text-center">
            ⚠️ A KES 500 registration fee is required via M-Pesa to activate your account and start earning.
          </p>
        </div>
      </div>
    </div>
  );
}
