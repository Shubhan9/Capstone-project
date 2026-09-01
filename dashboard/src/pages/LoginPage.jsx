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
            {/* Left: brand + a stylized product snapshot (decorative, not real data) */}
            <section className="login-brandpanel" aria-hidden="true">
                <div className="login-brandpanel__brand">
                    <span className="login-logo login-logo--lg">SmartOps</span>
                </div>

                <div className="login-preview">
                    <div className="login-preview__head">
                        <span>Today</span>
                        <span className="login-preview__live">● Live</span>
                    </div>

                    <div className="login-preview__revenue">
                        <span className="login-preview__label">Revenue</span>
                        <strong>₹48,250</strong>
                    </div>

                    <svg className="login-preview__chart" viewBox="0 0 300 70" preserveAspectRatio="none" role="presentation">
                        <defs>
                            <linearGradient id="pvArea" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#1db97a" stopOpacity="0.35" />
                                <stop offset="100%" stopColor="#1db97a" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <path d="M0,55 L43,46 L86,51 L129,31 L172,39 L215,20 L258,27 L300,11 L300,70 L0,70 Z" fill="url(#pvArea)" />
                        <path d="M0,55 L43,46 L86,51 L129,31 L172,39 L215,20 L258,27 L300,11" fill="none" stroke="#1db97a" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                    </svg>

                    <div className="login-preview__tiles">
                        <div><span>Orders</span><strong>132</strong></div>
                        <div><span>Low stock</span><strong>7</strong></div>
                        <div><span>Khata due</span><strong>₹9.2k</strong></div>
                    </div>
                </div>

                <p className="login-brandpanel__foot">Offline-first inventory, sales & khata for your shop.</p>
            </section>

            {/* Right: the sign-in form */}
            <section className="login-formpanel">
                <form className="login-card" onSubmit={handleSubmit}>
                    <div className="login-brand login-brand--form">
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
            </section>
        </main>
    );
}
