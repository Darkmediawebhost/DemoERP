import axios from 'axios';

const apiOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const tokenKey = 'dm_session';

export const api = axios.create({
  baseURL: `${apiOrigin}/api`,
  withCredentials: true,
});

api.interceptors.request.use((request) => {
  const token = localStorage.getItem(tokenKey);
  if (token) request.headers.Authorization = `Bearer ${token}`;
  return request;
});

export function saveSession(token: string | undefined) {
  if (token) localStorage.setItem(tokenKey, token);
}

export function clearSession() {
  localStorage.removeItem(tokenKey);
}

export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Something went wrong. Try again.';
}

export function idempotencyKey() {
  return crypto.randomUUID();
}
