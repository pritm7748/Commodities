'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import {
    INTEREST_RATES,
    ECONOMIC_CALENDAR,
} from '@/lib/data/fundamentals/macroData';

// ── Types ─────────────────────────────────────────────────────

interface LiveInterestRate {
    centralBank: string;
    country: string;
    flag: string;
    rate: number;
    previousRate: number;
    nextMeeting: string;
    expectation: string;
    lastUpdate: string;
    live: boolean;
}

interface LiveIndicator {
    name: string;
    value: string;
    previous: string;
    change: 'up' | 'down' | 'flat';
    unit: string;
    source: string;
    lastUpdate: string;
    impact: string;
    icon: string;
}

// ── FRED Series Config ────────────────────────────────────────
// Maps each indicator to its FRED series ID + display config

const FRED_INDICATORS: {
    seriesId: string;
    name: string;
    icon: string;
    source: string;
    unit: string;
    format: (v: number) => string;
    impact: string;
}[] = [
        {
            seriesId: 'A191RL1Q225SBEA', name: 'US GDP Growth', icon: '📊', source: 'BEA',
            unit: 'QoQ annualized', format: v => `${v.toFixed(1)}%`,
            impact: 'Slowing growth — neutral to bearish for industrial metals, mildly bullish Gold.',
        },
        {
            seriesId: 'CPIAUCSL', name: 'US CPI Inflation', icon: '📈', source: 'BLS',
            unit: 'Index (1982-84=100)', format: v => v.toFixed(1),
            impact: 'Rising inflation — bullish Gold & Silver as inflation hedge. Delays Fed cuts.',
        },
        {
            seriesId: 'FEDFUNDS', name: 'Fed Funds Rate', icon: '🏛️', source: 'Federal Reserve',
            unit: '% effective rate', format: v => `${v.toFixed(2)}%`,
            impact: 'Rate cuts underway — bullish Gold, supports commodity demand via cheaper financing.',
        },
        {
            seriesId: 'UNRATE', name: 'US Unemployment', icon: '👷', source: 'BLS',
            unit: '%', format: v => `${v.toFixed(1)}%`,
            impact: 'Tight labor market — supports consumer spending and commodity demand.',
        },
        {
            seriesId: 'MANEMP', name: 'US Manufacturing Jobs', icon: '🏭', source: 'BLS',
            unit: 'thousands', format: v => `${(v / 1000).toFixed(1)}M`,
            impact: 'Manufacturing employment signals industrial activity — key for base metals demand.',
        },
        {
            seriesId: 'NAPM', name: 'US ISM Manufacturing PMI', icon: '🏭', source: 'ISM',
            unit: 'index', format: v => v.toFixed(1),
            impact: 'Below 50 = contraction. Directly impacts industrial metals (Copper, Aluminium, Zinc).',
        },
        {
            seriesId: 'DGS10', name: 'US 10Y Treasury Yield', icon: '📉', source: 'US Treasury',
            unit: '%', format: v => `${v.toFixed(2)}%`,
            impact: 'Lower yields — bullish Gold (reduces opportunity cost of holding non-yielding gold).',
        },
    ];

// ── FRED Interest Rate Series ────────────────────────────────
// Each central bank rate mapped to its FRED series ID

const FRED_INTEREST_RATES: {
    seriesId: string;
    centralBank: string;
    country: string;
    flag: string;
    nextMeeting: string;
    expectation: string;
}[] = [
        { seriesId: 'FEDFUNDS', centralBank: 'Federal Reserve', country: 'USA', flag: '🇺🇸', nextMeeting: 'Mar 19, 2025', expectation: 'Hold (78% probability)' },
        { seriesId: 'ECBDFR', centralBank: 'ECB', country: 'Eurozone', flag: '🇪🇺', nextMeeting: 'Mar 6, 2025', expectation: 'Cut 25bps (65%)' },
        { seriesId: 'IUDSOIA', centralBank: 'Bank of England', country: 'UK', flag: '🇬🇧', nextMeeting: 'Mar 20, 2025', expectation: 'Hold (70%)' },
        { seriesId: 'IRSTCB01JPM156N', centralBank: 'Bank of Japan', country: 'Japan', flag: '🇯🇵', nextMeeting: 'Mar 14, 2025', expectation: 'Hold (85%)' },
        { seriesId: 'IRSTCB01INM156N', centralBank: 'RBI', country: 'India', flag: '🇮🇳', nextMeeting: 'Apr 9, 2025', expectation: 'Cut 25bps (60%)' },
        { seriesId: 'INTDSRCNM193N', centralBank: "People's Bank of China", country: 'China', flag: '🇨🇳', nextMeeting: 'Mar 2025', expectation: 'Cut 10bps (50%)' },
    ];

// ── Yahoo-fetched indicators (DXY, VIX — not in FRED or better via Yahoo) ──

const YAHOO_INDICATORS: {
    ticker: string;
    name: string;
    icon: string;
    source: string;
    unit: string;
    format: (v: number) => string;
    impact: string;
}[] = [
        {
            ticker: 'DX-Y.NYB', name: 'US Dollar Index (DXY)', icon: '💵', source: 'ICE',
            unit: 'index', format: v => v.toFixed(2),
            impact: 'Stronger dollar — headwind for all commodities priced in USD.',
        },
        {
            ticker: '^VIX', name: 'VIX (Fear Index)', icon: '😰', source: 'CBOE',
            unit: 'index', format: v => v.toFixed(2),
            impact: 'Rising volatility — bullish Gold as safe haven. Risk-off sentiment.',
        },
    ];

// ── Main Page ─────────────────────────────────────────────────

export default function MacroPage() {
    const [activeTab, setActiveTab] = useState<'indicators' | 'rates' | 'calendar'>('indicators');
    const [indicators, setIndicators] = useState<LiveIndicator[]>([]);
    const [liveRates, setLiveRates] = useState<LiveInterestRate[]>([]);
    const [ratesLoading, setRatesLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [lastFetchTime, setLastFetchTime] = useState<string>('');

    const fetchLiveData = useCallback(async () => {
        setLoading(true);
        const results: LiveIndicator[] = [];

        // 1. Fetch FRED indicators in parallel
        const fredPromises = FRED_INDICATORS.map(async (cfg) => {
            try {
                const res = await fetch(`/api/data/fred?series_id=${cfg.seriesId}&limit=2`);
                const data = await res.json();
                const obs = data?.observations;

                if (obs && obs.length > 0) {
                    const latest = parseFloat(obs[0].value);
                    const prev = obs.length > 1 ? parseFloat(obs[1].value) : latest;
                    const change: 'up' | 'down' | 'flat' = latest > prev ? 'up' : latest < prev ? 'down' : 'flat';

                    return {
                        name: cfg.name,
                        value: cfg.format(latest),
                        previous: cfg.format(prev),
                        change,
                        unit: cfg.unit,
                        source: cfg.source,
                        lastUpdate: obs[0].date,
                        impact: cfg.impact,
                        icon: cfg.icon,
                    } as LiveIndicator;
                }
            } catch (err) {
                console.error(`FRED fetch error for ${cfg.seriesId}:`, err);
            }
            return null;
        });

        // 2. Fetch Yahoo indicators (DXY, VIX)
        const yahooPromises = YAHOO_INDICATORS.map(async (cfg) => {
            try {
                const res = await fetch(`/api/prices/yahoo?symbols=${encodeURIComponent(cfg.ticker)}&range=5d&interval=1d`);
                const data = await res.json();
                const chart = data?.chart?.result?.[0];
                const meta = chart?.meta;
                const closes = chart?.indicators?.quote?.[0]?.close?.filter((c: number | null) => c != null) || [];

                const price = meta?.regularMarketPrice ?? 0;
                const prevClose = closes.length >= 2 ? closes[closes.length - 2] : meta?.chartPreviousClose ?? price;
                const change: 'up' | 'down' | 'flat' = price > prevClose ? 'up' : price < prevClose ? 'down' : 'flat';

                if (price > 0) {
                    const tradeDate = meta?.regularMarketTime
                        ? new Date(meta.regularMarketTime * 1000).toISOString().split('T')[0]
                        : 'Live';

                    return {
                        name: cfg.name,
                        value: cfg.format(price),
                        previous: cfg.format(prevClose),
                        change,
                        unit: cfg.unit,
                        source: cfg.source,
                        lastUpdate: tradeDate,
                        impact: cfg.impact,
                        icon: cfg.icon,
                    } as LiveIndicator;
                }
            } catch (err) {
                console.error(`Yahoo fetch error for ${cfg.ticker}:`, err);
            }
            return null;
        });

        const allResults = await Promise.allSettled([...fredPromises, ...yahooPromises]);

        for (const result of allResults) {
            if (result.status === 'fulfilled' && result.value) {
                results.push(result.value);
            }
        }

        setIndicators(results);
        setLastFetchTime(new Date().toLocaleTimeString());
        setLoading(false);

        // 3. Fetch live interest rates from FRED
        setRatesLoading(true);
        const rateResults: LiveInterestRate[] = [];

        const ratePromises = FRED_INTEREST_RATES.map(async (cfg, idx) => {
            try {
                const res = await fetch(`/api/data/fred?series_id=${cfg.seriesId}&limit=2`);
                const data = await res.json();
                const obs = data?.observations;

                if (obs && obs.length > 0) {
                    const latest = parseFloat(obs[0].value);
                    const prev = obs.length > 1 ? parseFloat(obs[1].value) : latest;

                    return {
                        centralBank: cfg.centralBank,
                        country: cfg.country,
                        flag: cfg.flag,
                        rate: latest,
                        previousRate: prev,
                        nextMeeting: cfg.nextMeeting,
                        expectation: cfg.expectation,
                        lastUpdate: obs[0].date,
                        live: true,
                    } as LiveInterestRate;
                }
            } catch (err) {
                console.error(`FRED rate fetch error for ${cfg.seriesId}:`, err);
            }
            // Fallback to static data
            const fallback = INTEREST_RATES[idx];
            if (fallback) {
                return {
                    ...fallback,
                    lastUpdate: 'Static',
                    live: false,
                } as LiveInterestRate;
            }
            return null;
        });

        const rateSettled = await Promise.allSettled(ratePromises);
        for (const r of rateSettled) {
            if (r.status === 'fulfilled' && r.value) {
                rateResults.push(r.value);
            }
        }

        setLiveRates(rateResults);
        setRatesLoading(false);
    }, []);

    useEffect(() => {
        fetchLiveData();
    }, [fetchLiveData]);

    // Stats
    const upCount = indicators.filter(i => i.change === 'up').length;
    const downCount = indicators.filter(i => i.change === 'down').length;
    const highEvents = ECONOMIC_CALENDAR.filter(e => e.importance === 'high').length;

    return (
        <AppShell title="Macroeconomic Data" subtitle="Key Economic Indicators, Interest Rates & Calendar">
            {/* Live Data Banner */}
            <div style={{
                padding: 'var(--space-3) var(--space-4)',
                marginBottom: 'var(--space-4)',
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-xs)',
                color: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: '1rem' }}>🟢</span>
                    <span>
                        <strong>Live Data</strong> — Indicators & Interest Rates from FRED API (Federal Reserve), DXY & VIX from Yahoo Finance.
                        Calendar is curated reference data.
                    </span>
                </div>
                {lastFetchTime && (
                    <span style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', marginLeft: 'var(--space-3)' }}>
                        Updated: {lastFetchTime}
                    </span>
                )}
            </div>

            {/* Stats Bar */}
            <div className="stats-bar" style={{ marginBottom: 'var(--space-4)' }}>
                <div className="stat-item">
                    <span className="stat-label">Indicators Tracked</span>
                    <span className="stat-value">{loading ? '...' : indicators.length}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Rising</span>
                    <span className="stat-value text-loss">{loading ? '...' : upCount}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Falling</span>
                    <span className="stat-value text-gain">{loading ? '...' : downCount}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">High-Impact Events</span>
                    <span className="stat-value" style={{ color: '#f59e0b' }}>{highEvents}</span>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div className="filter-toggle">
                    {(['indicators', 'rates', 'calendar'] as const).map(tab => (
                        <button
                            key={tab}
                            className={`filter-btn ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'indicators' ? '📊 Indicators' : tab === 'rates' ? '🏛️ Interest Rates' : '📅 Calendar'}
                        </button>
                    ))}
                </div>
            </div>

            {/* TAB: Indicators — LIVE from FRED + Yahoo */}
            {activeTab === 'indicators' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-3)' }}>
                    {loading ? (
                        // Skeleton loaders
                        Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="card" style={{ padding: 'var(--space-4)', opacity: 0.5 }}>
                                <div style={{ height: 20, background: 'var(--bg-tertiary)', borderRadius: 4, marginBottom: 12, width: '60%' }} />
                                <div style={{ height: 32, background: 'var(--bg-tertiary)', borderRadius: 4, marginBottom: 8, width: '40%' }} />
                                <div style={{ height: 14, background: 'var(--bg-tertiary)', borderRadius: 4, width: '90%' }} />
                            </div>
                        ))
                    ) : indicators.length > 0 ? (
                        indicators.map(ind => {
                            const changeColor = ind.change === 'up' ? '#ef4444' : ind.change === 'down' ? '#22c55e' : 'var(--text-tertiary)';
                            const changeIcon = ind.change === 'up' ? '▲' : ind.change === 'down' ? '▼' : '—';

                            return (
                                <div key={ind.name} className="card" style={{ padding: 'var(--space-4)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                            <span style={{ fontSize: '1.3rem' }}>{ind.icon}</span>
                                            <div>
                                                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>{ind.name}</div>
                                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{ind.source} • {ind.lastUpdate}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                                        <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                                            {ind.value}
                                        </span>
                                        <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: changeColor, fontWeight: 'var(--weight-bold)' }}>
                                            {changeIcon} from {ind.previous}
                                        </span>
                                    </div>

                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        {ind.impact}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="card" style={{ padding: 'var(--space-5)', gridColumn: '1 / -1', textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>⚠️</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                                Unable to fetch live data. Please ensure FRED_API_KEY is set in .env.local
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Interest Rates — LIVE from FRED */}
            {activeTab === 'rates' && (
                <div>
                    {/* Rate Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-3)' }}>
                        {ratesLoading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="card" style={{ padding: 'var(--space-4)', opacity: 0.5 }}>
                                    <div style={{ height: 20, background: 'var(--bg-tertiary)', borderRadius: 4, marginBottom: 12, width: '50%' }} />
                                    <div style={{ height: 32, background: 'var(--bg-tertiary)', borderRadius: 4, marginBottom: 8, width: '35%' }} />
                                    <div style={{ height: 14, background: 'var(--bg-tertiary)', borderRadius: 4, width: '80%' }} />
                                </div>
                            ))
                        ) : liveRates.map(rate => {
                            const changed = rate.rate !== rate.previousRate;
                            const cut = rate.rate < rate.previousRate;

                            return (
                                <div key={rate.centralBank} className="card" style={{ padding: 'var(--space-4)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                <span style={{ fontSize: '1.5rem' }}>{rate.flag}</span>
                                                <div>
                                                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>{rate.centralBank}</div>
                                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{rate.country}</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-black)', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                                                {rate.rate.toFixed(2)}%
                                            </div>
                                            {changed && (
                                                <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: cut ? '#22c55e' : '#ef4444', fontWeight: 'var(--weight-bold)' }}>
                                                    {cut ? '▼' : '▲'} from {rate.previousRate.toFixed(2)}%
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)' }}>
                                            <span style={{ color: 'var(--text-tertiary)' }}>Next Meeting</span>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: 'var(--weight-bold)' }}>{rate.nextMeeting}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginTop: '4px' }}>
                                            <span style={{ color: 'var(--text-tertiary)' }}>Expectation</span>
                                            <span style={{ color: 'var(--text-secondary)' }}>{rate.expectation}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginTop: '4px' }}>
                                            <span style={{ color: 'var(--text-tertiary)' }}>Data As Of</span>
                                            <span style={{ color: rate.live ? '#22c55e' : 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                                                {rate.live ? `🟢 ${rate.lastUpdate}` : '📋 Reference'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Rate Cycle Insight */}
                    <div className="card" style={{
                        padding: 'var(--space-5)',
                        marginTop: 'var(--space-4)',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.05))',
                        borderColor: 'rgba(99,102,241,0.2)',
                    }}>
                        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: '#818cf8', marginBottom: 'var(--space-2)' }}>
                            💡 Rate Cycle Impact on Commodities
                        </h3>
                        <ul style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0, paddingLeft: 'var(--space-4)' }}>
                            <li><strong>Rate cuts</strong> — Bullish Gold & Silver (lower opportunity cost of holding zero-yield assets)</li>
                            <li><strong>Rate cuts</strong> — Bullish Oil & base metals (cheaper financing → more economic activity)</li>
                            <li><strong>Rate hikes</strong> — Bearish commodities (stronger dollar, higher financing costs)</li>
                            <li><strong>Global policy divergence</strong> — Increases FX volatility, impacts MCX premiums</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* TAB: Economic Calendar */}
            {activeTab === 'calendar' && (
                <div className="card" style={{ padding: 'var(--space-4)', overflowX: 'auto' }}>
                    <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>
                        📅 Upcoming Economic Events
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)' }}>Date</th>
                                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)' }}>Event</th>
                                <th style={{ textAlign: 'center', padding: '8px', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)' }}>Impact</th>
                                <th style={{ textAlign: 'right', padding: '8px', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)' }}>Forecast</th>
                                <th style={{ textAlign: 'right', padding: '8px', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)' }}>Previous</th>
                                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)' }}>Commodity Impact</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ECONOMIC_CALENDAR.map((event, idx) => {
                                const impColor = event.importance === 'high' ? '#ef4444' : event.importance === 'medium' ? '#f59e0b' : '#22c55e';

                                return (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                                        <td style={{ padding: '8px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                            <div style={{ fontWeight: 'var(--weight-bold)' }}>{event.date}</div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{event.time} ET</div>
                                        </td>
                                        <td style={{ padding: '8px', color: 'var(--text-primary)' }}>
                                            <span style={{ marginRight: '6px' }}>{event.flag}</span>
                                            {event.event}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                            <span style={{
                                                display: 'inline-flex',
                                                gap: '2px',
                                            }}>
                                                {[1, 2, 3].map(i => (
                                                    <span key={i} style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: '50%',
                                                        background: i <= (event.importance === 'high' ? 3 : event.importance === 'medium' ? 2 : 1) ? impColor : 'var(--bg-tertiary)',
                                                    }} />
                                                ))}
                                            </span>
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                                            {event.forecast ?? '—'}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                                            {event.previous ?? '—'}
                                        </td>
                                        <td style={{ padding: '8px', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                                            {event.commodityImpact}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </AppShell>
    );
}
