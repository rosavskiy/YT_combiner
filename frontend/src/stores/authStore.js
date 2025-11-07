import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      requiresApproval: false,
  impersonating: false,
  originalToken: null,

      // Actions
      login: async (credentials, method = 'telegram') => {
        set({ isLoading: true, error: null });
        try {
          let response;
          
          if (method === 'password') {
            // Авторизация по логину и паролю
            response = await axios.post(`${API_URL}/auth/login`, {
              login: credentials.login,
              password: credentials.password
            });
          } else {
            // Авторизация через Telegram
            response = await axios.post(`${API_URL}/auth/telegram`, credentials);
          }
          
          if (response.data.success) {
            const { user, token, requiresApproval } = response.data.data;
            
            set({
              user,
              token,
              isAuthenticated: true,
              requiresApproval,
              isLoading: false
            });

            // Устанавливаем токен для всех будущих запросов
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            return { success: true, requiresApproval };
          }
        } catch (error) {
          const errorMessage = error.response?.data?.error || 'Ошибка авторизации';
          set({ 
            error: errorMessage, 
            isLoading: false,
            isAuthenticated: false 
          });
          return { success: false, error: errorMessage };
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          requiresApproval: false,
          error: null
        });
        
        // Удаляем токен из axios
        delete axios.defaults.headers.common['Authorization'];
      },

      fetchCurrentUser: async () => {
        const { token } = get();
        if (!token) return;

        try {
          const response = await axios.get(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (response.data.success) {
            set({ 
              user: response.data.data,
              requiresApproval: !response.data.data.is_approved
            });
          }
        } catch (error) {
          console.error('Ошибка загрузки пользователя:', error);
          // Если токен недействителен, выходим
          if (error.response?.status === 401 || error.response?.status === 403) {
            get().logout();
          }
        }
      },

      // Имперсонация админа под другим пользователем
      impersonate: async (userId) => {
        const { token } = get();
        if (!token) return { success: false, error: 'Нет токена' };
        try {
          const resp = await axios.post(`${API_URL}/auth/impersonate/${userId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
          if (resp.data?.success) {
            const { token: newToken, user } = resp.data.data;
            set({
              originalToken: token,
              token: newToken,
              user,
              impersonating: true,
              isAuthenticated: true,
              requiresApproval: !user.is_approved,
            });
            axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            return { success: true };
          }
          return { success: false, error: resp.data?.error || 'Не удалось имперсонировать' };
        } catch (e) {
          return { success: false, error: e.response?.data?.error || e.message };
        }
      },

      revertImpersonation: async () => {
        const { token, originalToken } = get();
        if (!token) return { success: false };
        try {
          const resp = await axios.post(`${API_URL}/auth/revert-impersonation`, {}, { headers: { Authorization: `Bearer ${token}` } });
          if (resp.data?.success) {
            const { token: adminToken, user } = resp.data.data;
            const finalToken = adminToken || originalToken; // fallback
            set({
              token: finalToken,
              originalToken: null,
              user,
              impersonating: false,
              isAuthenticated: true,
              requiresApproval: !user.is_approved,
            });
            axios.defaults.headers.common['Authorization'] = `Bearer ${finalToken}`;
            return { success: true };
          }
          return { success: false };
        } catch (e) {
          return { success: false };
        }
      },

      setToken: (token) => {
        set({ token });
        if (token) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
      },

      clearError: () => set({ error: null }),

      // Проверить, является ли пользователь администратором
      isAdmin: () => {
        const { user } = get();
        return user?.role === 'admin';
      },

      // Проверить, подтвержден ли пользователь
      isApproved: () => {
        const { user } = get();
        return user?.is_approved === 1;
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        requiresApproval: state.requiresApproval,
        impersonating: state.impersonating,
        originalToken: state.originalToken
      }),
      onRehydrateStorage: () => (state) => {
        // Восстанавливаем токен в axios после загрузки из localStorage
        if (state?.token) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
        }
      }
    }
  )
);

export default useAuthStore;
