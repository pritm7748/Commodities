'use client';

import { useState, useEffect, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell';
import { ALL_COMMODITIES } from '@/lib/data/commodities';
import { PriceData, fetchAllPrices } from '@/lib/services/priceService';

// ── Types ─────────────────────────────────────────────────────

interface SentimentItem {
    commodity: string;
    symbol: string;
    sector: string;
    price: number;
    changePercent: number;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    momentum: number;    // -100 to +100
    strength: number;    // 0-100 (absolute momentum)
}

// ── Helpers ───────────────────────────────────────────────────

function classifySentiment(changePercent: number): 'bullish' | 'bearish' | 'neutral' {
    if (changePercent > 0.5) return 'bullish';
    if (changePercent < -0.5) return 'bearish';
    return 'neutral';
}

function computeMomentum(changePercent: number): number {
    return Math.max(-100, Math.min(100, changePercent * 30));
}

function getFearGreedScore(items: SentimentItem[]): number {
    if (items.length === 0) return 50;
    const avgMomentum = items.reduce((s, i) => s + i.momentum, 0) / items.length;
    return Math.round(Math.max(0, Math.min(100, 50 + avgMomentum * 0.5)));
}

function getFearGreedLabel(score: number): { label: string; color: string; emoji: string } {
    if (score >= 80) return { label: 'Extreme Greed', color: '#22c55e', emoji: '🤑' };
    if (score >= 60) return { label: 'Greed', color: '#86efac', emoji: '😊' };
    if (score >= 45) return { label: 'Neutral', color: '#fbbf24', emoji: '😐' };
    if (score >= 25) return { label: 'Fear', color: '#f87171', emoji: '😟' };
    return { label: 'Extreme Fear', color: '#ef4444', emoji: '😱' };
}

// ── Fear & Greed Gauge ────────────────────────────────────────

function FearGreedGauge({ score }: { score: number }) {
    const { label, color, emoji } = getFearGreedLabel(score);
    const rotation = (score / 100) * 180 - 90; // -90 to +90 degrees

    return (
        <div className="card" style={{
            padding: 'var(--space-5)',
            textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(168,85,247,0.04))',
        }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
                Commodity Fear & Greed Index
            </div>

            {/* Gauge */}
            <div style={{ position: 'relative', width: 220, height: 130, margin: '0 auto', marginBottom: 'var(--space-2)' }}>
                {/* Background arc */}
                <svg viewBox="0 0 220 130" style={{ width: '100%', height: '100%' }}>
                    <defs>
                        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="25%" stopColor="#f59e0b" />
                            <stop offset="50%" stopColor="#fbbf24" />
                            <stop offset="75%" stopColor="#86efac" />
                            <stop offset="100%" stopColor="#22c55e" />
                        </linearGradient>
                    </defs>
                    <path d="M 20 120 A 90 90 0 0 1 200 120" fill="none" stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round" />
                    {/* Needle */}
                    <g transform={`rotate(${rotation}, 110, 120)`}>
                        <line x1="110" y1="120" x2="110" y2="40" stroke={color} strokeWidth="3" strokeLinecap="round" />
                        <circle cx="110" cy="120" r="6" fill={color} />
                    </g>
                </svg>
            </div>

            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-1)' }}>{emoji}</div>
            <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-black)', fontFamily: 'var(--font-mono)', color }}>
                {score}
            </div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color, marginTop: '2px' }}>
                {label}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                <span>😱 Extreme Fear</span>
                <span>Extreme Greed 🤑</span>
            </div>
        </div>
    );
}

// ── Market Breadth ────────────────────────────────────────────

function MarketBreadth({ items }: { items: SentimentItem[] }) {
    const bullish = items.filter(i => i.sentiment === 'bullish').length;
    const bearish = items.filter(i => i.sentiment === 'bearish').length;
    const neutral = items.filter(i => i.sentiment === 'neutral').length;
    const total = items.length || 1;

    return (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>
                📊 Market Breadth
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div style={{ flex: 1, height: 24, display: 'flex', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <div style={{ width: `${(bullish / total) * 100}%`, background: '#22c55e', transition: 'width 0.5s ease' }} />
                    <div style={{ width: `${(neutral / total) * 100}%`, background: '#fbbf24', transition: 'width 0.5s ease' }} />
                    <div style={{ width: `${(bearish / total) * 100}%`, background: '#ef4444', transition: 'width 0.5s ease' }} />
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)' }}>
                <span style={{ color: '#22c55e', fontWeight: 'var(--weight-bold)' }}>Bullish: {bullish} ({((bullish / total) * 100).toFixed(0)}%)</span>
                <span style={{ color: '#fbbf24', fontWeight: 'var(--weight-bold)' }}>Neutral: {neutral}</span>
                <span style={{ color: '#ef4444', fontWeight: 'var(--weight-bold)' }}>Bearish: {bearish} ({((bearish / total) * 100).toFixed(0)}%)</span>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────

export default function SentimentPage() {
    const [items, setItems] = useState<SentimentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'momentum' | 'leaders'>('overview');

    useEffect(() => {
        fetchAllPrices().then(response => {
            const priceMap = new Map<string, PriceData>();
            response.data.forEach(p => priceMap.set(p.commodityId, p));

            const sentimentItems: SentimentItem[] = ALL_COMMODITIES
                .filter(c => priceMap.has(c.id))
                .map(c => {
                    const p = priceMap.get(c.id)!;
                    const momentum = computeMomentum(p.changePercent);
                    return {
                        commodity: c.name,
                        symbol: c.symbol,
                        sector: c.sector,
                        price: p.price,
                        changePercent: p.changePercent,
                        sentiment: classifySentiment(p.changePercent),
                        momentum,
                        strength: Math.abs(momentum),
                    };
                });

            setItems(sentimentItems);
            setLoading(false);
        });
    }, []);

    const fearGreedScore = useMemo(() => getFearGreedScore(items), [items]);

    const topBullish = useMemo(() => [...items].sort((a, b) => b.momentum - a.momentum).slice(0, 5), [items]);
    const topBearish = useMemo(() => [...items].sort((a, b) => a.momentum - b.momentum).slice(0, 5), [items]);

    // Sector sentiment
    const sectorSentiment = useMemo(() => {
        const sectors: Record<string, { bullish: number; bearish: number; neutral: number; avgMomentum: number }> = {};
        items.forEach(item => {
            if (!sectors[item.sector]) sectors[item.sector] = { bullish: 0, bearish: 0, neutral: 0, avgMomentum: 0 };
            sectors[item.sector][item.sentiment]++;
            sectors[item.sector].avgMomentum += item.momentum;
        });
        return Object.entries(sectors).map(([sector, data]) => {
            const total = data.bullish + data.bearish + data.neutral;
            return { sector, ...data, avgMomentum: data.avgMomentum / (total || 1), total };
        }).sort((a, b) => b.avgMomentum - a.avgMomentum);
    }, [items]);

    if (loading) {
        return (
            <AppShell title="Sentiment" subtitle="Market Sentiment Analysis">
                <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--text-tertiary)' }}>⏳ Computing market sentiment...</div>
            </AppShell>
        );
    }

    return (
        <AppShell title="Sentiment" subtitle="Market Sentiment Analysis — Derived from Price Action">
            {/* Stats Bar */}
            <div className="stats-bar" style={{ marginBottom: 'var(--space-4)' }}>
                <div className="stat-item">
                    <span className="stat-label">Commodities</span>
                    <span className="stat-value">{items.length}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Fear & Greed</span>
                    <span className="stat-value" style={{ color: getFearGreedLabel(fearGreedScore).color }}>{fearGreedScore} — {getFearGreedLabel(fearGreedScore).label}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Strongest</span>
                    <span className="stat-value text-gain">{topBullish[0]?.symbol} ({topBullish[0]?.changePercent.toFixed(2)}%)</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Weakest</span>
                    <span className="stat-value text-loss">{topBearish[0]?.symbol} ({topBearish[0]?.changePercent.toFixed(2)}%)</span>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div className="filter-toggle">
                    {(['overview', 'momentum', 'leaders'] as const).map(tab => (
                        <button
                            key={tab}
                            className={`filter-btn ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'overview' ? '🎯 Overview' : tab === 'momentum' ? '📊 Momentum' : '🏆 Leaders'}
                        </button>
                    ))}
                </div>
            </div>

            {/* TAB: Overview */}
            {activeTab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                    <FearGreedGauge score={fearGreedScore} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        <MarketBreadth items={items} />

                        {/* Sector Sentiment */}
                        <div className="card" style={{ padding: 'var(--space-4)' }}>
                            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>
                                🏷️ Sector Sentiment
                            </h3>
                            {sectorSentiment.map(s => {
                                const sentColor = s.avgMomentum > 10 ? '#22c55e' : s.avgMomentum < -10 ? '#ef4444' : '#fbbf24';
                                return (
                                    <div key={s.sector} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '8px' }}>
                                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', width: 70, textTransform: 'capitalize', fontWeight: 'var(--weight-bold)' }}>{s.sector}</span>
                                        <div style={{ flex: 1, height: 16, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                                            {/* center-anchored bar */}
                                            <div style={{
                                                position: 'absolute',
                                                left: s.avgMomentum >= 0 ? '50%' : `${50 + s.avgMomentum * 0.5}%`,
                                                width: `${Math.abs(s.avgMomentum) * 0.5}%`,
                                                height: '100%',
                                                background: sentColor,
                                                borderRadius: 3,
                                                transition: 'all 0.5s ease',
                                            }} />
                                            {/* Center line */}
                                            <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: 'var(--border-secondary)' }} />
                                        </div>
                                        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: sentColor, fontWeight: 'var(--weight-bold)', width: 40, textAlign: 'right' }}>
                                            {s.avgMomentum > 0 ? '+' : ''}{s.avgMomentum.toFixed(0)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: Momentum */}
            {activeTab === 'momentum' && (
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                    <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>
                        📊 All Commodities — Momentum Score
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {[...items].sort((a, b) => b.momentum - a.momentum).map(item => {
                            const momentumColor = item.momentum > 20 ? '#22c55e' : item.momentum > 0 ? '#86efac' : item.momentum > -20 ? '#f87171' : '#ef4444';
                            const sentEmoji = item.sentiment === 'bullish' ? '🟢' : item.sentiment === 'bearish' ? '🔴' : '🟡';

                            return (
                                <div key={item.symbol} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <span style={{ fontSize: '10px' }}>{sentEmoji}</span>
                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', width: 65, fontWeight: 'var(--weight-bold)' }}>{item.symbol}</span>
                                    <div style={{ flex: 1, height: 14, position: 'relative', background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{
                                            position: 'absolute',
                                            left: item.momentum >= 0 ? '50%' : `${50 + item.momentum * 0.5}%`,
                                            width: `${Math.abs(item.momentum) * 0.5}%`,
                                            height: '100%',
                                            background: momentumColor,
                                            borderRadius: 3,
                                            transition: 'all 0.5s ease',
                                        }} />
                                        <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: 'var(--border-secondary)' }} />
                                    </div>
                                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: momentumColor, fontWeight: 'var(--weight-bold)', width: 55, textAlign: 'right' }}>
                                        {item.changePercent > 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB: Leaders */}
            {activeTab === 'leaders' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 'var(--space-4)' }}>
                    {/* Top 5 Strongest */}
                    <div className="card" style={{ padding: 'var(--space-4)' }}>
                        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: '#22c55e', marginBottom: 'var(--space-3)' }}>
                            🚀 Top 5 Strongest (Momentum Leaders)
                        </h3>
                        {topBullish.map((item, i) => (
                            <div key={item.symbol} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: 'var(--space-2) var(--space-3)',
                                background: `rgba(34, 197, 94, ${0.15 - i * 0.02})`,
                                borderRadius: 'var(--radius-md)',
                                marginBottom: '6px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-black)', color: '#22c55e', width: 20 }}>#{i + 1}</span>
                                    <div>
                                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>{item.commodity}</div>
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{item.symbol} • {item.sector}</div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-bold)', color: '#22c55e' }}>
                                        +{item.changePercent.toFixed(2)}%
                                    </div>
                                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                                        Score: {item.momentum.toFixed(0)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Top 5 Weakest */}
                    <div className="card" style={{ padding: 'var(--space-4)' }}>
                        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: '#ef4444', marginBottom: 'var(--space-3)' }}>
                            📉 Top 5 Weakest (Momentum Laggards)
                        </h3>
                        {topBearish.map((item, i) => (
                            <div key={item.symbol} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: 'var(--space-2) var(--space-3)',
                                background: `rgba(239, 68, 68, ${0.15 - i * 0.02})`,
                                borderRadius: 'var(--radius-md)',
                                marginBottom: '6px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-black)', color: '#ef4444', width: 20 }}>#{i + 1}</span>
                                    <div>
                                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>{item.commodity}</div>
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{item.symbol} • {item.sector}</div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-bold)', color: '#ef4444' }}>
                                        {item.changePercent.toFixed(2)}%
                                    </div>
                                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                                        Score: {item.momentum.toFixed(0)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </AppShell>
    );
}
