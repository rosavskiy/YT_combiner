import api from './api';

const worktimeService = {
  start: () => api.post('/worktime/start'),
  stop: () => api.post('/worktime/stop'),
  active: () => api.get('/worktime/active'),
  summary: (params) => api.get('/worktime/summary', { params }),
};

export default worktimeService;
