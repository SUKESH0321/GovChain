import { request, setToken, clearToken } from './api';

export async function registerUser({ name, email, password, role }) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, role }),
  });
}

// Logs the user in and stores the returned JWT for later requests.
export async function loginUser({ email, password }) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data;
}

// Returns the currently authenticated user: server sends back { user }.
export async function getCurrentUser() {
  return request('/auth/me');
}

export function logoutUser() {
  clearToken();
}