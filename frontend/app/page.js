'use client';
import Link from 'next/link';
import { ArrowRight, Users, Wallet, Shield, Zap, ChevronRight, CheckCircle } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-dark-950 overflow-hidden">
      {/* Nav */}
      <nav className="border-b border-slate-800/60 backdrop-blur-sm sticky top-0 z-50 bg-dark-950/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Ref<span className="text-brand-400">rix</span></span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-slate-400 hover:text-white text-sm transition-colors px-3 py-2">
              Login
            </Link>
            <Link href="/auth/register" className="btn-primary text-sm py-2 px-5">
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-500/5 rounded-full blur-3xl" />
        </div>

        <div className="animate-in relative z-10">
          <span className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 text-brand-400 text-sm px-4 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse-slow" />
            M-Pesa Verified Payouts
          </span>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-tight mb-6">
            Earn Real Money <br />
            <span className="text-brand-400 text-glow">By Referring Friends</span>
          </h1>

          <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Join Refrix, pay a one-time KES 500 registration fee, share your link,
            and earn <strong className="text-white">KES 300</strong> for every direct referral —
            paid instantly to your M-Pesa.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/register" className="btn-primary w-full sm:w-auto text-base py-4 px-8">
              Start Earning Now <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/auth/login" className="btn-secondary w-full sm:w-auto text-base py-4 px-8">
              I have an account
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-16 grid grid-cols-3 gap-4 max-w-xl mx-auto">
          {[
            { label: 'Registration', value: 'KES 500' },
            { label: 'Direct Referral', value: 'KES 300' },
            { label: '2nd Level', value: 'KES 100' },
          ].map((s) => (
            <div key={s.label} className="card text-center py-4">
              <div className="text-2xl font-bold text-brand-400">{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-white mb-12">
          How It <span className="text-brand-400">Works</span>
        </h2>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { step: '01', icon: Users, title: 'Register', desc: 'Sign up with your phone number and email address.' },
            { step: '02', icon: Wallet, title: 'Pay KES 500', desc: 'Complete your registration via M-Pesa STK Push.' },
            { step: '03', icon: Zap, title: 'Share Your Link', desc: 'Copy your unique referral link and share it with friends.' },
            { step: '04', icon: CheckCircle, title: 'Earn Commissions', desc: 'Get KES 300 for every qualified direct referral.' },
          ].map((item) => (
            <div key={item.step} className="card-hover relative">
              <div className="text-4xl font-black text-brand-500/10 absolute top-4 right-4">{item.step}</div>
              <div className="w-10 h-10 bg-brand-500/10 rounded-lg flex items-center justify-center mb-4">
                <item.icon className="w-5 h-5 text-brand-400" />
              </div>
              <h3 className="font-bold text-white mb-2">{item.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Commission structure */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="card glow-green">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">Commission Structure</h2>
              <div className="space-y-4">
                {[
                  { level: 'Level 1 (Direct)', earn: 'KES 300', desc: 'Person you refer pays' },
                  { level: 'Level 2 (Indirect)', earn: 'KES 100', desc: "Your referral's referral pays" },
                ].map((c) => (
                  <div key={c.level} className="flex items-center justify-between p-4 bg-dark-800 rounded-lg border border-slate-700">
                    <div>
                      <div className="font-semibold text-white">{c.level}</div>
                      <div className="text-xs text-slate-500">{c.desc}</div>
                    </div>
                    <div className="text-brand-400 font-bold text-lg">{c.earn}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-300 mb-4">Withdrawal Requirements</h3>
              {[
                'Minimum 3 qualified referrals',
                'Minimum KES 1,500 wallet balance',
                'Phone number must match M-Pesa payment',
                'Verified account required',
              ].map((req) => (
                <div key={req} className="flex items-center gap-3 text-slate-400 text-sm">
                  <CheckCircle className="w-4 h-4 text-brand-500 flex-shrink-0" />
                  {req}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-brand-400 mb-3">
            <Shield className="w-5 h-5" />
            <span className="font-semibold">Anti-Fraud Protection</span>
          </div>
          <h2 className="text-2xl font-bold text-white">Your Money is Safe</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { title: 'Phone Verification', desc: 'M-Pesa payment phone must match registered number.' },
            { title: 'No Self-Referrals', desc: 'System automatically detects and prevents self-referrals.' },
            { title: 'Unique Transactions', desc: 'Every M-Pesa receipt is verified for uniqueness.' },
          ].map((f) => (
            <div key={f.title} className="card text-center">
              <div className="w-8 h-8 bg-brand-500/10 rounded-lg mx-auto mb-3 flex items-center justify-center">
                <Shield className="w-4 h-4 text-brand-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
        <div className="card glow-green max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Start Earning?</h2>
          <p className="text-slate-400 mb-8">Join thousands of Kenyans earning real money through referrals.</p>
          <Link href="/auth/register" className="btn-primary mx-auto w-fit text-base py-4 px-10">
            Register Now — KES 500 <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-brand-500 rounded flex items-center justify-center">
            <Zap className="w-3 h-3 text-white" />
          </div>
          <span className="font-bold text-white">Refrix</span>
        </div>
        <p className="text-slate-500 text-sm">© {new Date().getFullYear()} Refrix. All rights reserved.</p>
        <div className="flex gap-4 text-sm text-slate-500">
          <span>Powered by M-Pesa Daraja</span>
        </div>
      </footer>
    </div>
  );
}
