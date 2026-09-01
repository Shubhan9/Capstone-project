import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginRequest } from '../lib/api';

export default function LoginPage({ auth }) {
    const navigate = useNavigate();
    const [form, setForm] = useState({ phone: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event) {
        event.preventDefault();
        setLoading(true);
        setError('');

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
            <section className="login-card">
                <div className="login-brand">
                    <span className="login-logo">SmartOps</span>
                    <span className="login-badge">Analytics</span>
                </div>

                <div className="login-heading">
                    <h1>Sign in</h1>
                    <p>Access your store's sales, stock and customer analytics.</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    <label>
                        <span>Phone</span>
                        <input
                            autoComplete="username"
                            inputMode="tel"
                            value={form.phone}
                            onChange={e => setForm(c => ({ ...c, phone: e.target.value }))}
                            placeholder="Registered phone number"
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

                <p className="login-foot">Manage your shop on the go with the SmartOps mobile app.</p>
            </section>
        </main>
    );
}
