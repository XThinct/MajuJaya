import axios from 'axios';
export const client = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 15000 });
client.interceptors.request.use(config => { const token = sessionStorage.getItem('approvals-token'); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
client.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && !error.config.url.includes('/login')) window.dispatchEvent(new Event('session-expired'));
  return Promise.reject(error);
});
export const errorMessage = error => error.response?.data?.message || (error.code === 'ECONNABORTED' ? 'The server took too long to respond. Please retry.' : 'Unable to connect. Check that the backend is running.');
