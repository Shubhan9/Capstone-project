import React from 'react';
import { formatCurrency, formatShortDate } from '../lib/format';

// Fixed viewBox keeps the chart a consistent, compact height regardless of how
// many data points there are (the old version scaled to ~480px and looked empty).
const VB_W = 1000;
const VB_H = 260;
const PAD_L = 56;   // room for y-axis value labels
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 28;   // room for x-axis date labels

export default function SalesChart({ data }) {
    if (!data.length) return null;

    const maxRevenue = Math.max(...data.map(item => item.revenue), 1);
    const chartW = VB_W - PAD_L - PAD_R;
    const chartH = VB_H - PAD_T - PAD_B;
    const step = data.length > 1 ? chartW / (data.length - 1) : 0;
    const labelStep = Math.max(1, Math.ceil(data.length / 7));

    const yFor = revenue => PAD_T + chartH - (revenue / maxRevenue) * chartH;
    const xFor = index => PAD_L + (data.length > 1 ? index * step : chartW / 2);

    const points = data.map((item, index) => ({ ...item, x: xFor(index), y: yFor(item.revenue), index }));
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${PAD_T + chartH} L ${points[0].x} ${PAD_T + chartH} Z`;

    // Four horizontal gridlines with revenue value labels.
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map(frac => ({
        frac,
        y: PAD_T + chartH * (1 - frac),
        value: maxRevenue * frac,
    }));

    return (
        <div className="chart-shell">
            <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="sales-chart" role="img" aria-label="Sales trend chart" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="salesArea" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--teal)" stopOpacity="0.30" />
                        <stop offset="100%" stopColor="var(--teal)" stopOpacity="0.02" />
                    </linearGradient>
                </defs>

                {gridLines.map(line => (
                    <g key={line.frac}>
                        <line x1={PAD_L} x2={VB_W - PAD_R} y1={line.y} y2={line.y} className="chart-grid" vectorEffect="non-scaling-stroke" />
                        <text x={PAD_L - 10} y={line.y + 4} textAnchor="end" className="chart-axis-label">
                            {compactRupees(line.value)}
                        </text>
                    </g>
                ))}

                <path d={areaPath} fill="url(#salesArea)" />
                <path d={linePath} className="chart-line" vectorEffect="non-scaling-stroke" />

                {points.map(point => (
                    <g key={point.period}>
                        <circle cx={point.x} cy={point.y} r="5" className="chart-point" vectorEffect="non-scaling-stroke" />
                        <title>{`${formatShortDate(point.period)}: ${formatCurrency(point.revenue)} from ${point.orderCount} orders`}</title>
                    </g>
                ))}

                {points.map(point => {
                    const show = point.index === 0 || point.index === points.length - 1 || point.index % labelStep === 0;
                    return show ? (
                        <text key={`${point.period}-label`} x={point.x} y={VB_H - 8} textAnchor="middle" className="chart-axis-label">
                            {formatShortDate(point.period)}
                        </text>
                    ) : null;
                })}
            </svg>
        </div>
    );
}

// Short money labels for the y-axis: ₹0, ₹1.2k, ₹15k …
function compactRupees(value) {
    if (value >= 1000) return `₹${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
    return `₹${Math.round(value)}`;
}
