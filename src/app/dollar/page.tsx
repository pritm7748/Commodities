'use client';

import { useState, useEffect, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell';
import { formatPrice, formatChange } from '@/lib/utils/conversions';

// ── Types ─────────────────────────────────────────────────────

interface ForexRate {
    pair: string;
    label: string;
    price: number;
    change: number;
    changePercent: number;
    flag: string;
}

interface CorrelationItem {
    commodity: string;
    icon: string;
    correlation: number; // -1 to +1 (vs DXY)
    description: string;
}

// ── Static correlation data (historical averages) ─────────────

const CORRELATIONS: CorrelationItem[] = [
    { commodity: 'Gold', icon: '🥇', correlation: -0.82, description: 'Strong inverse — Gold is the classic dollar hedge' },
    { commodity: 'Silver', icon: '🥈', correlation: -0.72, description: 'Follows Gold, but with higher industrial demand influence' },
    { commodity: 'Crude Oil', icon: '🛢️', correlation: -0.65, description: 'Oil priced in USD — weaker dollar means cheaper for non-USD buyers' },
    { commodity: 'Copper', icon: '🔴', correlation: -0.58, description: 'Global growth sensitivity reduces pure dollar correlation' },
    { commodity: 'Natural Gas', icon: '🔥', correlation: -0.25, description: 'Weak correlation — more driven by weather & regional supply' },
    { commodity: 'Wheat', icon: '🌾', correlation: -0.41, description: 'Moderate inverse — USD exports become cheaper when dollar weakens' },
    { commodity: 'Cotton', icon: '🧵', correlation: -0.35, description: 'Moderate correlation — export-driven pricing' },
    { commodity: 'Aluminium', icon: '⬜', correlation: -0.52, description: 'Strong link to Chinese demand & USD pricing' },
];

// ── Impact Analysis ───────────────────────────────────────────

const IMPACT_SCENARIOS = [
    {
        scenario: 'DXY rises 1%', effects: [
            { commodity: 'Gold', impact: -0.82, direction: 'falls' },
            { commodity: 'Crude Oil', impact: -0.65, direction: 'falls' },
            { commodity: 'Silver', impact: -0.72, direction: 'falls' },
            { commodity: 'Copper', impact: -0.58, direction: 'falls' },
        ]
    },
    {
        scenario: 'INR depreciates 1%', effects: [
            { commodity: 'MCX Gold', impact: 1.0, direction: 'rises' },
            { commodity: 'MCX Silver', impact: 1.0, direction: 'rises' },
            { commodity: 'MCX Crude', impact: 1.0, direction: 'rises' },
            { commodity: 'MCX Copper', impact: 1.0, direction: 'rises' },
        ]
    },
];

// ── Key Currency Pairs ────────────────────────────────────────

const FOREX_PAIRS: { pair: string; label: string; flag: string; yahooTicker: string }[] = [
    { pair: 'DXY', label: 'US Dollar Index', flag: '🇺🇸', yahooTicker: 'DX-Y.NYB' },
    { pair: 'USD/INR', label: 'US Dollar / Indian Rupee', flag: '🇮🇳', yahooTicker: 'INR=X' },
    { pair: 'EUR/USD', label: 'Euro / US Dollar', flag: '🇪🇺', yahooTicker: 'EURUSD=X' },
    { pair: 'GBP/USD', label: 'British Pound / US Dollar', flag: '🇬🇧', yahooTicker: 'GBPUSD=X' },
    { pair: 'USD/JPY', label: 'US Dollar / Japanese Yen', flag: '🇯🇵', yahooTicker: 'JPY=X' },
    { pair: 'USD/CNY', label: 'US Dollar / Chinese Yuan', flag: '🇨🇳', yahooTicker: 'CNY=X' },
    { pair: 'AUD/USD', label: 'Australian Dollar', flag: '🇦🇺', yahooTicker: 'AUDUSD=X' },
];

// ── Component ─────────────────────────────────────────────────

export default function DollarCurrencyPage() {
    const [forexRates, setForexRates] = useState<ForexRate[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'currencies' | 'correlation' | 'impact'>('currencies');

    // Fallback prices used when API fails 
    const FALLBACK: Record<string, number> = {
        'DXY': 106.68, 'USD/INR': 86.90, 'EUR/USD': 1.0435,
        'GBP/USD': 1.2615, 'USD/JPY': 152.05, 'USD/CNY': 7.25, 'AUD/USD': 0.6365,
    };

    // Fetch forex rates from Yahoo via our chart API (one per ticker)
    useEffect(() => {
        async function fetchForex() {
            try {
                const results = await Promise.allSettled(
                    FOREX_PAIRS.map(async (p) => {
                        const res = await fetch(`/api/prices/yahoo?symbols=${encodeURIComponent(p.yahooTicker)}&range=2d&interval=1d`);
                        const data = await res.json();
                        const chart = data?.chart?.result?.[0];
                        const meta = chart?.meta;
                        const closes = chart?.indicators?.quote?.[0]?.close;

                        const price = meta?.regularMarketPrice ?? 0;
                        const prevClose = (closes && closes.length >= 2) ? closes[closes.length - 2] : meta?.chartPreviousClose ?? price;
                        const change = price - prevClose;
                        const changePercent = prevClose ? (change / prevClose) * 100 : 0;

                        return {
                            pair: p.pair,
                            label: p.label,
                            flag: p.flag,
                            price,
                            change,
                            changePercent,
                        };
                    })
                );

                const rates: ForexRate[] = results.map((result, i) => {
                    if (result.status === 'fulfilled' && result.value.price > 0) {
                        return result.value;
                    }
                    // Fallback for failed/zero fetches
                    const p = FOREX_PAIRS[i];
                    return {
                        pair: p.pair, label: p.label, flag: p.flag,
                        price: FALLBACK[p.pair] ?? 0,
                        change: 0, changePercent: 0,
                    };
                });

                setForexRates(rates);
            } catch {
                // Full fallback
                setForexRates(FOREX_PAIRS.map(p => ({
                    pair: p.pair, label: p.label, flag: p.flag,
                    price: FALLBACK[p.pair] ?? 0,
                    change: 0, changePercent: 0,
                })));
            } finally {
                setLoading(false);
            }
        }
        fetchForex();
    }, []);

    const dxy = forexRates.find(r => r.pair === 'DXY');
    const usdInr = forexRates.find(r => r.pair === 'USD/INR');

    const sortedCorrelations = useMemo(() =>
        [...CORRELATIONS].sort((a, b) => a.correlation - b.correlation),
        []);

    return (
        <AppShell title="Dollar & Currency" subtitle="USD Impact on Commodity Prices">
            {/* DXY + USDINR Hero Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                {/* DXY Card */}
                <div className="card" style={{
                    padding: 'var(--space-5)',
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(99,102,241,0.08))',
                    borderColor: 'rgba(59,130,246,0.3)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>US Dollar Index</div>
                            <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-black)', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '4px' }}>
                                {loading ? '...' : dxy?.price.toFixed(2) ?? '—'}
                            </div>
                        </div>
                        <div style={{ fontSize: '2.5rem' }}>🇺🇸</div>
                    </div>
                    {dxy && (
                        <div style={{ marginTop: 'var(--space-2)', display: 'flex', gap: 'var(--space-3)' }}>
                            <span className={dxy.changePercent >= 0 ? 'text-gain' : 'text-loss'} style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>
                                {dxy.change > 0 ? '+' : ''}{dxy.change.toFixed(2)} ({formatChange(dxy.changePercent)})
                            </span>
                        </div>
                    )}
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
                        Strong dollar = bearish for commodities
                    </div>
                </div>

                {/* USD/INR Card */}
                <div className="card" style={{
                    padding: 'var(--space-5)',
                    background: 'linear-gradient(135deg, rgba(255,153,0,0.1), rgba(34,197,94,0.08))',
                    borderColor: 'rgba(255,153,0,0.3)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>USD / INR</div>
                            <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-black)', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: '4px' }}>
                                {loading ? '...' : usdInr ? `₹${usdInr.price.toFixed(2)}` : '—'}
                            </div>
                        </div>
                        <div style={{ fontSize: '2.5rem' }}>🇮🇳</div>
                    </div>
                    {usdInr && (
                        <div style={{ marginTop: 'var(--space-2)', display: 'flex', gap: 'var(--space-3)' }}>
                            <span className={usdInr.changePercent >= 0 ? 'text-loss' : 'text-gain'} style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>
                                {usdInr.change > 0 ? '+' : ''}{usdInr.change.toFixed(2)} ({formatChange(usdInr.changePercent)})
                            </span>
                        </div>
                    )}
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
                        Weaker INR = higher MCX commodity prices
                    </div>
                </div>

                {/* Market Status Card */}
                <div className="card" style={{ padding: 'var(--space-5)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>Dollar Regime</div>
                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                        {dxy && dxy.price > 105 ? '💪 Strong Dollar' : dxy && dxy.price > 100 ? '➡️ Neutral Zone' : '📉 Weak Dollar'}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {dxy && dxy.price > 105
                            ? 'Dollar above 105 — headwind for commodity prices. Gold & Oil typically under pressure.'
                            : dxy && dxy.price > 100
                                ? 'Dollar in neutral range 100-105. Mixed signals for commodities.'
                                : 'Dollar below 100 — tailwind for commodity prices. Historically bullish for Gold, Oil, Metals.'
                        }
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div className="filter-toggle">
                    {(['currencies', 'correlation', 'impact'] as const).map(tab => (
                        <button
                            key={tab}
                            className={`filter-btn ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'currencies' ? '💱 Currencies' : tab === 'correlation' ? '📊 Correlation' : '💥 Impact'}
                        </button>
                    ))}
                </div>
            </div>

            {/* TAB: Currencies */}
            {activeTab === 'currencies' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
                    {forexRates.filter(r => r.pair !== 'DXY').map(rate => (
                        <div key={rate.pair} className="card" style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div style={{ fontSize: '1.8rem' }}>{rate.flag}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>{rate.pair}</div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{rate.label}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                                    {rate.price.toFixed(rate.pair.includes('JPY') || rate.pair.includes('INR') ? 2 : 4)}
                                </div>
                                <div className={rate.changePercent >= 0 ? 'text-gain' : 'text-loss'} style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-bold)' }}>
                                    {formatChange(rate.changePercent)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* TAB: Correlation */}
            {activeTab === 'correlation' && (
                <div className="card" style={{ padding: 'var(--space-5)' }}>
                    <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
                        📊 Commodity vs DXY Correlation (Historical Average)
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {sortedCorrelations.map(item => {
                            const barWidth = Math.abs(item.correlation) * 100;
                            const isNeg = item.correlation < 0;

                            return (
                                <div key={item.commodity}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', width: 100 }}>
                                            {item.commodity}
                                        </span>
                                        <span style={{
                                            fontSize: 'var(--text-xs)',
                                            fontFamily: 'var(--font-mono)',
                                            fontWeight: 'var(--weight-bold)',
                                            color: isNeg ? '#ef4444' : '#22c55e',
                                            width: 50,
                                        }}>
                                            {item.correlation.toFixed(2)}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                                        {/* Negative side */}
                                        <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-end' }}>
                                            {isNeg && (
                                                <div style={{
                                                    width: `${barWidth}%`,
                                                    height: 18,
                                                    background: 'linear-gradient(270deg, #ef4444, #ef444444)',
                                                    borderRadius: '4px 0 0 4px',
                                                    transition: 'width 0.5s ease',
                                                }} />
                                            )}
                                        </div>
                                        {/* Center line */}
                                        <div style={{ width: 2, height: 22, background: 'var(--border-secondary)', flexShrink: 0 }} />
                                        {/* Positive side */}
                                        <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-start' }}>
                                            {!isNeg && (
                                                <div style={{
                                                    width: `${barWidth}%`,
                                                    height: 18,
                                                    background: 'linear-gradient(90deg, #22c55e, #22c55e44)',
                                                    borderRadius: '0 4px 4px 0',
                                                    transition: 'width 0.5s ease',
                                                }} />
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: '2px', marginLeft: 'calc(1rem + var(--space-2) + 100px + 50px)' }}>
                                        {item.description}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        <span>← Inverse (falls with Dollar ↑)</span>
                        <span>Positive (rises with Dollar ↑) →</span>
                    </div>
                </div>
            )}

            {/* TAB: Impact Analysis */}
            {activeTab === 'impact' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 'var(--space-4)' }}>
                    {IMPACT_SCENARIOS.map(scenario => (
                        <div key={scenario.scenario} className="card" style={{ padding: 'var(--space-5)' }}>
                            <h3 style={{
                                fontSize: 'var(--text-base)',
                                fontWeight: 'var(--weight-bold)',
                                color: 'var(--text-primary)',
                                marginBottom: 'var(--space-3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)',
                            }}>
                                💥 If {scenario.scenario}...
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {scenario.effects.map(e => (
                                    <div key={e.commodity} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: 'var(--space-2) var(--space-3)',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-md)',
                                    }}>
                                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{e.commodity}</span>
                                        <span style={{
                                            fontSize: 'var(--text-sm)',
                                            fontFamily: 'var(--font-mono)',
                                            fontWeight: 'var(--weight-bold)',
                                            color: e.direction === 'falls' ? '#ef4444' : '#22c55e',
                                        }}>
                                            typically {e.direction} ~{Math.abs(e.impact).toFixed(1)}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Key Insight Card */}
                    <div className="card" style={{
                        padding: 'var(--space-5)',
                        background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(245,158,11,0.05))',
                        borderColor: 'rgba(251,191,36,0.2)',
                    }}>
                        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: '#fbbf24', marginBottom: 'var(--space-3)' }}>
                            💡 Key Insights for Indian Traders
                        </h3>
                        <ul style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0, paddingLeft: 'var(--space-4)' }}>
                            <li>MCX prices = Global Price × USD/INR. Both matter.</li>
                            <li>When DXY rises AND INR weakens, MCX impact is amplified.</li>
                            <li>Gold has the strongest inverse correlation with DXY (-0.82).</li>
                            <li>Natural Gas is least affected by dollar moves (-0.25).</li>
                            <li>Watch RBI interventions — they can decouple INR from global FX trends.</li>
                        </ul>
                    </div>
                </div>
            )}
        </AppShell>
    );
}
