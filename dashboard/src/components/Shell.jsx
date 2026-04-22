import React from 'react';

export default function Shell({ title, subtitle, actions, children }) {
    return (
        <div className="shell">
            <header className="shell__header">
                <div className="shell__heading">
                    <div className="shell__brand-row">
                        <p className="eyebrow">SmartOps Analytics</p>
                        <span className="shell__badge">Dashboard</span>
                    </div>
                    <h1>{title}</h1>
                    {subtitle ? <p className="shell__subtitle">{subtitle}</p> : null}
                </div>
                <div className="shell__actions">{actions}</div>
            </header>
            <div className="shell__body">{children}</div>
        </div>
    );
}
