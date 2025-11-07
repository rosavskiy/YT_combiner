import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

      // Actions
      login: async (credentials, method = 'telegram') => {
        set({ isLoading: true, error: null });
        try {
          let response;
          
          if (method === 'password') {
            // Авторизация по логину и паролю
            response = await axios.post(`${API_URL}/api/auth/login`, {
              login: credentials.login,
              password: credentials.password
            });
          } else {
            // Авторизация через Telegram
            response = await axios.post(`${API_URL}/api/auth/telegram`, credentials);
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
          const response = await axios.get(`${API_URL}/api/auth/me`, {
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
        requiresApproval: state.requiresApproval
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
