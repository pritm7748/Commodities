'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import { fetchOptionsChain, fetchNSEOptionsChain, OptionQuote, OptionsChainData } from '@/lib/services/priceService';

// Commodity ETFs (Yahoo Finance) + MCX Commodities (NSE India)
const FNO_COMMODITIES = [
    // MCX Commodities — options via MCX India direct API
    { id: 'mcx-gold', name: 'MCX Gold', ticker: 'GOLD', description: 'MCX Gold Options', source: 'nse' as const, currency: '₹', strikeInterval: 100 },
    { id: 'mcx-goldm', name: 'MCX Gold Mini', ticker: 'GOLDM', description: 'MCX Gold Mini Options', source: 'nse' as const, currency: '₹', strikeInterval: 100 },
    { id: 'mcx-silver', name: 'MCX Silver', ticker: 'SILVER', description: 'MCX Silver Options', source: 'nse' as const, currency: '₹', strikeInterval: 250 },
    { id: 'mcx-silverm', name: 'MCX Silver Mini', ticker: 'SILVERM', description: 'MCX Silver Mini Options', source: 'nse' as const, currency: '₹', strikeInterval: 250 },
    { id: 'mcx-silvermic', name: 'MCX Silver Micro', ticker: 'SILVERMIC', description: 'MCX Silver Micro Options', source: 'nse' as const, currency: '₹', strikeInterval: 250 },
    { id: 'mcx-crudeoil', name: 'MCX Crude Oil', ticker: 'CRUDEOIL', description: 'MCX Crude Oil Options', source: 'nse' as const, currency: '₹', strikeInterval: 50 },
    { id: 'mcx-crudeoilm', name: 'MCX Crude Oil Mini', ticker: 'CRUDEOILM', description: 'MCX Crude Oil Mini Options', source: 'nse' as const, currency: '₹', strikeInterval: 50 },
    { id: 'mcx-naturalgas', name: 'MCX Natural Gas', ticker: 'NATURALGAS', description: 'MCX Natural Gas Options', source: 'nse' as const, currency: '₹', strikeInterval: 5 },
    { id: 'mcx-natgasmini', name: 'MCX Natural Gas Mini', ticker: 'NATGASMINI', description: 'MCX Natural Gas Mini Options', source: 'nse' as const, currency: '₹', strikeInterval: 5 },
    { id: 'mcx-copper', name: 'MCX Copper', ticker: 'COPPER', description: 'MCX Copper Options', source: 'nse' as const, currency: '₹', strikeInterval: 5 },
    { id: 'mcx-zinc', name: 'MCX Zinc', ticker: 'ZINC', description: 'MCX Zinc Options', source: 'nse' as const, currency: '₹', strikeInterval: 2.5 },
    { id: 'mcx-nickel', name: 'MCX Nickel', ticker: 'NICKEL', description: 'MCX Nickel Options', source: 'nse' as const, currency: '₹', strikeInterval: 25 },
    // Global ETFs — options via Yahoo Finance
    { id: 'gld', name: 'Gold (GLD ETF)', ticker: 'GLD', description: 'SPDR Gold Shares', source: 'yahoo' as const, currency: '$' },
    { id: 'slv', name: 'Silver (SLV ETF)', ticker: 'SLV', description: 'iShares Silver Trust', source: 'yahoo' as const, currency: '$' },
    { id: 'uso', name: 'Crude Oil (USO ETF)', ticker: 'USO', description: 'United States Oil Fund', source: 'yahoo' as const, currency: '$' },
    { id: 'ung', name: 'Natural Gas (UNG ETF)', ticker: 'UNG', description: 'United States Natural Gas Fund', source: 'yahoo' as const, currency: '$' },
    { id: 'dba', name: 'Agriculture (DBA ETF)', ticker: 'DBA', description: 'Invesco DB Agriculture Fund', source: 'yahoo' as const, currency: '$' },
    { id: 'jjc', name: 'Copper (CPER ETF)', ticker: 'CPER', description: 'United States Copper Index Fund', source: 'yahoo' as const, currency: '$' },
    { id: 'corn', name: 'Corn (CORN ETF)', ticker: 'CORN', description: 'Teucrium Corn Fund', source: 'yahoo' as const, currency: '$' },
    { id: 'weat', name: 'Wheat (WEAT ETF)', ticker: 'WEAT', description: 'Teucrium Wheat Fund', source: 'yahoo' as const, currency: '$' },
    { id: 'soyb', name: 'Soybeans (SOYB ETF)', ticker: 'SOYB', description: 'Teucrium Soybean Fund', source: 'yahoo' as const, currency: '$' },
    { id: 'pplt', name: 'Platinum (PPLT ETF)', ticker: 'PPLT', description: 'abrdn Platinum ETF', source: 'yahoo' as const, currency: '$' },
];

export default function FnOPage() {
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [chainData, setChainData] = useState<OptionsChainData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showGreeks, setShowGreeks] = useState(false);
    const [selectedExpiry, setSelectedExpiry] = useState<string | null>(null);

    const selectedCommodity = FNO_COMMODITIES[selectedIdx];
    const currencySymbol = selectedCommodity.currency;
    const dataSource = selectedCommodity.source === 'nse' ? 'NSE India' : 'Yahoo Finance';

    // Fetch real options chain
    const loadOptionsChain = useCallback(async (ticker: string, source: 'yahoo' | 'nse', expiry?: string) => {
        setLoading(true);
        setError(null);

        try {
            let data: OptionsChainData | null = null;

            if (source === 'nse') {
                // MCX commodity options from NSE India
                data = await fetchNSEOptionsChain(ticker);
            } else {
                // Global ETF options from Yahoo Finance
                data = await fetchOptionsChain(ticker, expiry || undefined);
            }

            if (data && data.options.length > 0) {
                setChainData(data);
                if (!expiry && data.expirationDates.length > 0) {
                    setSelectedExpiry(data.expirationDates[0]);
                }
            } else {
                setError(`No options data available for ${ticker}. The market may be closed or options may not be available.`);
                setChainData(null);
            }
        } catch {
            setError('Failed to fetch options data. Please try again.');
            setChainData(null);
        }

        setLoading(false);
    }, []);

    // Load data when commodity changes
    useEffect(() => {
        setSelectedExpiry(null);
        loadOptionsChain(selectedCommodity.ticker, selectedCommodity.source);
    }, [selectedCommodity.ticker, selectedCommodity.source, loadOptionsChain]);

    // Reload when expiry changes
    useEffect(() => {
        if (selectedExpiry) {
            loadOptionsChain(selectedCommodity.ticker, selectedCommodity.source, selectedExpiry);
        }
    }, [selectedExpiry, selectedCommodity.ticker, selectedCommodity.source, loadOptionsChain]);

    const chain = chainData?.options || [];
    const spotPrice = chainData?.underlyingPrice || 0;

    // Stats
    const totalCallOI = chain.reduce((sum, o) => sum + o.callOI, 0);
    const totalPutOI = chain.reduce((sum, o) => sum + o.putOI, 0);
    const pcr = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : '—';

    // Max Pain: strike where combined buyer loss is minimized
    const maxPain = useMemo(() => {
        if (chain.length === 0) return 0;
        let minPain = Infinity;
        let painStrike = 0;

        for (const option of chain) {
            let totalPain = 0;
            for (const o of chain) {
                const callPain = o.callOI * Math.max(0, option.strike - o.strike);
                const putPain = o.putOI * Math.max(0, o.strike - option.strike);
                totalPain += callPain + putPain;
            }
            if (totalPain < minPain) {
                minPain = totalPain;
                painStrike = option.strike;
            }
        }
        return painStrike;
    }, [chain]);

    // OI distribution
    const maxCallOI = Math.max(...chain.map((o) => o.callOI), 1);
    const maxPutOI = Math.max(...chain.map((o) => o.putOI), 1);

    // Filter to show ±20 strikes around ATM and apply strike interval filter
    const visibleChain = useMemo(() => {
        if (chain.length === 0 || spotPrice === 0) return chain;

        // First, filter to strikes at proper intervals (e.g., Gold=100, Silver=250)
        const interval = (selectedCommodity as any).strikeInterval;
        let filtered = chain;
        if (interval) {
            filtered = chain.filter(o => {
                // Allow strikes that are multiples of the interval (within floating point tolerance)
                const remainder = o.strike % interval;
                return remainder < 0.01 || (interval - remainder) < 0.01;
            });
        }

        // Then show ±20 nearest ATM strikes
        const sorted = [...filtered].sort((a, b) => Math.abs(a.strike - spotPrice) - Math.abs(b.strike - spotPrice));
        const nearATM = sorted.slice(0, 40);
        return nearATM.sort((a, b) => a.strike - b.strike);
    }, [chain, spotPrice, selectedCommodity]);

    return (
        <AppShell title="F&O Chain" subtitle={`Commodity Options Chain — Live from ${dataSource}`}>
            {/* Controls */}
            <div className="fno-controls">
                <div className="fno-controls-left">
                    <select
                        className="select"
                        value={selectedIdx}
                        onChange={(e) => {
                            setSelectedIdx(Number(e.target.value));
                            setSelectedExpiry(null);
                        }}
                    >
                        <optgroup label="MCX Commodities (MCX India)">
                            {FNO_COMMODITIES.filter((c) => c.source === 'nse').map((c, i) => (
                                <option key={c.id} value={FNO_COMMODITIES.indexOf(c)}>{c.name}</option>
                            ))}
                        </optgroup>
                        <optgroup label="Global ETFs (Yahoo Finance)">
                            {FNO_COMMODITIES.filter((c) => c.source === 'yahoo').map((c, i) => (
                                <option key={c.id} value={FNO_COMMODITIES.indexOf(c)}>{c.name}</option>
                            ))}
                        </optgroup>
                    </select>

                    {chainData && chainData.expirationDates.length > 0 && (
                        <select
                            className="select"
                            value={selectedExpiry || ''}
                            onChange={(e) => setSelectedExpiry(e.target.value)}
                        >
                            {chainData.expirationDates.map((d) => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    )}

                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={showGreeks} onChange={(e) => setShowGreeks(e.target.checked)} />
                        Show IV
                    </label>
                </div>

                {!loading && chainData && (
                    <div className="fno-stats">
                        <div className="fno-stat">
                            <span className="fno-stat-label">Spot</span>
                            <span className="fno-stat-value">{currencySymbol}{spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="fno-stat">
                            <span className="fno-stat-label">PCR (OI)</span>
                            <span className="fno-stat-value">{pcr}</span>
                        </div>
                        <div className="fno-stat">
                            <span className="fno-stat-label">Max Pain</span>
                            <span className="fno-stat-value">{currencySymbol}{maxPain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="fno-stat">
                            <span className="fno-stat-label">Total Call OI</span>
                            <span className="fno-stat-value">{totalCallOI.toLocaleString()}</span>
                        </div>
                        <div className="fno-stat">
                            <span className="fno-stat-label">Total Put OI</span>
                            <span className="fno-stat-value">{totalPutOI.toLocaleString()}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Info banner */}
            {chainData?.marketClosed && chainData?.info && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'rgb(234, 179, 8)' }}>
                    🕐 {chainData.info}
                </div>
            )}
            {chainData?.source && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    ℹ️ Showing options for <strong style={{ color: 'var(--text-primary)', margin: '0 4px' }}>{selectedCommodity.description}</strong> ({selectedCommodity.ticker}) — {chainData.source}
                </div>
            )}
            {!chainData?.source && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    ℹ️ Showing options for <strong style={{ color: 'var(--text-primary)', margin: '0 4px' }}>{selectedCommodity.description}</strong> ({selectedCommodity.ticker}) — real-time data from {dataSource}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    ⏳ Loading options chain for {selectedCommodity.name}...
                </div>
            )}

            {/* Error */}
            {!loading && error && (
                <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    ⚠️ {error}
                </div>
            )}

            {/* Options Chain Table */}
            {!loading && !error && visibleChain.length > 0 && (
                <>
                    <div className="card" style={{ padding: 0, overflow: 'auto' }}>
                        <table className="data-table fno-table">
                            <thead>
                                <tr>
                                    <th colSpan={showGreeks ? 5 : 4} style={{ textAlign: 'center', color: 'var(--gain)', borderBottom: '2px solid var(--gain)' }}>CALLS</th>
                                    <th style={{ textAlign: 'center', background: 'var(--bg-elevated)', fontWeight: 'var(--weight-bold)' as any }}>STRIKE</th>
                                    <th colSpan={showGreeks ? 5 : 4} style={{ textAlign: 'center', color: 'var(--loss)', borderBottom: '2px solid var(--loss)' }}>PUTS</th>
                                </tr>
                                <tr>
                                    <th style={{ textAlign: 'right' }}>OI</th>
                                    <th style={{ textAlign: 'right' }}>Vol</th>
                                    <th style={{ textAlign: 'right' }}>LTP</th>
                                    <th style={{ textAlign: 'right' }}>Chg</th>
                                    {showGreeks && <th style={{ textAlign: 'right' }}>IV%</th>}
                                    <th style={{ textAlign: 'center', background: 'var(--bg-elevated)' }}></th>
                                    <th style={{ textAlign: 'right' }}>OI</th>
                                    <th style={{ textAlign: 'right' }}>Vol</th>
                                    <th style={{ textAlign: 'right' }}>LTP</th>
                                    <th style={{ textAlign: 'right' }}>Chg</th>
                                    {showGreeks && <th style={{ textAlign: 'right' }}>IV%</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {visibleChain.map((option) => {
                                    const isATM = spotPrice > 0 && Math.abs(option.strike - spotPrice) === Math.min(...visibleChain.map((o) => Math.abs(o.strike - spotPrice)));
                                    const isITMCall = option.strike < spotPrice;
                                    const isITMPut = option.strike > spotPrice;
                                    return (
                                        <tr key={option.strike} className={isATM ? 'fno-atm-row' : ''}>
                                            <td className="mono-cell" style={{ textAlign: 'right', background: isITMCall ? 'rgba(34,197,94,0.05)' : undefined }}>{option.callOI.toLocaleString()}</td>
                                            <td className="mono-cell" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{option.callVolume.toLocaleString()}</td>
                                            <td className="mono-cell" style={{ textAlign: 'right' }}>{option.callLTP.toFixed(2)}</td>
                                            <td className="mono-cell" style={{ textAlign: 'right' }}>
                                                <span className={option.callChange >= 0 ? 'text-gain' : 'text-loss'}>
                                                    {option.callChange >= 0 ? '+' : ''}{option.callChange.toFixed(2)}
                                                </span>
                                            </td>
                                            {showGreeks && (
                                                <td className="mono-cell" style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>{option.callIV.toFixed(1)}</td>
                                            )}
                                            <td style={{ textAlign: 'center', fontWeight: 'var(--weight-bold)' as any, background: 'var(--bg-elevated)', fontFamily: 'var(--font-mono)' }}>
                                                {option.strike.toFixed(2)}
                                            </td>
                                            <td className="mono-cell" style={{ textAlign: 'right', background: isITMPut ? 'rgba(239,68,68,0.05)' : undefined }}>{option.putOI.toLocaleString()}</td>
                                            <td className="mono-cell" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{option.putVolume.toLocaleString()}</td>
                                            <td className="mono-cell" style={{ textAlign: 'right' }}>{option.putLTP.toFixed(2)}</td>
                                            <td className="mono-cell" style={{ textAlign: 'right' }}>
                                                <span className={option.putChange >= 0 ? 'text-gain' : 'text-loss'}>
                                                    {option.putChange >= 0 ? '+' : ''}{option.putChange.toFixed(2)}
                                                </span>
                                            </td>
                                            {showGreeks && (
                                                <td className="mono-cell" style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>{option.putIV.toFixed(1)}</td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* OI Distribution */}
                    <div className="fno-oi-distribution">
                        <div className="card" style={{ flex: 1, padding: 'var(--space-3)' }}>
                            <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--gain)' }}>📗 Call OI Distribution</h4>
                            <div className="fno-oi-bars">
                                {visibleChain.filter((o) => o.callOI > 0).sort((a, b) => b.callOI - a.callOI).slice(0, 12).map((o) => (
                                    <div key={o.strike} className="fno-oi-bar-row">
                                        <span className="fno-oi-bar-label">{o.strike.toFixed(0)}</span>
                                        <div className="fno-oi-bar-track">
                                            <div className="fno-oi-bar call" style={{ width: `${(o.callOI / maxCallOI) * 100}%` }} />
                                        </div>
                                        <span className="fno-oi-bar-value">{(o.callOI / 1000).toFixed(1)}K</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="card" style={{ flex: 1, padding: 'var(--space-3)' }}>
                            <h4 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--loss)' }}>📕 Put OI Distribution</h4>
                            <div className="fno-oi-bars">
                                {visibleChain.filter((o) => o.putOI > 0).sort((a, b) => b.putOI - a.putOI).slice(0, 12).map((o) => (
                                    <div key={o.strike} className="fno-oi-bar-row">
                                        <span className="fno-oi-bar-label">{o.strike.toFixed(0)}</span>
                                        <div className="fno-oi-bar-track">
                                            <div className="fno-oi-bar put" style={{ width: `${(o.putOI / maxPutOI) * 100}%` }} />
                                        </div>
                                        <span className="fno-oi-bar-value">{(o.putOI / 1000).toFixed(1)}K</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {!loading && !error && visibleChain.length === 0 && (
                <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    📊 No options data returned for {selectedCommodity.name}. Market may be closed.
                </div>
            )}
        </AppShell>
    );
}
