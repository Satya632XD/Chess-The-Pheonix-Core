// src/pages/AuthPage.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage({ onSuccess }) {
  const { login, register, serverReady } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [contactType, setContactType] = useState('none'); // 'none' | 'email' | 'phone'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }
    if (!isLogin && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        await login(username.trim(), password);
      } else {
        await register(
          username.trim(),
          password,
          contactType === 'email' ? email.trim() : undefined,
          contactType === 'phone' ? phone.trim() : undefined,
        );
      }
      onSuccess();
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const isDisabled = loading || !serverReady;

  const buttonLabel = () => {
    if (!serverReady) return 'Connecting to server...';
    if (loading) return 'Please wait...';
    return isLogin ? 'Login' : 'Create Account';
  };

  const inputClass =
    'w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors text-sm';

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 font-inter">
      <span className="text-5xl mb-4">♟</span>
      <h1 className="text-3xl font-black text-foreground mb-1">Phoenix Chess</h1>
      <p className="text-muted-foreground text-sm mb-8">
        {isLogin ? 'Welcome back!' : 'Create your account'}
      </p>

      {/* Server wake indicator */}
      {!serverReady && (
        <div className="w-full max-w-sm mb-4 text-xs text-center text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2">
          ⏳ Waking up server — this takes up to 30 seconds on first load...
        </div>
      )}

      <div className="w-full max-w-sm space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            {isLogin ? 'Username / Email / Phone' : 'Username *'}
          </label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder={isLogin ? 'Enter username, email or phone' : 'Choose a username'}
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Password *</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={isLogin ? 'Enter password' : 'Min 6 characters'}
            onKeyDown={e => e.key === 'Enter' && !isDisabled && handleSubmit()}
            className={inputClass}
          />
        </div>

        {/* Registration only — optional contact */}
        {!isLogin && (
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">
              Add email or phone? (optional — helps recover account)
            </label>
            <div className="flex gap-2 mb-2">
              {['none', 'email', 'phone'].map(t => (
                <button
                  key={t}
                  onClick={() => setContactType(t)}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-all font-medium ${
                    contactType === t
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card text-muted-foreground'
                  }`}
                >
                  {t === 'none' ? 'Skip' : t === 'email' ? '📧 Email' : '📱 Phone'}
                </button>
              ))}
            </div>
            {contactType === 'email' && (
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className={inputClass}
              />
            )}
            {contactType === 'phone' && (
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className={inputClass}
              />
            )}
          </div>
        )}

        {error && (
          <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={isDisabled}
          className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {buttonLabel()}
        </button>

        <button
          onClick={() => { setIsLogin(!isLogin); setError(''); }}
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Login'}
        </button>

        <button
          onClick={onSuccess}
          className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          Continue as guest →
        </button>
      </div>
    </div>
  );
          }
