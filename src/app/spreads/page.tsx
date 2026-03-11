'use client';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import { useState, useEffect, useMemo, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────
interface SpreadDef {
    id: string;
    name: string;
    type: 'ratio' | 'premium' | 'calendar';
    longTicker: string;
    shortTicker: string;
    longName: string;
    shortName: string;
    icon: string;
    description: string;
    historicalMean?: number; // known historical mean for ratio spreads
}

interface SpreadAnalysis {
    spread: SpreadDef;
    ratioSeries: { date: string; value: number }[];
    current: number;
    mean: number;
    std: number;
    zScore: number;
    halfLife: number;
    isCointegrated: boolean;
    adfStat: number;
    signal: 'extreme-wide' | 'wide' | 'neutral' | 'narrow' | 'extreme-narrow';
    signalText: string;
    pctChange1M: number;
}

// ── Spread Definitions ───────────────────────────────────────
const SPREADS: SpreadDef[] = [
    // Inter-Commodity Ratios
    { id: 'gold-silver', name: 'Gold/Silver', type: 'ratio', longTicker: 'GC=F', shortTicker: 'SI=F', longName: 'Gold', shortName: 'Silver', icon: '🥇/🥈', description: 'Historically 75–85; >90 = silver undervalued', historicalMean: 82 },
    { id: 'crude-natgas', name: 'Crude/NatGas', type: 'ratio', longTicker: 'CL=F', shortTicker: 'NG=F', longName: 'Crude Oil', shortName: 'Natural Gas', icon: '🛢️/🔥', description: 'BTU equivalent ~6:1; measures energy substitution', historicalMean: 20 },
    { id: 'corn-wheat', name: 'Corn/Wheat', type: 'ratio', longTicker: 'ZC=F', shortTicker: 'ZW=F', longName: 'Corn', shortName: 'Wheat', icon: '🌽/🌾', description: 'Feed grain substitution dynamics; ~0.75 typical', historicalMean: 0.75 },
    { id: 'gold-platinum', name: 'Gold/Platinum', type: 'ratio', longTicker: 'GC=F', shortTicker: 'PL=F', longName: 'Gold', shortName: 'Platinum', icon: '🥇/✨', description: 'Monetary vs industrial metal sentiment', historicalMean: 1.8 },
    { id: 'copper-gold', name: 'Copper/Gold', type: 'ratio', longTicker: 'HG=F', shortTicker: 'GC=F', longName: 'Copper', shortName: 'Gold', icon: '🔩/🥇', description: 'Risk appetite proxy (Dr. Copper vs safe haven)', historicalMean: 0.00017 },
    { id: 'crude-brent', name: 'Brent-WTI', type: 'ratio', longTicker: 'BZ=F', shortTicker: 'CL=F', longName: 'Brent', shortName: 'WTI', icon: '🛢️↔🛢️', description: 'Atlantic Basin spread; indicates supply dynamics', historicalMean: 1.03 },
    { id: 'soybean-corn', name: 'Soybean/Corn', type: 'ratio', longTicker: 'ZS=F', shortTicker: 'ZC=F', longName: 'Soybeans', shortName: 'Corn', icon: '🫘/🌽', description: 'Planting decision ratio; >2.5 favors soybean planting', historicalMean: 2.4 },
];

const SIGNAL_CONFIG = {
    'extreme-wide': { label: 'Extreme Wide', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', emoji: '🔴' },
    'wide': { label: 'Wide', color: '#f97316', bg: 'rgba(249,115,22,0.15)', emoji: '🟠' },
    'neutral': { label: 'At Mean', color: '#a3a3a3', bg: 'rgba(163,163,163,0.15)', emoji: '⚪' },
    'narrow': { label: 'Narrow', color: '#22c55e', bg: 'rgba(34,197,94,0.15)', emoji: '🟢' },
    'extreme-narrow': { label: 'Extreme Narrow', color: '#16a34a', bg: 'rgba(22,163,74,0.15)', emoji: '🔵' },
};

// ── Math: ADF-like test (simplified) ─────────────────────────
function simplifiedADF(series: number[]): { stat: number; isStationary: boolean } {
    // Run AR(1) regression: ΔY(t) = α + β·Y(t-1) + ε
    // Test statistic = β / SE(β)
    const n = series.length;
    if (n < 20) return { stat: 0, isStationary: false };

    const diffs: number[] = [];
    const lagged: number[] = [];
    for (let i = 1; i < n; i++) {
        diffs.push(series[i] - series[i - 1]);
        lagged.push(series[i - 1]);
    }

    const m = diffs.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < m; i++) {
        sumX += lagged[i]; sumY += diffs[i]; sumXY += lagged[i] * diffs[i]; sumX2 += lagged[i] * lagged[i];
    }

    const beta = (m * sumXY - sumX * sumY) / (m * sumX2 - sumX * sumX);
    const alpha = (sumY - beta * sumX) / m;

    // Residuals and SE
    let sse = 0;
    for (let i = 0; i < m; i++) {
        const pred = alpha + beta * lagged[i];
        sse += (diffs[i] - pred) ** 2;
    }
    const se = Math.sqrt(sse / (m - 2)) / Math.sqrt(sumX2 / m - (sumX / m) ** 2) / Math.sqrt(m);
    const tStat = se > 0 ? beta / se : 0;

    // ADF critical values (5% level): approximately -2.86 for ~100 obs
    return { stat: tStat, isStationary: tStat < -2.86 };
}

function computeHalfLife(series: number[]): number {
    const n = series.length;
    if (n < 20) return Infinity;

    // AR(1): Y(t) = α + θ·Y(t-1) + ε → half-life = -ln(2)/ln(θ)
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 1; i < n; i++) {
        sumX += series[i - 1]; sumY += series[i]; sumXY += series[i - 1] * series[i]; sumX2 += series[i - 1] ** 2;
    }
    const m = n - 1;
    const theta = (m * sumXY - sumX * sumY) / (m * sumX2 - sumX * sumX);

    if (theta <= 0 || theta >= 1) return Infinity;
    return Math.abs(-Math.log(2) / Math.log(theta));
}

// ── Fetch & Analyze ──────────────────────────────────────────
async function fetchSpreadData(spread: SpreadDef): Promise<SpreadAnalysis | null> {
    try {
        const [resLong, resShort] = await Promise.all([
            fetch(`/api/prices/yahoo?symbols=${encodeURIComponent(spread.longTicker)}&range=1y&interval=1d`),
            fetch(`/api/prices/yahoo?symbols=${encodeURIComponent(spread.shortTicker)}&range=1y&interval=1d`),
        ]);

        const [dataLong, dataShort] = await Promise.all([resLong.json(), resShort.json()]);

        const parseOHLCV = (data: any) => {
            if (!data.chart?.result?.[0]) return [];
            const r = data.chart.result[0];
            const ts = r.timestamp || [];
            const q = r.indicators?.quote?.[0] || {};
            return ts.map((t: number, i: number) => ({
                date: new Date(t * 1000).toISOString().split('T')[0],
                close: q.close?.[i] || 0,
            })).filter((p: any) => p.close > 0);
        };

        const longPrices = parseOHLCV(dataLong);
        const shortPrices = parseOHLCV(dataShort);

        if (longPrices.length < 30 || shortPrices.length < 30) return null;

        // Align dates
        const longMap = new Map<string, number>(longPrices.map((p: { date: string; close: number }) => [p.date, p.close] as [string, number]));
        const aligned: { date: string; value: number }[] = [];
        for (const sp of shortPrices as { date: string; close: number }[]) {
            const lp = longMap.get(sp.date);
            if (lp !== undefined && sp.close > 0) {
                aligned.push({ date: sp.date, value: lp / sp.close });
            }
        }

        if (aligned.length < 30) return null;

        const ratios = aligned.map(a => a.value);
        const current = ratios[ratios.length - 1];
        const mean = ratios.reduce((s, v) => s + v, 0) / ratios.length;
        const std = Math.sqrt(ratios.reduce((s, v) => s + (v - mean) ** 2, 0) / ratios.length);
        const zScore = std > 0 ? (current - mean) / std : 0;

        const adf = simplifiedADF(ratios);
        const halfLife = computeHalfLife(ratios);

        const pctChange1M = ratios.length >= 22 ? ((current / ratios[ratios.length - 22]) - 1) * 100 : 0;

        let signal: SpreadAnalysis['signal'];
        let signalText: string;
        if (zScore > 2) { signal = 'extreme-wide'; signalText = `Z=${zScore.toFixed(1)} — Spread extremely wide, expect mean reversion narrowing`; }
        else if (zScore > 1) { signal = 'wide'; signalText = `Z=${zScore.toFixed(1)} — Spread widening, watch for reversal`; }
        else if (zScore < -2) { signal = 'extreme-narrow'; signalText = `Z=${zScore.toFixed(1)} — Spread extremely narrow, expect widening`; }
        else if (zScore < -1) { signal = 'narrow'; signalText = `Z=${zScore.toFixed(1)} — Spread narrowing`; }
        else { signal = 'neutral'; signalText = `Z=${zScore.toFixed(1)} — Spread near fair value`; }

        return {
            spread,
            ratioSeries: aligned,
            current,
            mean,
            std,
            zScore,
            halfLife: Math.round(halfLife),
            isCointegrated: adf.isStationary,
            adfStat: adf.stat,
            signal,
            signalText,
            pctChange1M,
        };
    } catch (e) {
        console.warn(`Failed to compute spread ${spread.name}:`, e);
        return null;
    }
}

// ── Spread Chart (Canvas) ────────────────────────────────────
function SpreadChart({ analysis, height = 200 }: { analysis: SpreadAnalysis; height?: number }) {
    const canvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
        if (!canvas || !analysis || analysis.ratioSeries.length === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        const data = analysis.ratioSeries;
        const values = data.map(d => d.value);
        const { mean, std } = analysis;

        const pad = { top: 15, right: 10, bottom: 25, left: 55 };
        const chartW = w - pad.left - pad.right;
        const chartH = h - pad.top - pad.bottom;

        const minVal = Math.min(...values, mean - 2.5 * std);
        const maxVal = Math.max(...values, mean + 2.5 * std);
        const range = maxVal - minVal || 1;

        const toX = (i: number) => pad.left + (i / (data.length - 1)) * chartW;
        const toY = (v: number) => pad.top + (1 - (v - minVal) / range) * chartH;

        // ±2σ band
        ctx.fillStyle = 'rgba(239,68,68,0.08)';
        ctx.fillRect(pad.left, toY(mean + 2 * std), chartW, toY(mean - 2 * std) - toY(mean + 2 * std));

        // ±1σ band
        ctx.fillStyle = 'rgba(249,115,22,0.1)';
        ctx.fillRect(pad.left, toY(mean + std), chartW, toY(mean - std) - toY(mean + std));

        // Mean line
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(163,163,163,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, toY(mean));
        ctx.lineTo(w - pad.right, toY(mean));
        ctx.stroke();
        ctx.setLineDash([]);

        // ±1σ lines
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = 'rgba(249,115,22,0.3)';
        ctx.beginPath();
        ctx.moveTo(pad.left, toY(mean + std)); ctx.lineTo(w - pad.right, toY(mean + std)); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pad.left, toY(mean - std)); ctx.lineTo(w - pad.right, toY(mean - std)); ctx.stroke();

        // ±2σ lines
        ctx.strokeStyle = 'rgba(239,68,68,0.3)';
        ctx.beginPath();
        ctx.moveTo(pad.left, toY(mean + 2 * std)); ctx.lineTo(w - pad.right, toY(mean + 2 * std)); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pad.left, toY(mean - 2 * std)); ctx.lineTo(w - pad.right, toY(mean - 2 * std)); ctx.stroke();
        ctx.setLineDash([]);

        // Ratio line
        const isCurrentAboveMean = values[values.length - 1] > mean;
        ctx.strokeStyle = isCurrentAboveMean ? '#f97316' : '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        values.forEach((v, i) => {
            const x = toX(i);
            const y = toY(v);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Latest dot
        const lastX = toX(values.length - 1);
        const lastY = toY(values[values.length - 1]);
        ctx.fillStyle = isCurrentAboveMean ? '#f97316' : '#3b82f6';
        ctx.beginPath();
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Y-axis labels
        ctx.fillStyle = '#666';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'right';
        const steps = [mean - 2 * std, mean - std, mean, mean + std, mean + 2 * std];
        const labels = ['-2σ', '-1σ', 'μ', '+1σ', '+2σ'];
        steps.forEach((v, i) => {
            const y = toY(v);
            if (y > pad.top && y < h - pad.bottom) {
                ctx.fillText(`${v.toFixed(2)} (${labels[i]})`, pad.left - 4, y + 3);
            }
        });

        // X-axis dates
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        const dateStep = Math.max(1, Math.floor(data.length / 6));
        for (let i = 0; i < data.length; i += dateStep) {
            const d = new Date(data[i].date);
            ctx.fillText(d.toLocaleDateString('en-US', { month: 'short' }), toX(i), h - 5);
        }
    }, [analysis]);

    return <canvas ref={canvasRef} style={{ width: '100%', height }} />;
}

// ── Z-Score Gauge ────────────────────────────────────────────
function ZScoreGauge({ zScore }: { zScore: number }) {
    const clampedZ = Math.max(-3, Math.min(3, zScore));
    const pct = ((clampedZ + 3) / 6) * 100;
    const color = Math.abs(zScore) > 2 ? '#ef4444' : Math.abs(zScore) > 1 ? '#f97316' : '#a3a3a3';

    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color }}>{zScore.toFixed(2)}</div>
            <div style={{ width: '100%', height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, marginTop: 6, position: 'relative', overflow: 'visible' }}>
                {/* Gradient bar */}
                <div style={{ width: '100%', height: '100%', borderRadius: 4, background: 'linear-gradient(to right, #3b82f6, #22c55e, #a3a3a3, #f97316, #ef4444)' }} />
                {/* Pointer */}
                <div style={{
                    position: 'absolute', top: -3, left: `${pct}%`, transform: 'translateX(-50%)',
                    width: 14, height: 14, borderRadius: '50%', background: color, border: '2px solid var(--bg-primary)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-tertiary)', marginTop: 4 }}>
                <span>−3σ</span><span>0</span><span>+3σ</span>
            </div>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────
export default function SpreadsPage() {
    const [analyses, setAnalyses] = useState<SpreadAnalysis[]>([]);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [selectedSpread, setSelectedSpread] = useState<string | null>(null);

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            const results: SpreadAnalysis[] = [];

            for (let i = 0; i < SPREADS.length; i++) {
                setProgress(Math.round(((i + 1) / SPREADS.length) * 100));
                const analysis = await fetchSpreadData(SPREADS[i]);
                if (analysis) results.push(analysis);
            }

            setAnalyses(results);
            setSelectedSpread(results[0]?.spread.id || null);
            setLoading(false);
        };
        fetchAll();
    }, []);

    const selected = useMemo(() => analyses.find(a => a.spread.id === selectedSpread), [analyses, selectedSpread]);

    // Sort spreads by z-score extremity
    const sortedAnalyses = useMemo(() => {
        return [...analyses].sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
    }, [analyses]);

    return (
        <AppShell title="Spread Analytics" subtitle="Inter-Commodity Ratios, Cointegration & Mean Reversion">
            {/* Loading */}
            {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-8)' }}>
                    <div style={{ width: 200, height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Computing spreads... {progress}%</p>
                </div>
            )}

            {!loading && (
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    {/* Spread Cards (left panel) */}
                    <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-semibold)', marginBottom: 4 }}>SPREAD PAIRS (sorted by Z-score extremity)</div>
                        {sortedAnalyses.map(a => {
                            const signalCfg = SIGNAL_CONFIG[a.signal];
                            const isSelected = selectedSpread === a.spread.id;
                            return (
                                <div
                                    key={a.spread.id}
                                    onClick={() => setSelectedSpread(a.spread.id)}
                                    style={{
                                        padding: 'var(--space-2) var(--space-3)',
                                        background: isSelected ? 'rgba(59,130,246,0.1)' : 'var(--bg-secondary)',
                                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-primary)'}`,
                                        borderRadius: 'var(--radius-lg)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                                            {a.spread.icon} {a.spread.name}
                                        </span>
                                        <span style={{
                                            padding: '1px 8px', borderRadius: 'var(--radius-full)',
                                            background: signalCfg.bg, color: signalCfg.color,
                                            fontSize: '10px', fontWeight: 'var(--weight-semibold)',
                                        }}>
                                            {signalCfg.emoji} Z={a.zScore.toFixed(1)}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                        <span>Current: {a.current.toFixed(a.current > 10 ? 1 : 3)}</span>
                                        <span>Mean: {a.mean.toFixed(a.mean > 10 ? 1 : 3)}</span>
                                        <span style={{ color: a.isCointegrated ? 'var(--green)' : 'var(--red)' }}>
                                            {a.isCointegrated ? '✓ Coint' : '✗ No Coint'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Detail Panel (right) */}
                    {selected && (
                        <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>
                                        {selected.spread.icon} {selected.spread.name}
                                    </h3>
                                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{selected.spread.description}</p>
                                </div>
                                <div style={{ fontSize: 'var(--text-xs)', padding: '4px 12px', borderRadius: 'var(--radius-full)', background: SIGNAL_CONFIG[selected.signal].bg, color: SIGNAL_CONFIG[selected.signal].color, fontWeight: 'var(--weight-semibold)' }}>
                                    {selected.signalText}
                                </div>
                            </div>

                            {/* Signal Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-2)' }}>
                                <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Z-Score</div>
                                    <ZScoreGauge zScore={selected.zScore} />
                                </div>
                                <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Cointegration</div>
                                    <div style={{ fontSize: 'var(--text-xl)', marginTop: 4 }}>{selected.isCointegrated ? '✅' : '❌'}</div>
                                    <div style={{ fontSize: 'var(--text-xs)', color: selected.isCointegrated ? 'var(--green)' : 'var(--red)', fontWeight: 'var(--weight-semibold)' }}>
                                        {selected.isCointegrated ? 'Mean-reverting' : 'Not stationary'}
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>ADF t={selected.adfStat.toFixed(2)}</div>
                                </div>
                                <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Half-Life</div>
                                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginTop: 4 }}>
                                        {selected.halfLife < 999 ? `${selected.halfLife}d` : '—'}
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                                        {selected.halfLife < 30 ? 'Fast reversion' : selected.halfLife < 90 ? 'Moderate' : 'Slow/No reversion'}
                                    </div>
                                </div>
                                <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Current Ratio</div>
                                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginTop: 4 }}>
                                        {selected.current.toFixed(selected.current > 10 ? 1 : 3)}
                                    </div>
                                    <div style={{ fontSize: '10px', color: selected.pctChange1M >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                        {selected.pctChange1M >= 0 ? '▲' : '▼'} {Math.abs(selected.pctChange1M).toFixed(1)}% (1M)
                                    </div>
                                </div>
                            </div>

                            {/* Chart */}
                            <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
                                        Ratio Time Series with Bollinger Bands (mean ± 1σ/2σ)
                                    </span>
                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                        {selected.ratioSeries.length} trading days
                                    </span>
                                </div>
                                <SpreadChart analysis={selected} height={240} />
                            </div>

                            {/* Stats summary */}
                            <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
                                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', marginBottom: 8 }}>Statistics</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, fontSize: 'var(--text-xs)' }}>
                                    {[
                                        { label: 'Mean (μ)', value: selected.mean.toFixed(selected.mean > 10 ? 1 : 4) },
                                        { label: 'Std Dev (σ)', value: selected.std.toFixed(selected.std > 1 ? 2 : 4) },
                                        { label: 'Min', value: Math.min(...selected.ratioSeries.map(r => r.value)).toFixed(selected.mean > 10 ? 1 : 4) },
                                        { label: 'Max', value: Math.max(...selected.ratioSeries.map(r => r.value)).toFixed(selected.mean > 10 ? 1 : 4) },
                                        { label: 'Historical Mean', value: selected.spread.historicalMean?.toFixed(selected.spread.historicalMean > 10 ? 1 : 3) || '—' },
                                        { label: 'Observations', value: selected.ratioSeries.length.toString() },
                                    ].map(s => (
                                        <div key={s.label}>
                                            <div style={{ color: 'var(--text-tertiary)' }}>{s.label}</div>
                                            <div style={{ color: 'var(--text-primary)', fontWeight: 'var(--weight-medium)' }}>{s.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    📐 <strong>Spread Analytics</strong> — Ratios computed from aligned daily closing prices (Yahoo Finance, 1Y).
                    Cointegration tested via simplified ADF (5% critical value = -2.86).
                    Half-life estimated from AR(1) regression.
                    Z-score = (current − mean) / σ. Signal levels: |Z|{'>'}2 = extreme (actionable), |Z|{'>'}1 = watch, |Z|{'<'}0.5 = at mean.
                    Green ✓ Coint = safe to trade mean reversion. Red ✗ = spread may not revert.
                </div>
            </div>
        </AppShell>
    );
}
