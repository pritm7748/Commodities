'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import {
    SUPPLY_DEMAND,
    TOP_PRODUCERS,
    INVENTORY_DATA,
    TRADE_FLOWS,
    COMMODITY_COLORS,
    SupplyDemandItem,
} from '@/lib/data/fundamentals/supplyDemand';

// ── Types ─────────────────────────────────────────────────────

interface EIADataRow {
    period: string;
    value: number | null;
    product?: string;
    'product-name'?: string;
    process?: string;
    'process-name'?: string;
    series?: string;
    'series-description'?: string;
    duoarea?: string;
    'area-name'?: string;
    units?: string;
}

interface EIASection {
    title: string;
    icon: string;
    data: EIADataRow[];
    unit: string;
    description: string;
}

// ── Helpers ───────────────────────────────────────────────────
function formatNum(n: number, decimals = 1): string {
    if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toFixed(decimals);
}

function formatEIAValue(val: number | null, unit: string): string {
    if (val == null || isNaN(val)) return 'N/A';
    if (unit === 'Thousand Barrels' || unit === 'MBBL') {
        if (val >= 1000000) return `${(val / 1000).toFixed(0)}M bbl`;
        if (val >= 1000) return `${(val / 1000).toFixed(1)}M bbl`;
        return `${val.toFixed(0)}K bbl`;
    }
    if (unit === 'Thousand Barrels per Day' || unit === 'MBBLPD') {
        return `${(val / 1000).toFixed(2)}M bbl/d`;
    }
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toFixed(1);
}

function BalanceBar({ item }: { item: SupplyDemandItem }) {
    const total = Math.max(item.supply, item.demand);
    const supplyPct = (item.supply / total) * 100;
    const demandPct = (item.demand / total) * 100;
    const isDeficit = item.surplus < 0;
    const color = COMMODITY_COLORS[item.commodityId] || 'var(--brand-primary)';

    return (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <div>
                    <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>
                        {item.commodity}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{item.year} • {item.unit}</div>
                </div>
                <div style={{
                    padding: '2px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--weight-bold)',
                    fontFamily: 'var(--font-mono)',
                    background: isDeficit ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                    color: isDeficit ? 'var(--red)' : 'var(--green)',
                }}>
                    {isDeficit ? 'DEFICIT' : 'SURPLUS'} {formatNum(Math.abs(item.surplus))} {item.unit}
                </div>
            </div>

            {/* Supply bar */}
            <div style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '3px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Supply</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{formatNum(item.supply)} {item.unit}</span>
                </div>
                <div style={{ height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${supplyPct}%`, height: '100%', background: color, borderRadius: 4, opacity: 0.7, transition: 'width 0.5s ease' }} />
                </div>
            </div>

            {/* Demand bar */}
            <div style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '3px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Demand</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{formatNum(item.demand)} {item.unit}</span>
                </div>
                <div style={{ height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${demandPct}%`, height: '100%', background: isDeficit ? '#ef4444' : '#22c55e', borderRadius: 4, opacity: 0.7, transition: 'width 0.5s ease' }} />
                </div>
            </div>

            {/* Inventory weeks */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Inventory cover:</span>
                <span style={{
                    fontSize: 'var(--text-xs)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 'var(--weight-bold)',
                    color: item.inventoryWeeks < 5 ? '#ef4444' : item.inventoryWeeks < 10 ? '#f59e0b' : '#22c55e',
                }}>
                    {item.inventoryWeeks} weeks
                </span>
            </div>
        </div>
    );
}

function ProducerChart({ commodity }: { commodity: string }) {
    const data = TOP_PRODUCERS.find(p => p.commodity === commodity);
    if (!data) return null;

    const maxShare = Math.max(...data.producers.map(p => p.share));

    return (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>
                🏭 Top {data.commodity} Producers
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.producers.map((p, i) => (
                    <div key={p.country} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', width: 16, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', width: 85, flexShrink: 0 }}>{p.country}</span>
                        <div style={{ flex: 1, height: 18, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                            <div style={{
                                width: `${(p.share / maxShare) * 100}%`,
                                height: '100%',
                                background: `linear-gradient(90deg, ${COMMODITY_COLORS[data.commodityId] || 'var(--brand-primary)'}88, ${COMMODITY_COLORS[data.commodityId] || 'var(--brand-primary)'}44)`,
                                borderRadius: 4,
                                transition: 'width 0.5s ease',
                            }} />
                            <span style={{
                                position: 'absolute',
                                right: 6,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                fontSize: '10px',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-secondary)',
                            }}>
                                {p.share}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function InventoryPanel({ commodity }: { commodity: string }) {
    const data = INVENTORY_DATA.find(i => i.commodity === commodity);
    if (!data) return null;

    return (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>
                🏗️ {data.commodity} Inventories
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.warehouses.map(w => (
                    <div key={w.name} style={{
                        padding: 'var(--space-2) var(--space-3)',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{w.name}</span>
                            <span style={{
                                fontSize: 'var(--text-xs)',
                                fontWeight: 'var(--weight-bold)',
                                fontFamily: 'var(--font-mono)',
                                color: w.change < 0 ? '#ef4444' : '#22c55e',
                            }}>
                                {w.change > 0 ? '+' : ''}{formatNum(w.change)} {w.unit}
                            </span>
                        </div>
                        <div style={{
                            fontSize: 'var(--text-base)',
                            fontWeight: 'var(--weight-bold)',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-primary)',
                            marginTop: '2px',
                        }}>
                            {formatNum(w.stocks)} {w.unit}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TradeFlowPanel({ commodity }: { commodity: string }) {
    const data = TRADE_FLOWS.find(t => t.commodity === commodity);
    if (!data) return null;

    const maxVol = Math.max(...data.flows.map(f => f.volume));

    return (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>
                🌐 {data.commodity} Trade Flows
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.flows.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', width: 70, flexShrink: 0, textAlign: 'right' }}>{f.from}</span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>→</span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', width: 70, flexShrink: 0 }}>{f.to}</span>
                        <div style={{ flex: 1, height: 14, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                            <div style={{
                                width: `${(f.volume / maxVol) * 100}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, var(--brand-primary), var(--brand-primary-transparent))',
                                borderRadius: 3,
                                transition: 'width 0.5s ease',
                            }} />
                        </div>
                        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', width: 60, flexShrink: 0, textAlign: 'right' }}>
                            {formatNum(f.volume)} {f.unit}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── EIA Live Energy Dashboard ─────────────────────────────────

function EIALiveDashboard() {
    const [sections, setSections] = useState<EIASection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchAllEIA = useCallback(async () => {
        setLoading(true);
        setError('');

        // Define multiple EIA data fetches
        const queries = [
            {
                title: 'US Crude Oil Stocks (Weekly)',
                icon: '🛢️',
                url: '/api/data/eia?endpoint=petroleum/stoc/wstk/data&frequency=weekly&limit=8&data=value',
                unit: 'Thousand Barrels',
                description: 'US commercial crude oil and petroleum product inventories',
            },
            {
                title: 'US Crude Oil Production',
                icon: '⛽',
                url: '/api/data/eia?endpoint=petroleum/crd/crpdn/data&frequency=monthly&limit=6&data=value',
                unit: 'Thousand Barrels per Day',
                description: 'US field production of crude oil',
            },
            {
                title: 'Natural Gas Storage',
                icon: '🔥',
                url: '/api/data/eia?endpoint=natural-gas/stor/wkly/data&frequency=weekly&limit=8&data=value',
                unit: 'Billion Cubic Feet',
                description: 'US working natural gas in underground storage',
            },
        ];

        const results: EIASection[] = [];

        const settled = await Promise.allSettled(
            queries.map(async (q) => {
                const res = await fetch(q.url);
                const json = await res.json();
                if (json.error) throw new Error(json.error);
                const rows: EIADataRow[] = json?.response?.data || [];
                return { ...q, data: rows };
            })
        );

        for (const r of settled) {
            if (r.status === 'fulfilled' && r.value.data.length > 0) {
                results.push(r.value);
            }
        }

        if (results.length === 0) {
            setError('No EIA data available — ensure EIA_API_KEY is set in .env.local');
        }

        setSections(results);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchAllEIA();
    }, [fetchAllEIA]);

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {[1, 2, 3].map(i => (
                    <div key={i} className="card" style={{ padding: 'var(--space-5)', opacity: 0.5 }}>
                        <div style={{ height: 20, background: 'var(--bg-tertiary)', borderRadius: 4, marginBottom: 12, width: '40%' }} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
                            {[1, 2, 3].map(j => (
                                <div key={j} style={{ height: 60, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>📊</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{error}</div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {sections.map(section => {
                // Group data by product/series name
                const grouped: Record<string, EIADataRow[]> = {};
                section.data.forEach(row => {
                    const label = row['product-name'] || row['series-description'] || row['process-name'] || row.product || row.series || row.process || 'Total';
                    if (!grouped[label]) grouped[label] = [];
                    grouped[label].push(row);
                });

                // Take only top items (most data points or most significant)
                const groupEntries = Object.entries(grouped)
                    .sort((a, b) => b[1].length - a[1].length)
                    .slice(0, 8);

                return (
                    <div key={section.title}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                            <span style={{ fontSize: '1.2rem' }}>{section.icon}</span>
                            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', margin: 0 }}>
                                {section.title}
                            </h3>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                                {section.description}
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
                            {groupEntries.map(([label, rows]) => {
                                // Sort by period descending
                                const sorted = [...rows].sort((a, b) => (b.period || '').localeCompare(a.period || ''));
                                const latest = sorted[0];
                                const prev = sorted.length > 1 ? sorted[1] : null;

                                const latestVal = latest?.value != null ? Number(latest.value) : null;
                                const prevVal = prev?.value != null ? Number(prev.value) : null;

                                const change = latestVal != null && prevVal != null ? latestVal - prevVal : 0;
                                const changePct = prevVal && prevVal !== 0 ? (change / prevVal) * 100 : 0;

                                const unitLabel = latest?.units || section.unit;

                                return (
                                    <div key={label} className="card" style={{ padding: 'var(--space-4)' }}>
                                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: '2px', lineHeight: 1.3 }}>
                                            {label}
                                        </div>
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }}>
                                            {latest?.period || '—'} • {latest?.['area-name'] || 'US'}
                                        </div>

                                        {latestVal != null ? (
                                            <>
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                                                    <span style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-black)', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                                                        {formatEIAValue(latestVal, unitLabel)}
                                                    </span>
                                                    {prevVal != null && (
                                                        <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-bold)', color: change > 0 ? '#22c55e' : change < 0 ? '#ef4444' : 'var(--text-tertiary)' }}>
                                                            {change > 0 ? '▲' : change < 0 ? '▼' : '—'} {Math.abs(changePct).toFixed(1)}%
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Mini bar chart */}
                                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, marginTop: 'var(--space-2)', height: 28 }}>
                                                    {sorted.slice(0, 6).reverse().map((pt, i, arr) => {
                                                        const vals = arr.map(p => Number(p.value) || 0);
                                                        const minV = Math.min(...vals);
                                                        const maxV = Math.max(...vals);
                                                        const range = maxV - minV || 1;
                                                        const h = (((Number(pt.value) || 0) - minV) / range) * 100;
                                                        return (
                                                            <div key={i} style={{
                                                                flex: 1,
                                                                height: `${Math.max(h, 10)}%`,
                                                                background: i === arr.length - 1 ? 'var(--brand-primary)' : 'var(--bg-tertiary)',
                                                                borderRadius: 2,
                                                            }} />
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        ) : (
                                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>No data</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── USDA Live Agricultural Data ────────────────────────────

interface USDARow {
    commodity: string;
    commodityCode: string;
    marketYear: number;
    unit: string;
    production: number;
    consumption: number;
    exports: number;
    imports: number;
    beginningStocks: number;
    endingStocks: number;
    surplus: number;
    stocksToUseRatio: string;
    source?: string;
}

function USDALiveDashboard() {
    const [data, setData] = useState<USDARow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [apiNote, setApiNote] = useState('');
    const [dataSource, setDataSource] = useState<string>('');
    const [marketYear, setMarketYear] = useState(new Date().getFullYear());

    useEffect(() => {
        setLoading(true);
        setError('');
        setApiNote('');
        fetch(`/api/data/usda?endpoint=all-commodities-summary&year=${marketYear}`)
            .then(res => res.json())
            .then(json => {
                if (json.status === 'success' && json.commodities) {
                    setData(json.commodities);
                    setDataSource(json.source || 'reference');
                    if (json.note) setApiNote(json.note);
                } else {
                    setError(json.message || json.error || 'No data returned');
                }
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [marketYear]);

    const fmtK = (n: number) => {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
        return n.toFixed(0);
    };

    return (
        <div>
            {/* Year selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Market Year:</span>
                <div className="filter-toggle">
                    {[marketYear - 1, marketYear, marketYear + 1].map(yr => (
                        <button
                            key={yr}
                            className={`filter-btn ${yr === marketYear ? 'active' : ''}`}
                            onClick={() => setMarketYear(yr)}
                        >
                            {yr}/{yr + 1}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-3)' }}>
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} className="card" style={{ padding: 'var(--space-4)', opacity: 0.5 }}>
                            <div style={{ height: 20, background: 'var(--bg-tertiary)', borderRadius: 4, marginBottom: 12, width: '60%' }} />
                            <div style={{ height: 32, background: 'var(--bg-tertiary)', borderRadius: 4, marginBottom: 8, width: '45%' }} />
                            <div style={{ height: 14, background: 'var(--bg-tertiary)', borderRadius: 4, width: '90%' }} />
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>⚠️</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{error}</div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)' }}>
                        Ensure USDA_API_KEY is set in .env.local
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-3)' }}>
                    {data.map(row => {
                        const deficit = row.surplus < 0;
                        const supplyTotal = row.production + row.imports;
                        const demandTotal = row.consumption + row.exports;
                        const maxBar = Math.max(supplyTotal, demandTotal);
                        const supplyPct = maxBar > 0 ? (supplyTotal / maxBar) * 100 : 50;
                        const demandPct = maxBar > 0 ? (demandTotal / maxBar) * 100 : 50;

                        return (
                            <div key={row.commodity} className="card" style={{ padding: 'var(--space-4)' }}>
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                                    <div>
                                        <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>
                                            {row.commodity}
                                        </div>
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                            {row.source === 'live' ? '🟢 USDA PSD Live' : '📊 USDA WASDE'} • {row.marketYear}/{row.marketYear + 1} • {row.unit}
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: 'var(--text-xs)',
                                        fontWeight: 'var(--weight-bold)',
                                        padding: '2px 8px',
                                        borderRadius: 'var(--radius-full)',
                                        background: deficit ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                                        color: deficit ? '#ef4444' : '#22c55e',
                                    }}>
                                        {deficit ? 'DEFICIT' : 'SURPLUS'}
                                    </span>
                                </div>

                                {/* Supply/Demand bars */}
                                <div style={{ marginBottom: 'var(--space-3)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: 4 }}>
                                        <span style={{ color: '#22c55e' }}>Supply: {fmtK(supplyTotal)}</span>
                                        <span style={{ color: '#ef4444' }}>Demand: {fmtK(demandTotal)}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4, height: 8, borderRadius: 4, overflow: 'hidden' }}>
                                        <div style={{ width: `${supplyPct}%`, background: '#22c55e', borderRadius: 4, transition: 'width 0.5s' }} />
                                        <div style={{ width: `${demandPct}%`, background: '#ef4444', borderRadius: 4, transition: 'width 0.5s' }} />
                                    </div>
                                </div>

                                {/* Key metrics grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 'var(--text-xs)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-tertiary)' }}>Production</span>
                                        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{fmtK(row.production)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-tertiary)' }}>Consumption</span>
                                        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{fmtK(row.consumption)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-tertiary)' }}>Exports</span>
                                        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{fmtK(row.exports)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-tertiary)' }}>Imports</span>
                                        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{fmtK(row.imports)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-tertiary)' }}>End Stocks</span>
                                        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{fmtK(row.endingStocks)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-tertiary)' }}>Stk/Use Ratio</span>
                                        <span style={{
                                            fontFamily: 'var(--font-mono)',
                                            fontWeight: 'var(--weight-bold)',
                                            color: parseFloat(row.stocksToUseRatio) < 15 ? '#ef4444' :
                                                parseFloat(row.stocksToUseRatio) < 25 ? '#f59e0b' : '#22c55e',
                                        }}>
                                            {row.stocksToUseRatio}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Data Source Note */}
            {!loading && !error && (
                <div className="card" style={{
                    padding: 'var(--space-4)',
                    marginTop: 'var(--space-4)',
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.06), rgba(59, 130, 246, 0.04))',
                    borderColor: 'rgba(34, 197, 94, 0.2)',
                }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                        {dataSource === 'live' ? '🟢' : '📊'} <strong>{dataSource === 'live' ? 'USDA Live Data' : 'USDA WASDE Estimates'}</strong> — {apiNote || `Production, Supply & Distribution data from USDA Foreign Agricultural Service. Values in ${data[0]?.unit || '1000 MT'}.`}
                        {' '}Stocks-to-use ratio below 15% = tight market (bullish), above 25% = comfortable (bearish).
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────

const COMMODITIES = Array.from(new Set(SUPPLY_DEMAND.map(s => s.commodity)));

export default function DemandSupplyPage() {
    const [selectedCommodity, setSelectedCommodity] = useState('Gold');
    const [activeTab, setActiveTab] = useState<'overview' | 'producers' | 'inventory' | 'trade' | 'eia-live' | 'usda-live'>('overview');

    const sdItem = useMemo(() => SUPPLY_DEMAND.find(s => s.commodity === selectedCommodity), [selectedCommodity]);

    // Stats
    const deficits = SUPPLY_DEMAND.filter(s => s.surplus < 0).length;
    const surpluses = SUPPLY_DEMAND.filter(s => s.surplus >= 0).length;
    const tightest = [...SUPPLY_DEMAND].sort((a, b) => a.inventoryWeeks - b.inventoryWeeks)[0];

    return (
        <AppShell title="Demand & Supply" subtitle="Global Commodity Supply Chain Analysis">
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
                gap: 'var(--space-2)',
            }}>
                <span style={{ fontSize: '1rem' }}>🟢</span>
                <span>
                    <strong>Live + Reference Data</strong> — EIA Live shows real-time US petroleum data. USDA Live shows agricultural supply/demand from USDA PSD API.
                    Overview tab uses industry reference data (USGS, WGC, IEA, ICSG).
                </span>
            </div>
            {/* Stats Bar */}
            <div className="stats-bar" style={{ marginBottom: 'var(--space-4)' }}>
                <div className="stat-item">
                    <span className="stat-label">Commodities Tracked</span>
                    <span className="stat-value">{SUPPLY_DEMAND.length}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">In Deficit</span>
                    <span className="stat-value text-loss">{deficits}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">In Surplus</span>
                    <span className="stat-value text-gain">{surpluses}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Tightest Market</span>
                    <span className="stat-value" style={{ color: '#ef4444' }}>{tightest?.commodity} ({tightest?.inventoryWeeks}w)</span>
                </div>
            </div>

            {/* Tabs + Commodity selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div className="filter-toggle">
                    {(['overview', 'eia-live', 'usda-live', 'producers', 'inventory', 'trade'] as const).map(tab => (
                        <button
                            key={tab}
                            className={`filter-btn ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'overview' ? '📊 Overview' : tab === 'eia-live' ? '🛢️ EIA Live' : tab === 'usda-live' ? '🌾 USDA Live' : tab === 'producers' ? '🏭 Producers' : tab === 'inventory' ? '🏗️ Inventory' : '🌐 Trade'}
                        </button>
                    ))}
                </div>

                {activeTab !== 'overview' && activeTab !== 'eia-live' && activeTab !== 'usda-live' && (
                    <select
                        className="select"
                        value={selectedCommodity}
                        onChange={e => setSelectedCommodity(e.target.value)}
                        style={{ fontSize: 'var(--text-sm)', padding: '6px 12px' }}
                    >
                        {COMMODITIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* TAB: Overview — all balances */}
            {activeTab === 'overview' && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                    gap: 'var(--space-3)',
                }}>
                    {SUPPLY_DEMAND.map(item => (
                        <BalanceBar key={item.commodityId} item={item} />
                    ))}
                </div>
            )}

            {/* TAB: EIA Live — Real-time energy data */}
            {activeTab === 'eia-live' && (
                <EIALiveDashboard />
            )}

            {/* TAB: USDA Live — Agricultural supply/demand from USDA PSD */}
            {activeTab === 'usda-live' && (
                <USDALiveDashboard />
            )}

            {/* TAB: Producers */}
            {activeTab === 'producers' && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
                    gap: 'var(--space-4)',
                }}>
                    <ProducerChart commodity={selectedCommodity} />
                    {sdItem && <BalanceBar item={sdItem} />}
                </div>
            )}

            {/* TAB: Inventory */}
            {activeTab === 'inventory' && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                    gap: 'var(--space-4)',
                }}>
                    <InventoryPanel commodity={selectedCommodity} />
                    {sdItem && <BalanceBar item={sdItem} />}
                </div>
            )}

            {/* TAB: Trade Flows */}
            {activeTab === 'trade' && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
                    gap: 'var(--space-4)',
                }}>
                    <TradeFlowPanel commodity={selectedCommodity} />
                    {sdItem && <BalanceBar item={sdItem} />}
                </div>
            )}
        </AppShell>
    );
}
