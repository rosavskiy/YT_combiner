import { create } from 'zustand';
import { io } from 'socket.io-client';

export const useSocketStore = create((set, get) => ({
  socket: null,
  connected: false,
  notifications: [],
  
  connect: () => {
    const socket = io('http://localhost:3000', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    socket.on('connect', () => {
      console.log('✅ WebSocket подключен:', socket.id);
      set({ connected: true });
    });
    
    socket.on('connected', (data) => {
      console.log('📡 Сообщение от сервера:', data);
    });
    
    socket.on('disconnect', () => {
      console.log('❌ WebSocket отключен');
      set({ connected: false });
    });
    
    socket.on('error', (error) => {
      console.error('❌ WebSocket ошибка:', error);
    });
    
    set({ socket });
  },
  
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false });
    }
  },
  
  addNotification: (notification) => {
    set((state) => ({
      notifications: [...state.notifications, {
        ...notification,
        id: Date.now(),
        timestamp: new Date().toISOString()
      }]
    }));
  },
  
  clearNotifications: () => {
    set({ notifications: [] });
  }
}));
