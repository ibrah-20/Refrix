import { create } from 'zustand';

const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rc_token', token);
      localStorage.setItem('rc_user', JSON.stringify(user));
    }
    set({ user, token, isLoading: false });
  },

  setUser: (user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rc_user', JSON.stringify(user));
    }
    set({ user });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rc_token');
      localStorage.removeItem('rc_user');
    }
    set({ user: null, token: null, isLoading: false });
  },

  hydrate: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('rc_token');
      const userStr = localStorage.getItem('rc_user');
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          set({ user, token, isLoading: false });
          return;
        } catch (_) {}
      }
    }
    set({ isLoading: false });
  },

  isAuthenticated: () => !!get().token,
  isAdmin: () => get().user?.role === 'admin',
}));

export default useAuthStore;
