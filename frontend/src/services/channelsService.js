import api from './api';

const channelsService = {
  list: async () => api.get('/channels'),
  add: async (url) => api.post('/channels', { url }),
  remove: async (channelId) => api.delete(`/channels/${channelId}`),
  activities: async (limit = 5, channelIds = []) => {
    const params = { limit };
    if (channelIds.length > 0) {
      params.channelIds = channelIds.join(',');
    }
    return api.get('/channels/activities', { params });
  },
  refresh: async (limit = 5, channelIds = []) => {
    return api.post('/channels/refresh', { limit, channelIds });
  },
};

export default channelsService;
