import { useState } from 'react';
import { Link } from 'react-router-dom';


import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useWavesProfile from '../hooks/useWavesProfile';

const ROLE_OPTIONS = [
  { value: 'government_officer', label: 'Government Officer' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'auditor', label: 'Auditor' },
];

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const waves = useWavesProfile();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('contractor');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    try {
      await register({ name, email, password, role });
      setSuccess(true);
      toast.success('Account created.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="gc-auth-stage">
      {/* Layer 0 — animated background. Never inside the form card. */}


      {/* Layer 1 — readability scrim (pointer-events: none). */}
      <div className="gc-waves-overlay" />

      {/* Layer 2 — registration UI, always clickable. */}
      <div className="gc-auth-panel w-full max-w-md gc-panel">
        <div style={{ height: 4, background: 'var(--gc-navy)' }} />
        <div className="p-8">
          <span className="gc-wordmark" style={{ fontSize: 20 }}>
            GovChain
          </span>
          <p className="gc-eyebrow mt-1">Create an operator account</p>
          <h1 className="text-xl mt-4 mb-5">Register for the operations console</h1>

          {error && <p className="text-sm text-red-700 mb-4">{error}</p>}
          {success && (
            <p className="text-sm text-green-700 mb-4">
              Account created! You can now <Link to="/login" className="gc-link">log in</Link>.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="gc-field">
              <label htmlFor="name" className="gc-label">Name</label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="gc-input"
                placeholder="Your name"
              />
            </div>
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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="gc-input"
                placeholder="At least 6 characters"
              />
            </div>
            <div className="gc-field">
              <label htmlFor="role" className="gc-label">Role</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="gc-select"
              >
                {ROLE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="gc-btn gc-btn-primary w-full justify-center"
            >
              {submitting ? 'Registering…' : 'Register'}
            </button>
          </form>

          <p className="mt-4 text-sm text-gray-600">
            Already have an account? <Link to="/login" className="gc-link">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}