import axios from 'axios';

export const api = axios.create({ baseURL: '/api', withCredentials: true });

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
