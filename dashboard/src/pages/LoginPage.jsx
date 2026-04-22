import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl, loginRequest } from '../lib/api';

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
            auth.login({
                token: payload.token,
                business: payload.business,
            });
            navigate('/dashboard', { replace: true });
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="auth-page">
            <section className="auth-card auth-card--intro">
                <div className="auth-brand">
                    <p className="eyebrow">SmartOps Dashboard</p>
                    <h1>Operations control for modern retail.</h1>
                    <p className="auth-copy">
                        Monitor sales, stock pressure, expiry risk, reorder priorities, and customer demand
                        from one clean business dashboard.
                    </p>
                </div>

                <div className="auth-preview">
                    <div className="auth-preview__header">
                        <span>Today</span>
                        <span className="auth-preview__status">Live business feed</span>
                    </div>
                    <div className="auth-preview__grid">
                        <div>
                            <strong>Revenue</strong>
                            <span>Track daily performance</span>
                        </div>
                        <div>
                            <strong>Inventory</strong>
                            <span>Spot low stock and expiry risk</span>
                        </div>
                        <div>
                            <strong>Recommendations</strong>
                            <span>Reorder and opportunity insights</span>
                        </div>
                        <div>
                            <strong>Customers</strong>
                            <span>View segments and repeat buyers</span>
                        </div>
                    </div>
                </div>

                <div className="auth-highlights">
                    <div>
                        <strong>5</strong>
                        <span>business intelligence modules</span>
                    </div>
                    <div>
                        <strong>JWT</strong>
                        <span>same auth layer as mobile</span>
                    </div>
                    <div>
                        <strong>Live API</strong>
                        <span>connected to your analytics backend</span>
                    </div>
                </div>
            </section>

            <section className="auth-card auth-card--form">
                <div className="auth-card__header">
                    <div>
                        <p className="eyebrow">Secure Access</p>
                        <h2>Business Login</h2>
                    </div>
                    <p className="auth-api">API base URL: {getApiBaseUrl()}</p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <label>
                        <span>Phone</span>
                        <input
                            autoComplete="username"
                            value={form.phone}
                            onChange={event => setForm(current => ({ ...current, phone: event.target.value }))}
                            placeholder="Enter registered phone"
                            required
                        />
                    </label>

                    <label>
                        <span>Password</span>
                        <input
                            autoComplete="current-password"
                            type="password"
                            value={form.password}
                            onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
                            placeholder="Enter password"
                            required
                        />
                    </label>

                    {error ? <p className="form-error">{error}</p> : null}

                    <button className="button button--primary" type="submit" disabled={loading}>
                        {loading ? 'Signing in...' : 'Open Dashboard'}
                    </button>
                </form>
            </section>
        </main>
    );
}
