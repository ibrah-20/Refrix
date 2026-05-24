import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('rc_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    // Device fingerprint (simple)
    const fp = localStorage.getItem('rc_fp') || Math.random().toString(36).slice(2);
    localStorage.setItem('rc_fp', fp);
    config.headers['x-device-fingerprint'] = fp;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('rc_token');
      localStorage.removeItem('rc_user');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// Payments
export const paymentAPI = {
  initiate: () => api.post('/payments/initiate'),
  query: (checkoutRequestId) => api.get(`/payments/query/${checkoutRequestId}`),
  myTransactions: (page = 1) => api.get(`/payments/my-transactions?page=${page}`),
};

// Referrals
export const referralAPI = {
  myReferrals: () => api.get('/referrals/my-referrals'),
  getLink: () => api.get('/referrals/link'),
  referredBy: () => api.get('/referrals/referred-by'),
};

// Withdrawals
export const withdrawalAPI = {
  request: (amount) => api.post('/withdrawals/request', { amount }),
  myWithdrawals: () => api.get('/withdrawals/my-withdrawals'),
};

// Admin
export const adminAPI = {
  dashboard: () => api.get('/admin/dashboard'),
  users: (params) => api.get('/admin/users', { params }),
  banUser: (userId, reason) => api.patch(`/admin/users/${userId}/ban`, { reason }),
  unbanUser: (userId) => api.patch(`/admin/users/${userId}/unban`),
  withdrawals: (status) => api.get('/admin/withdrawals', { params: { status } }),
  approveWithdrawal: (id, mpesaReceiptNumber) =>
    api.patch(`/admin/withdrawals/${id}/approve`, { mpesaReceiptNumber }),
  rejectWithdrawal: (id, reason) => api.patch(`/admin/withdrawals/${id}/reject`, { reason }),
  transactions: (params) => api.get('/admin/transactions', { params }),
  logs: () => api.get('/admin/logs'),
};
