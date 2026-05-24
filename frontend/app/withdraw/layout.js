'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '../../lib/store';
import Sidebar from '../../components/Sidebar';

export default function WithdrawLayout({ children }) {
  const router = useRouter();
  const { token, isLoading, hydrate } = useAuthStore();
  useEffect(() => { hydrate(); }, []);
  useEffect(() => {
    if (!isLoading && !token) router.replace('/auth/login');
  }, [isLoading, token]);

  if (isLoading || !token) return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-dark-950">
      <Sidebar />
      <main className="flex-1 pt-16 lg:pt-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
