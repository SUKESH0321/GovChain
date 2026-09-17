// Base URL for the backend API.
// In development, requests to /api are proxied to the Express server by Vite.
// Set VITE_API_URL in client/.env to point at a deployed backend.
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const TOKEN_KEY = 'govchain_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Small fetch wrapper: sets JSON headers, attaches the stored JWT when present,
// and turns non-2xx responses into readable errors.
export async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Body was not JSON — that's fine for error responses.
  }

  if (!response.ok) {
    const message = (data && data.message) || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export async function getHealth() {
  return request('/health');
}