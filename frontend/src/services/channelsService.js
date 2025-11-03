import api from './api';

const channelsService = {
  list: async () => api.get('/channels'),
  add: async (url) => api.post('/channels', { url }),
  remove: async (channelId) => api.delete(`/channels/${channelId}`),
  activities: async (limit = 10) => api.get('/channels/activities', { params: { limit } }),
  refresh: async (limit = 10) => api.post('/channels/refresh', { limit }),
};

export default channelsService;
