import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';


import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useWavesProfile from '../hooks/useWavesProfile';

export default function Login() {
  const { user, loading, login } = useAuth();
  const toast = useToast();
  const waves = useWavesProfile();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <p className="text-center text-gray-500 mt-8">Loading…</p>;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login({ email, password });
      toast.success('Logged in.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="gc-auth-stage">


      {/* Layer 1 — readability scrim (pointer-events: none). */}
      <div className="gc-waves-overlay" />

      {/* Layer 2 — login UI, always clickable. */}
      <div className="gc-auth-panel w-full max-w-md gc-panel">
        <div style={{ height: 4, background: 'var(--gc-navy)' }} />
        <div className="p-8">
          <span className="gc-wordmark" style={{ fontSize: 20 }}>
            GovChain
          </span>
          <p className="gc-eyebrow mt-1">Officer · Contractor · Auditor</p>
          <h1 className="text-xl mt-4 mb-5">Log in to the operations console</h1>

          {error && <p className="text-sm text-red-700 mb-4">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="gc-field">
              <label htmlFor="email" className="gc-label">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="gc-input"
                placeholder="you@example.com"
              />
            </div>
            <div className="gc-field">
              <label htmlFor="password" className="gc-label">Password</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="gc-input"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="gc-btn gc-btn-primary w-full justify-center"
            >
              {submitting ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          <p className="mt-4 text-sm text-gray-600">
            Don&apos;t have an account? <Link to="/register" className="gc-link">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
}