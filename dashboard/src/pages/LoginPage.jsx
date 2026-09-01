import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginRequest } from '../lib/api';

export default function LoginPage({ auth }) {
    const navigate = useNavigate();
    const [form, setForm] = useState({ phone: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Keep only digits, cap at 10 — a valid Indian mobile number.
    function setPhone(value) {
        const digits = value.replace(/\D/g, '').slice(0, 10);
        setForm(c => ({ ...c, phone: digits }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setError('');

        if (form.phone.length !== 10) {
            setError('Enter a valid 10-digit phone number.');
            return;
        }
        if (!form.password) {
            setError('Enter your password.');
            return;
        }

        setLoading(true);
        try {
            const payload = await loginRequest(form);
            auth.login({ token: payload.token, business: payload.business });
            navigate('/dashboard', { replace: true });
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="login-page">
            <form className="login-card" onSubmit={handleSubmit}>
                <div className="login-brand">
                    <span className="login-logo">SmartOps</span>
                    <span className="login-badge">Analytics</span>
                </div>

                <div className="login-heading">
                    <h1>Sign in</h1>
                    <p>Use your registered shop phone and password.</p>
                </div>

                <label>
                    <span>Phone</span>
                    <input
                        autoComplete="username"
                        inputMode="numeric"
                        value={form.phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="10-digit phone number"
                        required
                    />
                </label>

                <label>
                    <span>Password</span>
                    <input
                        autoComplete="current-password"
                        type="password"
                        value={form.password}
                        onChange={e => setForm(c => ({ ...c, password: e.target.value }))}
                        placeholder="Password"
                        required
                    />
                </label>

                {error ? <p className="login-error">{error}</p> : null}

                <button className="login-submit" type="submit" disabled={loading}>
                    {loading ? 'Signing in…' : 'Sign in'}
                </button>
            </form>
        </main>
    );
}
