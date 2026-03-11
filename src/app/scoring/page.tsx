'use client';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// ── Types ────────────────────────────────────────────────────
interface OHLCVPoint { date: string; open: number; high: number; low: number; close: number; volume: number; }

interface FactorScores {
    momentum: number;
    carry: number;
    value: number;
    seasonality: number;
    trendStrength: number;
    volatilityRegime: number;
    supplyDemand: number;
    positioning: number;
}

interface CommodityScore {
    id: string;
    name: string;
    icon: string;
    sector: string;
    composite: number;
    factors: FactorScores;
    signal: 'strong-bull' | 'bull' | 'neutral' | 'bear' | 'strong-bear';
    price: number;
    priceChange1M: number;
    sparkline: number[];
}

// ── Commodities to track ─────────────────────────────────────
const TRACKED_COMMODITIES = [
    { id: 'gold-comex', name: 'Gold', icon: '🥇', sector: 'precious', yahoo: 'GC=F' },
    { id: 'silver-comex', name: 'Silver', icon: '🥈', sector: 'precious', yahoo: 'SI=F' },
    { id: 'platinum-nymex', name: 'Platinum', icon: '✨', sector: 'precious', yahoo: 'PL=F' },
    { id: 'copper-comex', name: 'Copper', icon: '🔩', sector: 'base', yahoo: 'HG=F' },
    { id: 'aluminium-lme', name: 'Aluminium', icon: '🪶', sector: 'base', yahoo: 'ALI=F' },
    { id: 'crudeoil-nymex', name: 'Crude Oil', icon: '🛢️', sector: 'energy', yahoo: 'CL=F' },
    { id: 'brent-ice', name: 'Brent', icon: '🛢️', sector: 'energy', yahoo: 'BZ=F' },
    { id: 'naturalgas-nymex', name: 'Natural Gas', icon: '🔥', sector: 'energy', yahoo: 'NG=F' },
    { id: 'wheat-cbot', name: 'Wheat', icon: '🌾', sector: 'agri', yahoo: 'ZW=F' },
    { id: 'corn-cbot', name: 'Corn', icon: '🌽', sector: 'agri', yahoo: 'ZC=F' },
    { id: 'soybeans-cbot', name: 'Soybeans', icon: '🫘', sector: 'agri', yahoo: 'ZS=F' },
    { id: 'cotton-ice', name: 'Cotton', icon: '🧶', sector: 'softs', yahoo: 'CT=F' },
    { id: 'sugar-ice', name: 'Sugar', icon: '🍬', sector: 'softs', yahoo: 'SB=F' },
    { id: 'coffee-ice', name: 'Coffee', icon: '☕', sector: 'softs', yahoo: 'KC=F' },
];

const FACTOR_NAMES: Record<keyof FactorScores, string> = {
    momentum: 'Momentum',
    carry: 'Carry',
    value: 'Value',
    seasonality: 'Seasonality',
    trendStrength: 'Trend',
    volatilityRegime: 'Volatility',
    supplyDemand: 'S/D Balance',
    positioning: 'Positioning',
};

const FACTOR_COLORS: Record<keyof FactorScores, string> = {
    momentum: '#3b82f6',
    carry: '#8b5cf6',
    value: '#f59e0b',
    seasonality: '#22c55e',
    trendStrength: '#06b6d4',
    volatilityRegime: '#ec4899',
    supplyDemand: '#f97316',
    positioning: '#14b8a6',
};

const SECTORS = ['all', 'precious', 'base', 'energy', 'agri', 'softs'];
const SECTOR_LABELS: Record<string, string> = { all: 'All', precious: 'Precious', base: 'Base Metals', energy: 'Energy', agri: 'Agriculture', softs: 'Softs' };

// ── Math Utilities ───────────────────────────────────────────
function computeReturns(closes: number[]): number[] {
    const r: number[] = [];
    for (let i = 1; i < closes.length; i++) r.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    return r;
}

function computeSMA(closes: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < closes.length; i++) {
        if (i < period - 1) { result.push(NaN); continue; }
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += closes[j];
        result.push(sum / period);
    }
    return result;
}

function computeRSI(closes: number[], period = 14): number {
    if (closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff; else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function computeATR(highs: number[], lows: number[], closes: number[], period = 14): number {
    if (highs.length < period + 1) return 0;
    const trs: number[] = [];
    for (let i = 1; i < highs.length; i++) {
        const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
        trs.push(tr);
    }
    // Simple average of last 'period' TRs
    const recent = trs.slice(-period);
    return recent.reduce((s, v) => s + v, 0) / recent.length;
}

function computeADX(highs: number[], lows: number[], closes: number[], period = 14): number {
    if (highs.length < period * 2 + 1) return 25; // default neutral
    const dmPlus: number[] = [];
    const dmMinus: number[] = [];
    const trs: number[] = [];
    for (let i = 1; i < highs.length; i++) {
        const upMove = highs[i] - highs[i - 1];
        const downMove = lows[i - 1] - lows[i];
        dmPlus.push(upMove > downMove && upMove > 0 ? upMove : 0);
        dmMinus.push(downMove > upMove && downMove > 0 ? downMove : 0);
        trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    }
    // Smoothed averages
    const smooth = (arr: number[], p: number) => {
        let val = arr.slice(0, p).reduce((s, v) => s + v, 0);
        const result: number[] = [val];
        for (let i = p; i < arr.length; i++) {
            val = val - val / p + arr[i];
            result.push(val);
        }
        return result;
    };
    const sDmP = smooth(dmPlus, period);
    const sDmM = smooth(dmMinus, period);
    const sTR = smooth(trs, period);
    const dx: number[] = [];
    for (let i = 0; i < Math.min(sDmP.length, sTR.length); i++) {
        const diP = sTR[i] > 0 ? (sDmP[i] / sTR[i]) * 100 : 0;
        const diM = sTR[i] > 0 ? (sDmM[i] / sTR[i]) * 100 : 0;
        const sum = diP + diM;
        dx.push(sum > 0 ? (Math.abs(diP - diM) / sum) * 100 : 0);
    }
    if (dx.length < period) return dx.length > 0 ? dx[dx.length - 1] : 25;
    // ADX = smooth of DX
    let adx = dx.slice(0, period).reduce((s, v) => s + v, 0) / period;
    for (let i = period; i < dx.length; i++) {
        adx = (adx * (period - 1) + dx[i]) / period;
    }
    return adx;
}

function computeLinRegR2(closes: number[], period: number): number {
    const data = closes.slice(-period);
    if (data.length < period) return 0;
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += i; sumY += data[i]; sumXY += i * data[i]; sumX2 += i * i; sumY2 += data[i] * data[i];
    }
    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    if (den === 0) return 0;
    const r = num / den;
    return r * r;
}

// Historical monthly returns for seasonality (using 5Y avg estimates for major commodities)
const SEASONALITY_PROFILES: Record<string, number[]> = {
    // [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec] — avg monthly returns in %
    'gold-comex': [3.1, 0.8, -0.5, 1.2, 0.4, -0.8, 0.6, 2.1, -1.5, -0.2, 1.8, 0.9],
    'silver-comex': [2.8, 1.5, -1.2, 2.0, 0.3, -1.5, 1.2, 3.0, -2.0, -0.8, 2.1, 1.0],
    'platinum-nymex': [3.5, 0.5, -0.8, 2.5, -1.0, -0.5, 1.8, 0.2, -1.2, 1.0, 0.8, 0.3],
    'copper-comex': [2.0, 1.5, 0.8, 2.5, -1.5, -0.8, 1.0, -0.5, -1.0, 0.5, 1.2, 0.8],
    'aluminium-lme': [1.5, 1.0, 0.5, 2.0, -1.8, -1.0, 0.8, -0.3, -0.8, 0.3, 1.5, 0.5],
    'crudeoil-nymex': [1.0, 2.5, 1.5, 3.0, -0.5, -2.0, 0.8, -1.5, -1.2, 0.5, -0.8, 1.5],
    'brent-ice': [1.2, 2.2, 1.3, 2.8, -0.3, -1.8, 0.5, -1.2, -1.0, 0.8, -0.5, 1.3],
    'naturalgas-nymex': [1.5, -2.0, -3.5, -2.0, -1.0, 0.5, 2.0, 1.5, 0.8, 3.5, 4.0, 2.5],
    'wheat-cbot': [-1.0, 0.5, 0.8, 1.5, 2.0, 3.5, -2.0, -1.5, -0.5, -1.0, 0.2, -0.5],
    'corn-cbot': [-0.5, 1.0, 0.5, 2.0, 3.0, 4.0, -3.0, -2.0, -1.5, 0.8, 0.5, 0.0],
    'soybeans-cbot': [-0.8, 1.5, 1.0, 1.5, 2.5, 3.5, -2.5, -3.0, -1.0, 0.5, 1.0, 0.3],
    'cotton-ice': [1.5, 0.8, -0.5, 1.0, 2.5, -1.0, -1.5, -0.8, -0.5, 0.5, 1.0, 0.8],
    'sugar-ice': [2.0, 1.5, -0.5, 0.8, -1.0, -0.8, 0.5, 1.0, 2.5, 1.0, -0.5, -0.3],
    'coffee-ice': [1.0, 0.5, -1.0, -0.5, 1.5, -1.5, 2.0, 1.0, -0.8, 0.5, 2.5, 1.5],
};

// ── Factor Computation Engine ────────────────────────────────
function computeFactors(id: string, ohlcv: OHLCVPoint[]): FactorScores {
    if (ohlcv.length < 30) return { momentum: 50, carry: 50, value: 50, seasonality: 50, trendStrength: 50, volatilityRegime: 50, supplyDemand: 50, positioning: 50 };

    const closes = ohlcv.map(p => p.close);
    const highs = ohlcv.map(p => p.high);
    const lows = ohlcv.map(p => p.low);
    const volumes = ohlcv.map(p => p.volume);
    const latest = closes[closes.length - 1];

    // ── 1. Momentum (multi-horizon blended) ──
    const ret1M = closes.length >= 22 ? (latest / closes[closes.length - 22] - 1) * 100 : 0;
    const ret3M = closes.length >= 66 ? (latest / closes[closes.length - 66] - 1) * 100 : 0;
    const ret6M = closes.length >= 132 ? (latest / closes[closes.length - 132] - 1) * 100 : ret3M;
    const blendedMom = ret1M * 0.4 + ret3M * 0.35 + ret6M * 0.25;
    // Map to 0-100: -20% → 0, 0% → 50, +20% → 100
    const momentum = Math.max(0, Math.min(100, (blendedMom + 20) / 40 * 100));

    // ── 2. Carry / Roll Yield (simplified: monthly return structure) ──
    // Without multi-contract data, use price momentum structure as carry proxy
    const sma50 = computeSMA(closes, 50);
    const latestSMA50 = sma50[sma50.length - 1];
    const carryProxy = latestSMA50 > 0 ? ((latest - latestSMA50) / latestSMA50) * 100 : 0;
    const carry = Math.max(0, Math.min(100, (carryProxy + 10) / 20 * 100));

    // ── 3. Value (z-score vs long-term mean) ──
    const meanPrice = closes.reduce((s, v) => s + v, 0) / closes.length;
    const std = Math.sqrt(closes.reduce((s, v) => s + (v - meanPrice) ** 2, 0) / closes.length);
    const zScore = std > 0 ? (latest - meanPrice) / std : 0;
    // Negative z-score (below mean) = high value; z < -2 → 100, z > +2 → 0
    const value = Math.max(0, Math.min(100, (-zScore + 2) / 4 * 100));

    // ── 4. Seasonality ──
    const profile = SEASONALITY_PROFILES[id];
    const currentMonth = new Date().getMonth(); // 0-indexed
    const monthReturn = profile ? profile[currentMonth] : 0;
    // Map expected monthly return to 0-100: -3% → 0, 0% → 50, +3% → 100
    const seasonality = Math.max(0, Math.min(100, (monthReturn + 3) / 6 * 100));

    // ── 5. Trend Strength (ADX + SMA alignment + R²) ──
    const adx = computeADX(highs, lows, closes);
    const sma20 = computeSMA(closes, 20);
    const sma200 = computeSMA(closes, Math.min(200, Math.floor(closes.length * 0.9)));
    const latestSMA20 = sma20[sma20.length - 1];
    const latestSMA200 = sma200[sma200.length - 1];
    const smaAligned = (latest > latestSMA20 && latestSMA20 > latestSMA50 && latestSMA50 > latestSMA200) ? 1 :
        (latest < latestSMA20 && latestSMA20 < latestSMA50 && latestSMA50 < latestSMA200) ? -1 : 0;
    const r2 = computeLinRegR2(closes, 60);
    const adxScore = Math.min(100, (adx / 50) * 100); // ADX 0→0, 50→100
    const alignScore = smaAligned === 1 ? 80 : smaAligned === -1 ? 20 : 50;
    const r2Score = r2 * 100;
    const trendStrength = adxScore * 0.4 + alignScore * 0.3 + r2Score * 0.3;

    // ── 6. Volatility Regime (ATR percentile) ──
    const atr = computeATR(highs, lows, closes);
    const atrPct = latest > 0 ? (atr / latest) * 100 : 0;
    // Low vol = favorable (higher score), high vol = risky (lower score)
    // ATR% of 0% → 100, 5% → 0
    const volatilityRegime = Math.max(0, Math.min(100, (5 - atrPct) / 5 * 100));

    // ── 7. Supply/Demand (placeholder → uses USDA/EIA when available via API) ──
    // For now, use volume trend as proxy
    const avgVol = volumes.slice(-60).reduce((s, v) => s + v, 0) / Math.min(60, volumes.length);
    const recentVol = volumes.slice(-5).reduce((s, v) => s + v, 0) / 5;
    const volRatio = avgVol > 0 ? recentVol / avgVol : 1;
    // Higher than avg volume with rising prices → demand, with falling → supply
    const priceDir = ret1M > 0 ? 1 : -1;
    const supplyDemand = Math.max(0, Math.min(100, 50 + priceDir * (volRatio - 1) * 50));

    // ── 8. Positioning (placeholder → filled from COT when available) ──
    // RSI as proxy until COT data is integrated
    const rsi = computeRSI(closes);
    // RSI < 30 → bearish positioning (contrarian bullish → high score)
    // RSI > 70 → bullish positioning (contrarian bearish → low score)
    const positioning = Math.max(0, Math.min(100, 100 - rsi));

    return { momentum, carry, value, seasonality, trendStrength, volatilityRegime, supplyDemand, positioning };
}

function computeComposite(factors: FactorScores): number {
    // Base weights per implementation plan
    const weights = {
        momentum: 0.15, carry: 0.10, value: 0.10, seasonality: 0.10,
        trendStrength: 0.15, volatilityRegime: 0.10, supplyDemand: 0.15, positioning: 0.15,
    };
    let score = 0;
    for (const [k, w] of Object.entries(weights)) {
        score += factors[k as keyof FactorScores] * w;
    }
    return Math.round(score);
}

function getSignal(composite: number): CommodityScore['signal'] {
    if (composite >= 70) return 'strong-bull';
    if (composite >= 55) return 'bull';
    if (composite >= 45) return 'neutral';
    if (composite >= 30) return 'bear';
    return 'strong-bear';
}

const SIGNAL_BADGES: Record<CommodityScore['signal'], { label: string; color: string; bg: string }> = {
    'strong-bull': { label: 'Strong Bull', color: '#16a34a', bg: 'rgba(22,163,74,0.15)' },
    'bull': { label: 'Bullish', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
    'neutral': { label: 'Neutral', color: '#a3a3a3', bg: 'rgba(163,163,163,0.15)' },
    'bear': { label: 'Bearish', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
    'strong-bear': { label: 'Strong Bear', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
};

// ── Radar Chart Component ────────────────────────────────────
function RadarChart({ factors, size = 120 }: { factors: FactorScores; size?: number }) {
    const keys = Object.keys(factors) as (keyof FactorScores)[];
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 15;
    const n = keys.length;

    const points = keys.map((key, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const val = factors[key] / 100;
        return {
            x: cx + r * val * Math.cos(angle),
            y: cy + r * val * Math.sin(angle),
            labelX: cx + (r + 12) * Math.cos(angle),
            labelY: cy + (r + 12) * Math.sin(angle),
            name: FACTOR_NAMES[key],
            value: factors[key],
            color: FACTOR_COLORS[key],
        };
    });

    const polygon = points.map(p => `${p.x},${p.y}`).join(' ');

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Grid circles */}
            {[0.25, 0.5, 0.75, 1].map(level => (
                <circle key={level} cx={cx} cy={cy} r={r * level} fill="none" stroke="var(--border-primary)" strokeWidth={0.5} opacity={0.4} />
            ))}
            {/* Axes */}
            {keys.map((_, i) => {
                const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
                return <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(angle)} y2={cy + r * Math.sin(angle)} stroke="var(--border-primary)" strokeWidth={0.5} opacity={0.3} />;
            })}
            {/* Data polygon */}
            <polygon points={polygon} fill="var(--accent)" fillOpacity={0.15} stroke="var(--accent)" strokeWidth={1.5} />
            {/* Data points */}
            {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={p.color} />
            ))}
        </svg>
    );
}

// ── Sparkline Component ──────────────────────────────────────
function Sparkline({ data, width = 80, height = 24 }: { data: number[]; width?: number; height?: number }) {
    if (data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(' ');
    const isUp = data[data.length - 1] >= data[0];
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <polyline points={points} fill="none" stroke={isUp ? 'var(--green)' : 'var(--red)'} strokeWidth={1.5} />
        </svg>
    );
}

// ── Score Bar Component ──────────────────────────────────────
function ScoreBar({ score, width = 80 }: { score: number; width?: number }) {
    const color = score >= 70 ? '#22c55e' : score >= 55 ? '#86efac' : score >= 45 ? '#a3a3a3' : score >= 30 ? '#fdba74' : '#ef4444';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width, height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
            </div>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color, minWidth: 22 }}>{score}</span>
        </div>
    );
}

// ── Factor Decomposition Panel ───────────────────────────────
function FactorDecomposition({ score }: { score: CommodityScore }) {
    const keys = Object.keys(score.factors) as (keyof FactorScores)[];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
                <RadarChart factors={score.factors} size={160} />
                <div style={{ flex: 1, minWidth: 200 }}>
                    {keys.map(key => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 'var(--text-xs)' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: FACTOR_COLORS[key], display: 'inline-block', flexShrink: 0 }} />
                            <span style={{ color: 'var(--text-secondary)', width: 70 }}>{FACTOR_NAMES[key]}</span>
                            <div style={{ flex: 1, height: 4, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ width: `${score.factors[key]}%`, height: '100%', background: FACTOR_COLORS[key], borderRadius: 2, opacity: 0.8 }} />
                            </div>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 'var(--weight-medium)', minWidth: 24, textAlign: 'right' }}>{Math.round(score.factors[key])}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────
export default function ScoringPage() {
    const [scores, setScores] = useState<CommodityScore[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sector, setSector] = useState('all');
    const [sortBy, setSortBy] = useState<'composite' | 'momentum' | 'value' | 'trendStrength' | 'positioning'>('composite');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            setError('');
            const results: CommodityScore[] = [];

            for (let i = 0; i < TRACKED_COMMODITIES.length; i++) {
                const comm = TRACKED_COMMODITIES[i];
                setProgress(Math.round(((i + 1) / TRACKED_COMMODITIES.length) * 100));
                try {
                    const res = await fetch(`/api/prices/yahoo?symbols=${encodeURIComponent(comm.yahoo)}&range=1y&interval=1d`);
                    const data = await res.json();

                    let ohlcv: OHLCVPoint[] = [];
                    if (data.chart?.result?.[0]) {
                        const r = data.chart.result[0];
                        const ts = r.timestamp || [];
                        const q = r.indicators?.quote?.[0] || {};
                        ohlcv = ts.map((t: number, j: number) => ({
                            date: new Date(t * 1000).toISOString().split('T')[0],
                            open: q.open?.[j] || 0,
                            high: q.high?.[j] || 0,
                            low: q.low?.[j] || 0,
                            close: q.close?.[j] || 0,
                            volume: q.volume?.[j] || 0,
                        })).filter((p: OHLCVPoint) => p.close > 0);
                    }

                    if (ohlcv.length < 30) continue;

                    const factors = computeFactors(comm.id, ohlcv);
                    const composite = computeComposite(factors);
                    const closes = ohlcv.map(p => p.close);
                    const latest = closes[closes.length - 1];
                    const priceChange1M = closes.length >= 22 ? ((latest / closes[closes.length - 22]) - 1) * 100 : 0;

                    results.push({
                        id: comm.id,
                        name: comm.name,
                        icon: comm.icon,
                        sector: comm.sector,
                        composite,
                        factors,
                        signal: getSignal(composite),
                        price: latest,
                        priceChange1M,
                        sparkline: closes.slice(-30),
                    });
                } catch (e: any) {
                    console.warn(`Failed to score ${comm.name}:`, e.message);
                }
            }

            setScores(results);
            setLoading(false);
        };

        fetchAll();
    }, []);

    const filtered = useMemo(() => {
        let data = sector === 'all' ? scores : scores.filter(s => s.sector === sector);
        data.sort((a, b) => {
            if (sortBy === 'composite') return b.composite - a.composite;
            return b.factors[sortBy] - a.factors[sortBy];
        });
        return data;
    }, [scores, sector, sortBy]);

    // Sector averages
    const sectorAvgs = useMemo(() => {
        const avgs: Record<string, number> = {};
        for (const sec of SECTORS.filter(s => s !== 'all')) {
            const items = scores.filter(s => s.sector === sec);
            if (items.length > 0) avgs[sec] = Math.round(items.reduce((s, i) => s + i.composite, 0) / items.length);
        }
        return avgs;
    }, [scores]);

    return (
        <AppShell title="Scoring Engine" subtitle="Multi-Factor Quantitative Commodity Scoring">
            {/* Sector Averages */}
            {!loading && scores.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                    {Object.entries(sectorAvgs).map(([sec, avg]) => (
                        <div key={sec} onClick={() => setSector(sec)} style={{
                            padding: 'var(--space-2) var(--space-3)', background: sector === sec ? 'var(--accent)' : 'var(--bg-secondary)',
                            border: `1px solid ${sector === sec ? 'var(--accent)' : 'var(--border-primary)'}`, borderRadius: 'var(--radius-lg)',
                            cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                        }}>
                            <div style={{ fontSize: 'var(--text-xs)', color: sector === sec ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)' }}>{SECTOR_LABELS[sec]}</div>
                            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: sector === sec ? '#fff' : (avg >= 55 ? 'var(--green)' : avg >= 45 ? 'var(--text-primary)' : 'var(--red)') }}>{avg}</div>
                        </div>
                    ))}
                    <div onClick={() => setSector('all')} style={{
                        padding: 'var(--space-2) var(--space-3)', background: sector === 'all' ? 'var(--accent)' : 'var(--bg-secondary)',
                        border: `1px solid ${sector === 'all' ? 'var(--accent)' : 'var(--border-primary)'}`, borderRadius: 'var(--radius-lg)',
                        cursor: 'pointer', textAlign: 'center',
                    }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: sector === 'all' ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)' }}>All</div>
                        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: sector === 'all' ? '#fff' : 'var(--text-primary)' }}>
                            {scores.length > 0 ? Math.round(scores.reduce((s, i) => s + i.composite, 0) / scores.length) : '—'}
                        </div>
                    </div>
                </div>
            )}

            {/* Sort controls */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                {(['composite', 'momentum', 'value', 'trendStrength', 'positioning'] as const).map(key => (
                    <button key={key} onClick={() => setSortBy(key)} style={{
                        padding: '4px 12px', fontSize: 'var(--text-xs)', borderRadius: 'var(--radius-md)',
                        border: `1px solid ${sortBy === key ? 'var(--accent)' : 'var(--border-primary)'}`,
                        background: sortBy === key ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: sortBy === key ? '#fff' : 'var(--text-secondary)', cursor: 'pointer',
                    }}>
                        {key === 'composite' ? 'Composite' : FACTOR_NAMES[key]}
                    </button>
                ))}
            </div>

            {/* Loading state */}
            {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-8)' }}>
                    <div style={{ width: 200, height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', borderRadius: 3, transition: 'width 0.3s ease' }} />
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                        Computing scores... {progress}% ({Math.round((progress / 100) * TRACKED_COMMODITIES.length)}/{TRACKED_COMMODITIES.length})
                    </p>
                </div>
            )}

            {/* Results table */}
            {!loading && filtered.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-primary)' }}>
                                <th style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)' }}>#</th>
                                <th style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)' }}>Commodity</th>
                                <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)' }}>Score</th>
                                <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)' }}>Signal</th>
                                <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)' }}>Price</th>
                                <th style={{ textAlign: 'right', padding: '8px 6px', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)' }}>1M Δ</th>
                                <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)' }}>30D</th>
                                <th style={{ textAlign: 'center', padding: '8px 6px', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)' }}>Factors</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((s, i) => {
                                const badge = SIGNAL_BADGES[s.signal];
                                const isExpanded = expanded === s.id;
                                return (
                                    <React.Fragment key={s.id}>
                                        <tr
                                            onClick={() => setExpanded(isExpanded ? null : s.id)}
                                            style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-primary)', cursor: 'pointer', transition: 'background 0.15s' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <td style={{ padding: '10px 6px', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)' }}>{i + 1}</td>
                                            <td style={{ padding: '10px 6px', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                                                {s.icon} {s.name}
                                                <span style={{ marginLeft: 6, fontSize: '10px', color: 'var(--text-tertiary)' }}>{s.sector}</span>
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '10px 6px' }}>
                                                <ScoreBar score={s.composite} />
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '10px 6px' }}>
                                                <span style={{ padding: '2px 10px', borderRadius: 'var(--radius-full)', background: badge.bg, color: badge.color, fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)' }}>
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '10px 6px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--text-xs)' }}>
                                                {s.price.toFixed(2)}
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '10px 6px', color: s.priceChange1M >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 'var(--text-xs)' }}>
                                                {s.priceChange1M >= 0 ? '+' : ''}{s.priceChange1M.toFixed(1)}%
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '10px 6px' }}>
                                                <Sparkline data={s.sparkline} />
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '10px 6px' }}>
                                                <RadarChart factors={s.factors} size={50} />
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={8} style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
                                                    <FactorDecomposition score={s} />
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {!loading && filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
                    No commodities found for this filter
                </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    🧮 <strong>Multi-Factor Scoring Engine</strong> — 8 orthogonal factors: Momentum (multi-horizon), Carry, Value (z-score), Seasonality (5Y avg), Trend Strength (ADX+SMA+R²), Volatility Regime (ATR percentile), Supply/Demand, Positioning (RSI proxy).
                    Score 0–100 with {'>'}70=Strong Bull, {'>'}55=Bullish, 45–55=Neutral, {'<'}45=Bearish, {'<'}30=Strong Bear.
                    Click any row for full factor decomposition with radar chart.
                </div>
            </div>
        </AppShell>
    );
}
