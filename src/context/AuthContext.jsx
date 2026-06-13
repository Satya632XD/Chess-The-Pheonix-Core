// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const SERVER_URL = 'https://phoenix-chess-server.onrender.com';
const TOKEN_KEY = 'phoenix_chess_token';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  const [serverReady, setServerReady] = useState(false);

  // Wake Render server on app load and wait for it
  useEffect(() => {
    fetch(`${SERVER_URL}/`)
      .then(() => setServerReady(true))
      .catch(() => setServerReady(true)); // unblock UI even if ping fails
  }, []);

  // On app load, verify token and restore user
  useEffect(() => {
    const savedToken = token;
    if (!savedToken) { setLoading(false); return; }

    fetch(`${SERVER_URL}/auth/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${savedToken}` },
    })
      .then(r => {
        if (r.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
          return null;
        }
        if (!r.ok) return null;
        return r.json();
      })
      .then(data => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {
        // Network failure — keep token, user can retry
      })
      .finally(() => setLoading(false));
  }, []);

  const saveToken = (t) => {
    setToken(t);
    try { localStorage.setItem(TOKEN_KEY, t); } catch {}
  };

  const clearToken = () => {
    setToken(null);
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
  };

  const register = async (username, password, email, phone) => {
    let res;
    try {
      res = await fetch(`${SERVER_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email, phone }),
      });
    } catch {
      throw new Error('Cannot reach server. It may be starting up — wait 30 seconds and try again.');
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    saveToken(data.token);
    setUser(data.user);
    return data;
  };

  const login = async (usernameOrEmail, password) => {
    let res;
    try {
      res = await fetch(`${SERVER_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameOrEmail, password }),
      });
    } catch {
      throw new Error('Cannot reach server. It may be starting up — wait 30 seconds and try again.');
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    saveToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try {
      await fetch(`${SERVER_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    clearToken();
    setUser(null);
  };

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${SERVER_URL}/auth/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.user) setUser(data.user);
    } catch {}
  }, [token]);

  // NOTE: Add a PATCH /profile/me route to server.js to enable this
  const updateProfile = async (updates) => {
    if (!token) return;
    const res = await fetch(`${SERVER_URL}/profile/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (data.username) setUser(data);
    return data;
  };

  return (
    <AuthContext.Provider value={{
      user, token, loading, serverReady,
      register, login, logout,
      refreshUser, updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
      }
