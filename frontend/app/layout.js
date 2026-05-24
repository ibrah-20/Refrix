import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'Refrix — Earn by Referring',
  description: 'Join Refrix and earn KES 300 for every direct referral. Real M-Pesa payouts.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-dark-950 text-slate-100 antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid #22c55e33',
              borderRadius: '10px',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#0f172a' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#0f172a' } },
          }}
        />
      </body>
    </html>
  );
}
