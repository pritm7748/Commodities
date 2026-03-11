'use client';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// ── Types ────────────────────────────────────────────────────
interface OHLCVPoint { date: string; close: number; }

// ── Commodities to track ─────────────────────────────────────
const CORRELATION_COMMODITIES = [
    { id: 'gold', name: 'Gold', yahoo: 'GC=F', icon: '🥇', sector: 'precious' },
    { id: 'silver', name: 'Silver', yahoo: 'SI=F', icon: '🥈', sector: 'precious' },
    { id: 'copper', name: 'Copper', yahoo: 'HG=F', icon: '🔩', sector: 'base' },
    { id: 'platinum', name: 'Platinum', yahoo: 'PL=F', icon: '✨', sector: 'precious' },
    { id: 'crude', name: 'Crude Oil', yahoo: 'CL=F', icon: '🛢️', sector: 'energy' },
    { id: 'brent', name: 'Brent', yahoo: 'BZ=F', icon: '🛢️', sector: 'energy' },
    { id: 'natgas', name: 'Nat Gas', yahoo: 'NG=F', icon: '🔥', sector: 'energy' },
    { id: 'wheat', name: 'Wheat', yahoo: 'ZW=F', icon: '🌾', sector: 'agri' },
    { id: 'corn', name: 'Corn', yahoo: 'ZC=F', icon: '🌽', sector: 'agri' },
    { id: 'soybeans', name: 'Soybeans', yahoo: 'ZS=F', icon: '🫘', sector: 'agri' },
    { id: 'cotton', name: 'Cotton', yahoo: 'CT=F', icon: '🧶', sector: 'softs' },
    { id: 'sugar', name: 'Sugar', yahoo: 'SB=F', icon: '🍬', sector: 'softs' },
    { id: 'coffee', name: 'Coffee', yahoo: 'KC=F', icon: '☕', sector: 'softs' },
];

// Macro overlays
const MACRO_TICKERS = [
    { id: 'dxy', name: 'DXY', yahoo: 'DX-Y.NYB', icon: '💵' },
    { id: 'vix', name: 'VIX', yahoo: '^VIX', icon: '📈' },
];

const LOOKBACKS = [
    { key: '30', label: '30D', days: 30 },
    { key: '60', label: '60D', days: 60 },
    { key: '90', label: '90D', days: 90 },
    { key: '180', label: '180D', days: 180 },
];

// ── Math Utilities ───────────────────────────────────────────
function computeDailyReturns(closes: number[]): number[] {
    const r: number[] = [];
    for (let i = 1; i < closes.length; i++) {
        if (closes[i - 1] > 0) r.push((closes[i] - closes[i - 1]) / closes[i - 1]);
        else r.push(0);
    }
    return r;
}

function pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 5) return 0;
    const a = x.slice(-n);
    const b = y.slice(-n);
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += a[i]; sumY += b[i]; sumXY += a[i] * b[i]; sumX2 += a[i] * a[i]; sumY2 += b[i] * b[i];
    }
    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    return den > 0 ? num / den : 0;
}

function crossCorrelation(x: number[], y: number[], maxLag: number): { lag: number; corr: number }[] {
    const results: { lag: number; corr: number }[] = [];
    for (let lag = -maxLag; lag <= maxLag; lag++) {
        const xSlice = lag >= 0 ? x.slice(lag) : x.slice(0, x.length + lag);
        const ySlice = lag >= 0 ? y.slice(0, y.length - lag) : y.slice(-lag);
        const n = Math.min(xSlice.length, ySlice.length);
        if (n < 5) { results.push({ lag, corr: 0 }); continue; }
        results.push({ lag, corr: pearsonCorrelation(xSlice.slice(0, n), ySlice.slice(0, n)) });
    }
    return results;
}

// Simple PCA via power iteration (2 components)
function simplePCA(returnsMatrix: number[][], numComponents = 3): { eigenvalues: number[]; eigenvectors: number[][]; variance: number[] } {
    const n = returnsMatrix.length; // number of assets
    const t = returnsMatrix[0]?.length || 0;
    if (t < 10 || n < 3) return { eigenvalues: [], eigenvectors: [], variance: [] };

    // Compute correlation matrix
    const corrMatrix: number[][] = [];
    for (let i = 0; i < n; i++) {
        corrMatrix[i] = [];
        for (let j = 0; j < n; j++) {
            corrMatrix[i][j] = pearsonCorrelation(returnsMatrix[i], returnsMatrix[j]);
        }
    }

    const eigenvalues: number[] = [];
    const eigenvectors: number[][] = [];
    let matrix = corrMatrix.map(row => [...row]);

    for (let comp = 0; comp < numComponents; comp++) {
        // Power iteration
        let v = Array(n).fill(0).map(() => Math.random());
        let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
        v = v.map(x => x / norm);

        for (let iter = 0; iter < 100; iter++) {
            const newV = Array(n).fill(0);
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    newV[i] += matrix[i][j] * v[j];
                }
            }
            norm = Math.sqrt(newV.reduce((s, x) => s + x * x, 0));
            if (norm < 1e-10) break;
            v = newV.map(x => x / norm);
        }

        // Eigenvalue = Rayleigh quotient
        let eigenvalue = 0;
        const mv = Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) mv[i] += matrix[i][j] * v[j];
            eigenvalue += v[i] * mv[i];
        }

        eigenvalues.push(eigenvalue);
        eigenvectors.push(v);

        // Deflate matrix
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                matrix[i][j] -= eigenvalue * v[i] * v[j];
            }
        }
    }

    const totalVar = eigenvalues.reduce((s, v) => s + Math.abs(v), 0) || 1;
    const variance = eigenvalues.map(e => (Math.abs(e) / (totalVar > 0 ? totalVar : 1)) * 100);

    return { eigenvalues, eigenvectors, variance };
}

// ── Heatmap Cell Color ───────────────────────────────────────
function corrToColor(corr: number): string {
    if (corr >= 0) {
        const intensity = Math.min(1, corr);
        return `rgba(34, 197, 94, ${intensity * 0.7 + 0.05})`;
    } else {
        const intensity = Math.min(1, -corr);
        return `rgba(239, 68, 68, ${intensity * 0.7 + 0.05})`;
    }
}

// ── Main Page ────────────────────────────────────────────────
export default function CorrelationsPage() {
    const [returnsMap, setReturnsMap] = useState<Record<string, number[]>>({});
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [lookback, setLookback] = useState('90');
    const [activeTab, setActiveTab] = useState<'heatmap' | 'breakdowns' | 'leadlag' | 'pca' | 'macro'>('heatmap');
    const [hoveredCell, setHoveredCell] = useState<{ i: number; j: number } | null>(null);
    const [fullReturnsMap, setFullReturnsMap] = useState<Record<string, number[]>>({});

    // Fetch all data
    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            const allData: Record<string, number[]> = {};
            const allItems = [...CORRELATION_COMMODITIES, ...MACRO_TICKERS];

            for (let i = 0; i < allItems.length; i++) {
                const item = allItems[i];
                setProgress(Math.round(((i + 1) / allItems.length) * 100));
                try {
                    const res = await fetch(`/api/prices/yahoo?symbols=${encodeURIComponent(item.yahoo)}&range=1y&interval=1d`);
                    const data = await res.json();
                    if (data.chart?.result?.[0]) {
                        const r = data.chart.result[0];
                        const q = r.indicators?.quote?.[0] || {};
                        const closes = (q.close || []).filter((c: any) => c !== null && c > 0);
                        if (closes.length > 30) {
                            allData[item.id] = computeDailyReturns(closes);
                        }
                    }
                } catch (e) {
                    console.warn(`Failed to fetch ${item.name}`);
                }
            }

            setFullReturnsMap(allData);
            setLoading(false);
        };
        fetchAll();
    }, []);

    // Slice returns for lookback
    useEffect(() => {
        const lb = LOOKBACKS.find(l => l.key === lookback)?.days || 90;
        const sliced: Record<string, number[]> = {};
        for (const [id, returns] of Object.entries(fullReturnsMap)) {
            sliced[id] = returns.slice(-lb);
        }
        setReturnsMap(sliced);
    }, [fullReturnsMap, lookback]);

    // Compute correlation matrix
    const corrMatrix = useMemo(() => {
        const n = CORRELATION_COMMODITIES.length;
        const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const ri = returnsMap[CORRELATION_COMMODITIES[i].id];
                const rj = returnsMap[CORRELATION_COMMODITIES[j].id];
                if (ri && rj) {
                    matrix[i][j] = i === j ? 1 : pearsonCorrelation(ri, rj);
                }
            }
        }
        return matrix;
    }, [returnsMap]);

    // Top/bottom correlations
    const topCorrelations = useMemo(() => {
        const pairs: { a: string; b: string; corr: number }[] = [];
        const n = CORRELATION_COMMODITIES.length;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                pairs.push({
                    a: CORRELATION_COMMODITIES[i].name,
                    b: CORRELATION_COMMODITIES[j].name,
                    corr: corrMatrix[i][j],
                });
            }
        }
        pairs.sort((a, b) => b.corr - a.corr);
        return { top5: pairs.slice(0, 5), bottom5: pairs.slice(-5).reverse() };
    }, [corrMatrix]);

    // Correlation breakdowns (30D vs 180D)
    const breakdowns = useMemo(() => {
        if (Object.keys(fullReturnsMap).length === 0) return [];
        const pairs: { a: string; b: string; corr30: number; corr180: number; delta: number }[] = [];
        const n = CORRELATION_COMMODITIES.length;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const ri = fullReturnsMap[CORRELATION_COMMODITIES[i].id];
                const rj = fullReturnsMap[CORRELATION_COMMODITIES[j].id];
                if (!ri || !rj) continue;
                const c30 = pearsonCorrelation(ri.slice(-30), rj.slice(-30));
                const c180 = pearsonCorrelation(ri.slice(-180), rj.slice(-180));
                pairs.push({
                    a: CORRELATION_COMMODITIES[i].name,
                    b: CORRELATION_COMMODITIES[j].name,
                    corr30: c30,
                    corr180: c180,
                    delta: c30 - c180,
                });
            }
        }
        pairs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
        return pairs.slice(0, 10);
    }, [fullReturnsMap]);

    // PCA
    const pcaResult = useMemo(() => {
        const matrix = CORRELATION_COMMODITIES.map(c => returnsMap[c.id] || []).filter(r => r.length > 10);
        if (matrix.length < 5) return null;
        // Align lengths
        const minLen = Math.min(...matrix.map(r => r.length));
        const aligned = matrix.map(r => r.slice(-minLen));
        return simplePCA(aligned, 3);
    }, [returnsMap]);

    // Macro correlations
    const macroCorrs = useMemo(() => {
        const results: { commodity: string; icon: string; dxy: number; vix: number }[] = [];
        for (const comm of CORRELATION_COMMODITIES) {
            const rc = returnsMap[comm.id];
            const rdxy = returnsMap['dxy'];
            const rvix = returnsMap['vix'];
            if (!rc) continue;
            results.push({
                commodity: comm.name,
                icon: comm.icon,
                dxy: rdxy ? pearsonCorrelation(rc, rdxy) : 0,
                vix: rvix ? pearsonCorrelation(rc, rvix) : 0,
            });
        }
        return results;
    }, [returnsMap]);

    const tabs = [
        { key: 'heatmap', label: '🔥 Heatmap' },
        { key: 'breakdowns', label: '📉 Breakdowns' },
        { key: 'leadlag', label: '⏱️ Lead-Lag' },
        { key: 'pca', label: '🧬 PCA' },
        { key: 'macro', label: '💵 Macro' },
    ];

    return (
        <AppShell title="Correlation Matrix" subtitle="Rolling Pearson Correlations, PCA & Lead-Lag Analysis">
            {/* Lookback selector */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginRight: 8 }}>Lookback:</span>
                {LOOKBACKS.map(lb => (
                    <button key={lb.key} onClick={() => setLookback(lb.key)} style={{
                        padding: '4px 12px', fontSize: 'var(--text-xs)', borderRadius: 'var(--radius-md)',
                        border: `1px solid ${lookback === lb.key ? 'var(--accent)' : 'var(--border-primary)'}`,
                        background: lookback === lb.key ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: lookback === lb.key ? '#fff' : 'var(--text-secondary)', cursor: 'pointer',
                    }}>
                        {lb.label}
                    </button>
                ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 'var(--space-2)', overflowX: 'auto' }}>
                {tabs.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} style={{
                        padding: '8px 16px', fontSize: 'var(--text-sm)', borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                        border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                        background: activeTab === tab.key ? 'var(--accent)' : 'transparent',
                        color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
                        fontWeight: activeTab === tab.key ? 'var(--weight-semibold)' : 'var(--weight-normal)',
                    }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Loading */}
            {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-8)' }}>
                    <div style={{ width: 200, height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Fetching price data... {progress}%</p>
                </div>
            )}

            {/* ── Heatmap Tab ─────────────────────────────── */}
            {!loading && activeTab === 'heatmap' && (
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 500px', overflowX: 'auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: `40px repeat(${CORRELATION_COMMODITIES.length}, 1fr)`, gap: 1, fontSize: '10px' }}>
                            {/* Header row */}
                            <div />
                            {CORRELATION_COMMODITIES.map(c => (
                                <div key={c.id} style={{ textAlign: 'center', padding: 2, color: 'var(--text-tertiary)', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {c.icon}
                                </div>
                            ))}
                            {/* Data rows */}
                            {CORRELATION_COMMODITIES.map((rowC, i) => (
                                <React.Fragment key={rowC.id}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 4px', color: 'var(--text-tertiary)', fontSize: '9px', whiteSpace: 'nowrap' }}>
                                        {rowC.icon}
                                    </div>
                                    {CORRELATION_COMMODITIES.map((colC, j) => {
                                        const corr = corrMatrix[i][j];
                                        const isHovered = hoveredCell?.i === i && hoveredCell?.j === j;
                                        return (
                                            <div
                                                key={colC.id}
                                                onMouseEnter={() => setHoveredCell({ i, j })}
                                                onMouseLeave={() => setHoveredCell(null)}
                                                style={{
                                                    background: i === j ? 'var(--bg-tertiary)' : corrToColor(corr),
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    padding: 3, minHeight: 28, minWidth: 28,
                                                    borderRadius: 2, cursor: 'pointer',
                                                    border: isHovered ? '2px solid var(--accent)' : '2px solid transparent',
                                                    fontWeight: isHovered ? 'bold' : 'normal',
                                                    color: i === j ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                                    fontSize: '9px',
                                                    transition: 'all 0.1s',
                                                }}
                                                title={`${rowC.name} × ${colC.name}: ${corr.toFixed(3)}`}
                                            >
                                                {i === j ? '—' : corr.toFixed(2)}
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    {/* Side panel — Top/Bottom pairs */}
                    <div style={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
                            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--green)', marginBottom: 8 }}>🟢 Most Correlated</div>
                            {topCorrelations.top5.map((p, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', padding: '3px 0', color: 'var(--text-secondary)' }}>
                                    <span>{p.a}/{p.b}</span>
                                    <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--green)' }}>{p.corr.toFixed(3)}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
                            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--red)', marginBottom: 8 }}>🔴 Most Inversely Correlated</div>
                            {topCorrelations.bottom5.map((p, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', padding: '3px 0', color: 'var(--text-secondary)' }}>
                                    <span>{p.a}/{p.b}</span>
                                    <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--red)' }}>{p.corr.toFixed(3)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Breakdowns Tab ──────────────────────────── */}
            {!loading && activeTab === 'breakdowns' && (
                <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', marginBottom: 12 }}>
                        Correlation Regime Shifts — 30D vs 180D (top 10 by magnitude)
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                <th style={{ textAlign: 'left', padding: 6, color: 'var(--text-tertiary)' }}>Pair</th>
                                <th style={{ textAlign: 'center', padding: 6, color: 'var(--text-tertiary)' }}>30D Corr</th>
                                <th style={{ textAlign: 'center', padding: 6, color: 'var(--text-tertiary)' }}>180D Corr</th>
                                <th style={{ textAlign: 'center', padding: 6, color: 'var(--text-tertiary)' }}>Δ</th>
                                <th style={{ textAlign: 'center', padding: 6, color: 'var(--text-tertiary)' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {breakdowns.map((b, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                    <td style={{ padding: 6, color: 'var(--text-primary)', fontWeight: 'var(--weight-medium)' }}>{b.a} / {b.b}</td>
                                    <td style={{ textAlign: 'center', padding: 6, color: b.corr30 >= 0 ? 'var(--green)' : 'var(--red)' }}>{b.corr30.toFixed(3)}</td>
                                    <td style={{ textAlign: 'center', padding: 6, color: b.corr180 >= 0 ? 'var(--green)' : 'var(--red)' }}>{b.corr180.toFixed(3)}</td>
                                    <td style={{ textAlign: 'center', padding: 6, fontWeight: 'var(--weight-semibold)', color: b.delta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                        {b.delta >= 0 ? '+' : ''}{b.delta.toFixed(3)}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: 6 }}>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '10px',
                                            background: Math.abs(b.delta) > 0.3 ? 'rgba(239,68,68,0.15)' : 'rgba(163,163,163,0.15)',
                                            color: Math.abs(b.delta) > 0.3 ? '#ef4444' : '#a3a3a3',
                                            fontWeight: 'var(--weight-semibold)',
                                        }}>
                                            {Math.abs(b.delta) > 0.3 ? '⚠️ Regime Shift' : b.delta > 0.15 ? 'Strengthening' : b.delta < -0.15 ? 'Weakening' : 'Stable'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Lead-Lag Tab ────────────────────────────── */}
            {!loading && activeTab === 'leadlag' && <LeadLagPanel returnsMap={returnsMap} />}

            {/* ── PCA Tab ─────────────────────────────────── */}
            {!loading && activeTab === 'pca' && pcaResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* Variance explained */}
                    <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', marginBottom: 12 }}>
                            Principal Components — Variance Explained
                        </div>
                        {pcaResult.variance.map((v, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', width: 30 }}>PC{i + 1}</span>
                                <div style={{ flex: 1, height: 16, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${v}%`, height: '100%',
                                        background: i === 0 ? '#3b82f6' : i === 1 ? '#8b5cf6' : '#22c55e',
                                        borderRadius: 'var(--radius-md)', transition: 'width 0.5s',
                                    }} />
                                </div>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', minWidth: 45, textAlign: 'right' }}>
                                    {v.toFixed(1)}%
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Factor loadings */}
                    <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', marginBottom: 12 }}>
                            Factor Loadings
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                    <th style={{ textAlign: 'left', padding: 6, color: 'var(--text-tertiary)' }}>Commodity</th>
                                    <th style={{ textAlign: 'center', padding: 6, color: '#3b82f6' }}>PC1</th>
                                    <th style={{ textAlign: 'center', padding: 6, color: '#8b5cf6' }}>PC2</th>
                                    <th style={{ textAlign: 'center', padding: 6, color: '#22c55e' }}>PC3</th>
                                </tr>
                            </thead>
                            <tbody>
                                {CORRELATION_COMMODITIES.map((c, i) => {
                                    if (i >= (pcaResult.eigenvectors[0]?.length || 0)) return null;
                                    return (
                                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                            <td style={{ padding: 6, color: 'var(--text-primary)' }}>{c.icon} {c.name}</td>
                                            {pcaResult.eigenvectors.map((ev, j) => (
                                                <td key={j} style={{
                                                    textAlign: 'center', padding: 6,
                                                    fontWeight: Math.abs(ev[i]) > 0.3 ? 'var(--weight-semibold)' : 'normal',
                                                    color: Math.abs(ev[i]) > 0.3 ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                                    background: Math.abs(ev[i]) > 0.3 ? (ev[i] > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)') : 'transparent',
                                                }}>
                                                    {ev[i]?.toFixed(3) || '—'}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div style={{ marginTop: 12, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                            💡 PC1 typically represents <strong>global risk appetite</strong> (broad commodity co-movement).
                            PC2 often captures <strong>energy vs agriculture</strong> divergence.
                            PC3 may reflect <strong>precious vs industrial</strong> metal dynamics.
                        </div>
                    </div>
                </div>
            )}

            {/* ── Macro Tab ───────────────────────────────── */}
            {!loading && activeTab === 'macro' && (
                <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', marginBottom: 12 }}>
                        Macro Sensitivity — Correlation with DXY & VIX ({LOOKBACKS.find(l => l.key === lookback)?.label} window)
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                <th style={{ textAlign: 'left', padding: 8, color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>Commodity</th>
                                <th style={{ textAlign: 'center', padding: 8, color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>💵 DXY Correlation</th>
                                <th style={{ textAlign: 'center', padding: 8, color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>📈 VIX Correlation</th>
                                <th style={{ textAlign: 'center', padding: 8, color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>Interpretation</th>
                            </tr>
                        </thead>
                        <tbody>
                            {macroCorrs.map((m, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                    <td style={{ padding: 8, fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>{m.icon} {m.commodity}</td>
                                    <td style={{ textAlign: 'center', padding: 8 }}>
                                        <span style={{
                                            padding: '2px 10px', borderRadius: 'var(--radius-full)',
                                            background: corrToColor(m.dxy),
                                            color: 'var(--text-primary)', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-xs)',
                                        }}>
                                            {m.dxy.toFixed(3)}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center', padding: 8 }}>
                                        <span style={{
                                            padding: '2px 10px', borderRadius: 'var(--radius-full)',
                                            background: corrToColor(m.vix),
                                            color: 'var(--text-primary)', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-xs)',
                                        }}>
                                            {m.vix.toFixed(3)}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center', padding: 8, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                        {m.dxy < -0.3 ? 'Dollar-inverse' : m.dxy > 0.3 ? 'Dollar-positive' : ''}
                                        {m.dxy < -0.3 && m.vix > 0.2 ? ', ' : ''}
                                        {m.vix > 0.3 ? 'Risk-off hedge' : m.vix < -0.3 ? 'Risk-on play' : ''}
                                        {Math.abs(m.dxy) <= 0.3 && Math.abs(m.vix) <= 0.3 ? 'Low macro sensitivity' : ''}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    📊 <strong>Correlation Analysis</strong> — Rolling Pearson correlations computed from daily returns (Yahoo Finance).
                    PCA via power iteration on the returns correlation matrix. Lead-lag computed via cross-correlation at ±5 day offsets.
                    Correlation breakdowns compare 30D vs 180D windows to detect regime shifts.
                </div>
            </div>
        </AppShell>
    );
}

// ── Lead-Lag Panel Component ─────────────────────────────────
function LeadLagPanel({ returnsMap }: { returnsMap: Record<string, number[]> }) {
    const [selectedPair, setSelectedPair] = useState<[string, string]>(['gold', 'silver']);
    const pairs = useMemo(() => {
        const results: { a: string; b: string; aName: string; bName: string; bestLag: number; bestCorr: number; label: string }[] = [];
        for (let i = 0; i < CORRELATION_COMMODITIES.length; i++) {
            for (let j = i + 1; j < CORRELATION_COMMODITIES.length; j++) {
                const ci = CORRELATION_COMMODITIES[i];
                const cj = CORRELATION_COMMODITIES[j];
                const ri = returnsMap[ci.id];
                const rj = returnsMap[cj.id];
                if (!ri || !rj) continue;
                const cc = crossCorrelation(ri, rj, 5);
                const best = cc.reduce((m, c) => Math.abs(c.corr) > Math.abs(m.corr) ? c : m, cc[5]); // center
                if (Math.abs(best.lag) > 0 && Math.abs(best.corr) > 0.15) {
                    results.push({
                        a: ci.id, b: cj.id, aName: ci.name, bName: cj.name,
                        bestLag: best.lag, bestCorr: best.corr,
                        label: best.lag > 0 ? `${ci.name} leads ${cj.name} by ${best.lag}d` : `${cj.name} leads ${ci.name} by ${-best.lag}d`,
                    });
                }
            }
        }
        results.sort((a, b) => Math.abs(b.bestCorr) - Math.abs(a.bestCorr));
        return results.slice(0, 10);
    }, [returnsMap]);

    // Compute cross-correlation for selected pair
    const ccData = useMemo(() => {
        const ri = returnsMap[selectedPair[0]];
        const rj = returnsMap[selectedPair[1]];
        if (!ri || !rj) return [];
        return crossCorrelation(ri, rj, 5);
    }, [returnsMap, selectedPair]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Lead-Lag results */}
            <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', marginBottom: 12 }}>
                    Detected Lead-Lag Relationships (±5 day window)
                </div>
                {pairs.length === 0 && <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>No significant lead-lag relationships detected in current window</div>}
                {pairs.map((p, i) => (
                    <div key={i}
                        onClick={() => setSelectedPair([p.a, p.b])}
                        style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 'var(--radius-md)',
                            cursor: 'pointer', marginBottom: 4,
                            background: selectedPair[0] === p.a && selectedPair[1] === p.b ? 'rgba(59,130,246,0.1)' : 'transparent',
                            border: selectedPair[0] === p.a && selectedPair[1] === p.b ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                        }}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{p.label}</span>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: p.bestCorr >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            r={p.bestCorr.toFixed(3)} @ lag={p.bestLag}
                        </span>
                    </div>
                ))}
            </div>

            {/* Cross-correlation bar chart for selected pair */}
            {ccData.length > 0 && (
                <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', marginBottom: 12 }}>
                        Cross-Correlation: {CORRELATION_COMMODITIES.find(c => c.id === selectedPair[0])?.name} ↔ {CORRELATION_COMMODITIES.find(c => c.id === selectedPair[1])?.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, height: 120 }}>
                        {ccData.map((d, i) => {
                            const maxCorr = Math.max(...ccData.map(c => Math.abs(c.corr)));
                            const barH = maxCorr > 0 ? (Math.abs(d.corr) / maxCorr) * 100 : 0;
                            const isBest = Math.abs(d.corr) === Math.max(...ccData.map(c => Math.abs(c.corr)));
                            return (
                                <div key={i} style={{ textAlign: 'center', flex: 1 }}>
                                    <div style={{ height: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                                        <div style={{
                                            width: '100%', maxWidth: 24,
                                            height: `${barH}%`,
                                            background: d.corr >= 0 ? (isBest ? 'var(--green)' : 'rgba(34,197,94,0.4)') : (isBest ? 'var(--red)' : 'rgba(239,68,68,0.4)'),
                                            borderRadius: '4px 4px 0 0',
                                            border: isBest ? '2px solid var(--accent)' : 'none',
                                        }} />
                                    </div>
                                    <div style={{ fontSize: '9px', color: d.lag === 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: d.lag === 0 ? 'bold' : 'normal', marginTop: 2 }}>
                                        {d.lag}d
                                    </div>
                                    <div style={{ fontSize: '8px', color: 'var(--text-tertiary)' }}>{d.corr.toFixed(2)}</div>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 8 }}>
                        ← {CORRELATION_COMMODITIES.find(c => c.id === selectedPair[0])?.name} leads | {CORRELATION_COMMODITIES.find(c => c.id === selectedPair[1])?.name} leads →
                    </div>
                </div>
            )}
        </div>
    );
}
