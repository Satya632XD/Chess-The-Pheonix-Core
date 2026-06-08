// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const SERVER_URL = 'https://phoenix-chess-server.onrender.com';
const TOKEN_KEY = 'phoenix_chess_token';
const AuthContext = createContext(null);

// ─── FIX 3A: Ping server on app load to wake Render from cold sleep ───────
// This runs before the user even tries to log in, so by the time they
// press Login the server is already awake. Without this, first login
// after 15min of inactivity always fails with "couldn't fetch".
async function wakeServer() {
  try {
    await fetch(`${SERVER_URL}/`, { method: 'GET' });
  } catch {}
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // ─── FIX 3B: Wake server immediately when app opens ─────────────────────
  useEffect(() => { wakeServer(); }, []);

  // On app load, verify token and restore user
  useEffect(() => {
    const savedToken = token;
    if (!savedToken) { setLoading(false); return; }

    fetch(`${SERVER_URL}/profile/me`, {
      headers: { Authorization: `Bearer ${savedToken}` }
    })
      .then(r => {
        // ─── FIX 3C: Check response.ok BEFORE calling .json() ─────────────
        // Previously this called .json() blindly. If the server returned
        // a 401/500, it still parsed JSON but then silently did nothing.
        // Now we handle each failure case with a clear action.
        if (r.status === 401) {
          // Token expired or invalid — clear it so user sees login screen
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
          return null;
        }
        if (!r.ok) {
          // Server error (500 etc) — keep token, user can retry
          return null;
        }
        return r.json();
      })
      .then(data => {
        if (data?.username) {
          setUser(data);
        }
      })
      .catch(() => {
        // Network failure (Render still waking up) — keep token, try later
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
    // ─── FIX 3D: Wrap fetch in try/catch to give readable network errors ──
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
    // ─── FIX 3D (same): Readable error when Render is cold ───────────────
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
      const res = await fetch(`${SERVER_URL}/profile/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.username) setUser(data);
    } catch {}
  }, [token]);

  const updateProfile = async (updates) => {
    if (!token) return;
    const res = await fetch(`${SERVER_URL}/profile/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (data.username) setUser(data);
    return data;
  };

  return (
    <AuthContext.Provider value={{
      user, token, loading,
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
