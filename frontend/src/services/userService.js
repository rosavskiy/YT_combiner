import api from './api';

const userService = {
  getMyMetrics: () => api.get('/user/me/metrics'),
  getAllMetrics: () => api.get('/user/metrics'),
};

export default userService;
