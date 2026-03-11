'use client';

import AppShell from '@/components/layout/AppShell';
import { useState, useEffect, useCallback, useMemo } from 'react';

// ── Types ────────────────────────────────────────────────────
interface COTRecord {
    date: string;
    commodity: string;
    contractName: string;
    openInterest: number;
    prodLong: number; prodShort: number; prodNet: number;
    swapLong: number; swapShort: number; swapSpread: number; swapNet: number;
    mmLong: number; mmShort: number; mmSpread: number; mmNet: number;
    otherLong: number; otherShort: number; otherSpread: number; otherNet: number;
    nonreptLong: number; nonreptShort: number; nonreptNet: number;
    changeOI: number;
    changeMMLong: number; changeMMShort: number; changeMMNet: number;
    changeProdLong: number; changeProdShort: number; changeProdNet: number;
    pctMMLong: number; pctMMShort: number;
    pctProdLong: number; pctProdShort: number;
}

interface COTSummaryRow {
    commodity: string;
    commodityKey: string;
    exchange: string;
    latestDate: string;
    openInterest: number;
    oiChange: number;
    mmNet: number;
    mmNetChange: number;
    mmLong: number;
    mmShort: number;
    prodNet: number;
    cotIndex: number | null;
    cotIndexLabel: string;
    divergence: boolean;
}

interface SingleCOTData {
    commodity: string;
    contractName: string;
    exchange: string;
    totalWeeks: number;
    latestDate: string;
    cotIndex: number | null;
    cotIndexLabel: string;
    divergence: { isDiverging: boolean; commercialNet: number; speculatorNet: number; signal: string };
    latest: COTRecord;
    records: COTRecord[];
}

const COMMODITY_OPTIONS = [
    { key: 'gold', label: 'Gold', icon: '🥇' },
    { key: 'silver', label: 'Silver', icon: '🥈' },
    { key: 'copper', label: 'Copper', icon: '🔩' },
    { key: 'crude', label: 'Crude Oil', icon: '🛢️' },
    { key: 'natural-gas', label: 'Natural Gas', icon: '🔥' },
    { key: 'wheat', label: 'Wheat', icon: '🌾' },
    { key: 'corn', label: 'Corn', icon: '🌽' },
    { key: 'soybeans', label: 'Soybeans', icon: '🫘' },
    { key: 'cotton', label: 'Cotton', icon: '🧶' },
    { key: 'sugar', label: 'Sugar', icon: '🍬' },
    { key: 'coffee', label: 'Coffee', icon: '☕' },
    { key: 'platinum', label: 'Platinum', icon: '✨' },
    { key: 'palladium', label: 'Palladium', icon: '💎' },
];

// ── Helpers ──────────────────────────────────────────────────
const fmtNum = (n: number) => {
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
};

const fmtDate = (d: string) => {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ── COT Index Gauge Component ────────────────────────────────
function COTGauge({ value, size = 160 }: { value: number | null; size?: number }) {
    if (value === null) return <div style={{ width: size, height: size / 2 + 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>N/A</div>;

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 12;
    const startAngle = Math.PI;
    const endAngle = 0;
    const angle = startAngle - (value / 100) * Math.PI;

    const needleX = cx + (r - 10) * Math.cos(angle);
    const needleY = cy - (r - 10) * Math.sin(angle);

    // Color based on value
    const getColor = (v: number) => {
        if (v <= 20) return '#ef4444'; // Extreme bearish (contrarian bullish)
        if (v <= 40) return '#f97316';
        if (v <= 60) return '#a3a3a3';
        if (v <= 80) return '#22c55e';
        return '#16a34a'; // Extreme bullish (contrarian bearish)
    };

    return (
        <div style={{ textAlign: 'center' }}>
            <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
                {/* Background arc */}
                <path
                    d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                    fill="none"
                    stroke="var(--bg-tertiary)"
                    strokeWidth={10}
                    strokeLinecap="round"
                />
                {/* Colored segments */}
                {[0, 20, 40, 60, 80].map((seg, i) => {
                    const colors = ['#ef4444', '#f97316', '#a3a3a3', '#22c55e', '#16a34a'];
                    const a1 = Math.PI - (seg / 100) * Math.PI;
                    const a2 = Math.PI - (Math.min(seg + 20, 100) / 100) * Math.PI;
                    const x1 = cx + r * Math.cos(a1);
                    const y1 = cy - r * Math.sin(a1);
                    const x2 = cx + r * Math.cos(a2);
                    const y2 = cy - r * Math.sin(a2);
                    return (
                        <path
                            key={i}
                            d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
                            fill="none"
                            stroke={colors[i]}
                            strokeWidth={10}
                            strokeLinecap="round"
                            opacity={0.3}
                        />
                    );
                })}
                {/* Needle */}
                <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke={getColor(value)} strokeWidth={2.5} strokeLinecap="round" />
                <circle cx={cx} cy={cy} r={4} fill={getColor(value)} />
                {/* Value text */}
                <text x={cx} y={cy + 22} textAnchor="middle" fill="var(--text-primary)" fontSize={size / 6} fontWeight="bold">{value}</text>
                {/* Labels */}
                <text x={cx - r + 5} y={cy + 15} textAnchor="start" fill="var(--text-tertiary)" fontSize={9}>Bearish</text>
                <text x={cx + r - 5} y={cy + 15} textAnchor="end" fill="var(--text-tertiary)" fontSize={9}>Bullish</text>
            </svg>
        </div>
    );
}

// ── Net Positioning Bar Chart (Canvas) ───────────────────────
function NetPositionChart({ records, height = 200 }: { records: COTRecord[]; height?: number }) {
    const canvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
        if (!canvas || records.length === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        const data = [...records].reverse(); // chronological
        const mmNets = data.map(r => r.mmNet);
        const prodNets = data.map(r => r.prodNet);
        const allVals = [...mmNets, ...prodNets];
        const maxAbs = Math.max(Math.abs(Math.min(...allVals)), Math.abs(Math.max(...allVals)));

        const pad = { top: 10, right: 10, bottom: 25, left: 50 };
        const chartW = w - pad.left - pad.right;
        const chartH = h - pad.top - pad.bottom;
        const midY = pad.top + chartH / 2;

        // Zero line
        ctx.strokeStyle = 'rgba(150,150,150,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, midY);
        ctx.lineTo(w - pad.right, midY);
        ctx.stroke();

        // Y-axis labels
        ctx.fillStyle = getComputedStyle(canvas).getPropertyValue('--text-tertiary') || '#666';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'right';
        ctx.fillText(fmtNum(maxAbs), pad.left - 5, pad.top + 10);
        ctx.fillText('0', pad.left - 5, midY + 3);
        ctx.fillText(fmtNum(-maxAbs), pad.left - 5, h - pad.bottom);

        // Draw managed money net as bars
        const barW = Math.max(1, chartW / data.length - 1);
        data.forEach((_, i) => {
            const x = pad.left + (i / data.length) * chartW;
            const val = mmNets[i];
            const barH = (Math.abs(val) / maxAbs) * (chartH / 2);
            ctx.fillStyle = val >= 0 ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)';
            if (val >= 0) {
                ctx.fillRect(x, midY - barH, barW, barH);
            } else {
                ctx.fillRect(x, midY, barW, barH);
            }
        });

        // Draw producer net as line
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        data.forEach((_, i) => {
            const x = pad.left + (i / data.length) * chartW + barW / 2;
            const y = midY - (prodNets[i] / maxAbs) * (chartH / 2);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // X-axis dates
        ctx.fillStyle = getComputedStyle(canvas).getPropertyValue('--text-tertiary') || '#666';
        ctx.font = '9px system-ui';
        ctx.textAlign = 'center';
        const step = Math.max(1, Math.floor(data.length / 6));
        for (let i = 0; i < data.length; i += step) {
            const x = pad.left + (i / data.length) * chartW;
            const d = new Date(data[i].date);
            ctx.fillText(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), x, h - 5);
        }
    }, [records]);

    return (
        <div style={{ position: 'relative' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height }} />
            <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                <span><span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(34,197,94,0.6)', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} /> Managed Money Net (bars)</span>
                <span><span style={{ display: 'inline-block', width: 12, height: 3, background: '#f59e0b', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} /> Commercial Net (line)</span>
            </div>
        </div>
    );
}

// ── Stacked Category Breakdown Bar ───────────────────────────
function CategoryBreakdown({ record }: { record: COTRecord }) {
    const categories = [
        { label: 'Producer/Merchant', long: record.prodLong, short: record.prodShort, color: '#f59e0b' },
        { label: 'Swap Dealers', long: record.swapLong, short: record.swapShort, color: '#8b5cf6' },
        { label: 'Managed Money', long: record.mmLong, short: record.mmShort, color: '#22c55e' },
        { label: 'Other Reportable', long: record.otherLong, short: record.otherShort, color: '#3b82f6' },
        { label: 'Non-Reportable', long: record.nonreptLong, short: record.nonreptShort, color: '#6b7280' },
    ];

    const maxVal = Math.max(...categories.flatMap(c => [c.long, c.short]));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {categories.map(cat => (
                <div key={cat.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 2 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, display: 'inline-block' }} />
                            {cat.label}
                        </span>
                        <span>Net: <strong style={{ color: (cat.long - cat.short) >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtNum(cat.long - cat.short)}</strong></span>
                    </div>
                    <div style={{ display: 'flex', gap: 2, height: 16 }}>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                            <div style={{
                                width: `${(cat.short / maxVal) * 100}%`,
                                background: `${cat.color}44`,
                                borderRadius: '4px 0 0 4px',
                                border: `1px solid ${cat.color}66`,
                                minWidth: cat.short > 0 ? 2 : 0,
                            }} />
                        </div>
                        <div style={{ width: 1, background: 'var(--border-secondary)' }} />
                        <div style={{ flex: 1 }}>
                            <div style={{
                                width: `${(cat.long / maxVal) * 100}%`,
                                background: `${cat.color}88`,
                                borderRadius: '0 4px 4px 0',
                                border: `1px solid ${cat.color}aa`,
                                minWidth: cat.long > 0 ? 2 : 0,
                            }} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                        <span>{fmtNum(cat.short)} short</span>
                        <span>{fmtNum(cat.long)} long</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── OI Analysis Badge ────────────────────────────────────────
function OIBadge({ record, prevRecord }: { record: COTRecord; prevRecord?: COTRecord }) {
    const oiChange = record.changeOI;
    // We don't have price from COT data, use MM net as proxy (price and MM net are correlated)
    const mmNetChange = record.changeMMNet;
    const priceProxy = mmNetChange; // net long increasing → price likely up

    let label: string, signal: string, emoji: string, description: string;
    if (priceProxy > 0 && oiChange > 0) { label = 'New Longs'; signal = 'bullish'; emoji = '🟢'; description = 'Fresh buying interest — strong bullish'; }
    else if (priceProxy > 0 && oiChange < 0) { label = 'Short Covering'; signal = 'weakly bullish'; emoji = '🟡'; description = 'Shorts exiting — weakly bullish'; }
    else if (priceProxy < 0 && oiChange > 0) { label = 'New Shorts'; signal = 'bearish'; emoji = '🔴'; description = 'Fresh selling pressure — bearish'; }
    else if (priceProxy < 0 && oiChange < 0) { label = 'Long Liquidation'; signal = 'weakly bearish'; emoji = '🟠'; description = 'Longs exiting — weakly bearish'; }
    else { label = 'Neutral'; signal = 'neutral'; emoji = '⚪'; description = 'No significant change'; }

    return (
        <div style={{
            padding: 'var(--space-3)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
        }}>
            <div style={{ fontSize: '2rem' }}>{emoji}</div>
            <div style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{label}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{description}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>
                OI Δ: <strong style={{ color: oiChange >= 0 ? 'var(--green)' : 'var(--red)' }}>{oiChange >= 0 ? '+' : ''}{fmtNum(oiChange)}</strong>
            </div>
        </div>
    );
}

// ── Summary Table (Multi-Commodity) ──────────────────────────
function COTSummaryTable({ onSelect }: { onSelect: (key: string) => void }) {
    const [data, setData] = useState<COTSummaryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sortBy, setSortBy] = useState<'cotIndex' | 'mmNet' | 'mmNetChange' | 'openInterest'>('cotIndex');

    useEffect(() => {
        setLoading(true);
        fetch('/api/data/cot?endpoint=summary')
            .then(r => r.json())
            .then(d => { if (d.commodities) setData(d.commodities); else setError(d.error || 'No data'); })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    const sorted = useMemo(() => {
        return [...data].sort((a, b) => {
            if (sortBy === 'cotIndex') {
                const aExt = Math.abs((a.cotIndex ?? 50) - 50);
                const bExt = Math.abs((b.cotIndex ?? 50) - 50);
                return bExt - aExt;
            }
            if (sortBy === 'mmNet') return Math.abs(b.mmNet) - Math.abs(a.mmNet);
            if (sortBy === 'mmNetChange') return Math.abs(b.mmNetChange) - Math.abs(a.mmNetChange);
            return b.openInterest - a.openInterest;
        });
    }, [data, sortBy]);

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-8)' }}>
            <div className="loading-spinner" style={{ width: 32, height: 32, border: '3px solid var(--border-primary)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Loading COT data for 13 commodities...</p>
        </div>
    );
    if (error) return <div style={{ padding: 'var(--space-4)', color: 'var(--red)' }}>Error: {error}</div>;

    return (
        <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                {(['cotIndex', 'mmNet', 'mmNetChange', 'openInterest'] as const).map(key => (
                    <button key={key} onClick={() => setSortBy(key)} style={{
                        padding: '4px 12px', fontSize: 'var(--text-xs)', borderRadius: 'var(--radius-md)',
                        border: `1px solid ${sortBy === key ? 'var(--accent)' : 'var(--border-primary)'}`,
                        background: sortBy === key ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: sortBy === key ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                    }}>
                        {key === 'cotIndex' ? 'COT Index' : key === 'mmNet' ? 'MM Net' : key === 'mmNetChange' ? 'Weekly Δ' : 'Open Interest'}
                    </button>
                ))}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-primary)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-xs)' }}>Commodity</th>
                        <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-xs)' }}>COT Index</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-xs)' }}>MM Net</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-xs)' }}>Wk Δ</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-xs)' }}>OI</th>
                        <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-xs)' }}>Signal</th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map(row => {
                        const cotColor = row.cotIndex !== null ? (
                            row.cotIndex >= 80 ? '#16a34a' :
                                row.cotIndex >= 60 ? '#22c55e' :
                                    row.cotIndex >= 40 ? '#a3a3a3' :
                                        row.cotIndex >= 20 ? '#f97316' :
                                            '#ef4444'
                        ) : '#666';
                        const opt = COMMODITY_OPTIONS.find(o => o.key === row.commodityKey);
                        return (
                            <tr key={row.commodityKey}
                                onClick={() => onSelect(row.commodityKey)}
                                style={{ borderBottom: '1px solid var(--border-primary)', cursor: 'pointer', transition: 'background 0.15s' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <td style={{ padding: '10px 6px', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                                    {opt?.icon || '📊'} {row.commodity}
                                    {row.divergence && <span title="Commercial/Speculator divergence" style={{ marginLeft: 6, fontSize: 'var(--text-xs)', color: '#f59e0b' }}>⚠️</span>}
                                </td>
                                <td style={{ textAlign: 'center', padding: '10px 6px' }}>
                                    <span style={{
                                        display: 'inline-block', padding: '2px 10px', borderRadius: 'var(--radius-full)',
                                        background: `${cotColor}22`, color: cotColor, fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-xs)',
                                        minWidth: 40,
                                    }}>
                                        {row.cotIndex ?? '—'}
                                    </span>
                                </td>
                                <td style={{ textAlign: 'right', padding: '10px 6px', color: row.mmNet >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 'var(--weight-medium)' }}>
                                    {fmtNum(row.mmNet)}
                                </td>
                                <td style={{ textAlign: 'right', padding: '10px 6px', color: row.mmNetChange >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 'var(--text-xs)' }}>
                                    {row.mmNetChange >= 0 ? '+' : ''}{fmtNum(row.mmNetChange)}
                                </td>
                                <td style={{ textAlign: 'right', padding: '10px 6px', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
                                    {fmtNum(row.openInterest)}
                                    <span style={{ marginLeft: 4, color: row.oiChange >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                        ({row.oiChange >= 0 ? '+' : ''}{fmtNum(row.oiChange)})
                                    </span>
                                </td>
                                <td style={{ textAlign: 'center', padding: '10px 6px', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                    {row.cotIndexLabel}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ── Single Commodity Deep Dive ───────────────────────────────
function CommodityDeepDive({ commodityKey }: { commodityKey: string }) {
    const [data, setData] = useState<SingleCOTData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true);
        setError('');
        fetch(`/api/data/cot?endpoint=single&commodity=${commodityKey}&weeks=52`)
            .then(r => r.json())
            .then(d => { if (d.records) setData(d as SingleCOTData); else setError(d.error || 'No data'); })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [commodityKey]);

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-8)' }}>
            <div className="loading-spinner" style={{ width: 32, height: 32, border: '3px solid var(--border-primary)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Loading 52-week COT data...</p>
        </div>
    );
    if (error) return <div style={{ padding: 'var(--space-4)', color: 'var(--red)' }}>Error: {error}</div>;
    if (!data) return null;

    const opt = COMMODITY_OPTIONS.find(o => o.key === commodityKey);
    const latest = data.latest;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <div>
                    <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', margin: 0 }}>
                        {opt?.icon} {data.contractName}
                    </h3>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
                        {data.exchange} • As of {fmtDate(data.latestDate)} • {data.totalWeeks} weeks of data
                    </p>
                </div>
                {data.divergence.isDiverging && (
                    <div style={{
                        padding: '6px 14px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
                        borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-xs)', color: '#f59e0b', fontWeight: 'var(--weight-semibold)',
                    }}>
                        ⚠️ Commercial/Speculator Divergence
                    </div>
                )}
            </div>

            {/* Signal Cards Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
                {/* COT Index Gauge */}
                <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: 4 }}>COT Index (52W Percentile)</div>
                    <COTGauge value={data.cotIndex} size={140} />
                    <div style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 'var(--weight-medium)' }}>{data.cotIndexLabel}</div>
                </div>

                {/* OI Classification */}
                <OIBadge record={latest} />

                {/* Key Stats */}
                <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 8 }}>Key Metrics</div>
                    {[
                        { label: 'Open Interest', value: fmtNum(latest.openInterest), change: latest.changeOI },
                        { label: 'MM Net', value: fmtNum(latest.mmNet), change: latest.changeMMNet },
                        { label: 'Commercial Net', value: fmtNum(latest.prodNet), change: latest.changeProdNet },
                        { label: 'MM % of OI (L/S)', value: `${latest.pctMMLong}% / ${latest.pctMMShort}%` },
                    ].map(stat => (
                        <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 'var(--text-xs)' }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>{stat.label}</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 'var(--weight-medium)' }}>
                                {stat.value}
                                {stat.change !== undefined && (
                                    <span style={{ marginLeft: 4, color: stat.change >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                        ({stat.change >= 0 ? '+' : ''}{fmtNum(stat.change)})
                                    </span>
                                )}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Net Positioning Chart */}
            <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', marginBottom: 8 }}>
                    Net Positioning — Managed Money vs Commercials (52W)
                </div>
                <NetPositionChart records={data.records} height={220} />
            </div>

            {/* Category Breakdown */}
            <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', marginBottom: 12 }}>
                    Trader Category Breakdown — {fmtDate(latest.date)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: 8, padding: '0 4px' }}>
                    <span>← SHORT</span>
                    <span>LONG →</span>
                </div>
                <CategoryBreakdown record={latest} />
            </div>

            {/* Weekly Changes Table */}
            <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', marginBottom: 8 }}>
                    Recent Weekly Data
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                <th style={{ textAlign: 'left', padding: 6, color: 'var(--text-tertiary)' }}>Date</th>
                                <th style={{ textAlign: 'right', padding: 6, color: 'var(--text-tertiary)' }}>OI</th>
                                <th style={{ textAlign: 'right', padding: 6, color: 'var(--text-tertiary)' }}>MM Long</th>
                                <th style={{ textAlign: 'right', padding: 6, color: 'var(--text-tertiary)' }}>MM Short</th>
                                <th style={{ textAlign: 'right', padding: 6, color: 'var(--text-tertiary)' }}>MM Net</th>
                                <th style={{ textAlign: 'right', padding: 6, color: 'var(--text-tertiary)' }}>Prod Net</th>
                                <th style={{ textAlign: 'right', padding: 6, color: 'var(--text-tertiary)' }}>Δ OI</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.records.slice(0, 12).map((r, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-primary)', opacity: i === 0 ? 1 : 0.8 }}>
                                    <td style={{ padding: 6, color: 'var(--text-primary)', fontWeight: i === 0 ? 'var(--weight-semibold)' : 'normal' }}>{fmtDate(r.date)}</td>
                                    <td style={{ textAlign: 'right', padding: 6, color: 'var(--text-secondary)' }}>{fmtNum(r.openInterest)}</td>
                                    <td style={{ textAlign: 'right', padding: 6, color: 'var(--text-secondary)' }}>{fmtNum(r.mmLong)}</td>
                                    <td style={{ textAlign: 'right', padding: 6, color: 'var(--text-secondary)' }}>{fmtNum(r.mmShort)}</td>
                                    <td style={{ textAlign: 'right', padding: 6, color: r.mmNet >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 'var(--weight-medium)' }}>{fmtNum(r.mmNet)}</td>
                                    <td style={{ textAlign: 'right', padding: 6, color: r.prodNet >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtNum(r.prodNet)}</td>
                                    <td style={{ textAlign: 'right', padding: 6, color: r.changeOI >= 0 ? 'var(--green)' : 'var(--red)' }}>{r.changeOI >= 0 ? '+' : ''}{fmtNum(r.changeOI)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────
export default function COTFIIDIIPage() {
    const [activeTab, setActiveTab] = useState<'overview' | 'detail'>('overview');
    const [selectedCommodity, setSelectedCommodity] = useState('gold');

    const handleSelect = (key: string) => {
        setSelectedCommodity(key);
        setActiveTab('detail');
    };

    const tabs = [
        { key: 'overview', label: '📊 Multi-Commodity Overview' },
        { key: 'detail', label: '🔍 Deep Dive' },
    ];

    return (
        <AppShell title="COT Positioning" subtitle="Commitment of Traders — CFTC Disaggregated Analysis">
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 'var(--space-2)', overflowX: 'auto' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        style={{
                            padding: '8px 16px', fontSize: 'var(--text-sm)', borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                            border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                            background: activeTab === tab.key ? 'var(--accent)' : 'transparent',
                            color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
                            fontWeight: activeTab === tab.key ? 'var(--weight-semibold)' : 'var(--weight-normal)',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}

                {activeTab === 'detail' && (
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <select
                            value={selectedCommodity}
                            onChange={e => setSelectedCommodity(e.target.value)}
                            style={{
                                padding: '6px 12px', fontSize: 'var(--text-xs)', borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                            }}
                        >
                            {COMMODITY_OPTIONS.map(opt => (
                                <option key={opt.key} value={opt.key}>{opt.icon} {opt.label}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Content */}
            {activeTab === 'overview' && <COTSummaryTable onSelect={handleSelect} />}
            {activeTab === 'detail' && <CommodityDeepDive commodityKey={selectedCommodity} />}

            {/* Footer */}
            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    🟢 <strong>CFTC COT Live Data</strong> — Disaggregated Futures Only report from the Commodity Futures Trading Commission.
                    Updated weekly (Tuesday data, released Friday). COT Index = current managed money net as percentile of 52-week range.
                    Extreme readings (0–20 or 80–100) historically precede major trend reversals.
                    {' '}⚠️ = Commercial/Speculator divergence (highest-conviction contrarian signal).
                </div>
            </div>
        </AppShell>
    );
}
