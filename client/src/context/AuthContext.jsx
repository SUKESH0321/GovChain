import { createContext, useContext, useEffect, useState } from 'react';

import { getToken, setToken } from '../services/api';
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from '../services/auth.service';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On app start, if a JWT is stored, fetch the current user to restore the session.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }

    getCurrentUser()
      .then((data) => setUser(data.user))
      .catch(() => setToken(null)) // Token is missing/expired/invalid — drop it.
      .finally(() => setLoading(false));
  }, []);

  async function login(credentials) {
    const data = await loginUser(credentials);
    setUser(data.user);
    return data;
  }

  async function register(details) {
    return registerUser(details);
  }

  function logout() {
    logoutUser();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}