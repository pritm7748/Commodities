'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import AppShell from '@/components/layout/AppShell';
import { ALL_COMMODITIES } from '@/lib/data/commodities';
import {
    createChart,
    IChartApi,
    ColorType,
    LineSeries,
    HistogramSeries,
    Time,
} from 'lightweight-charts';
import { fetchOIHistory, OIHistoryPoint } from '@/lib/services/priceService';

// Commodities with Yahoo tickers — we use volume as OI proxy
const OI_COMMODITIES = [
    { id: 'gold-comex', name: 'Gold (COMEX)', ticker: 'GC=F' },
    { id: 'silver-comex', name: 'Silver (COMEX)', ticker: 'SI=F' },
    { id: 'crude-wti', name: 'Crude Oil WTI', ticker: 'CL=F' },
    { id: 'crude-brent', name: 'Brent Crude', ticker: 'BZ=F' },
    { id: 'natgas-henry', name: 'Natural Gas', ticker: 'NG=F' },
    { id: 'copper-lme', name: 'Copper', ticker: 'HG=F' },
    { id: 'corn-cbot', name: 'Corn (CBOT)', ticker: 'ZC=F' },
    { id: 'soybeans-cbot', name: 'Soybeans (CBOT)', ticker: 'ZS=F' },
    { id: 'wheat-cbot', name: 'Wheat (CBOT)', ticker: 'ZW=F' },
];

interface EnrichedOIPoint extends OIHistoryPoint {
    priceChange: number;
    volumeChange: number;
    buildup: 'long_buildup' | 'short_buildup' | 'long_unwinding' | 'short_covering';
}

function classifyBuildup(priceChange: number, volumeChange: number): EnrichedOIPoint['buildup'] {
    if (priceChange > 0 && volumeChange > 0) return 'long_buildup';
    if (priceChange < 0 && volumeChange > 0) return 'short_buildup';
    if (priceChange < 0 && volumeChange < 0) return 'long_unwinding';
    return 'short_covering';
}

const BUILDUP_META: Record<string, { label: string; color: string; icon: string; desc: string }> = {
    long_buildup: { label: 'Long Buildup', color: '#22c55e', icon: '🟢', desc: 'Price ↑ + Volume ↑ = Bullish' },
    short_buildup: { label: 'Short Buildup', color: '#ef4444', icon: '🔴', desc: 'Price ↓ + Volume ↑ = Bearish' },
    long_unwinding: { label: 'Long Unwinding', color: '#f97316', icon: '🟠', desc: 'Price ↓ + Volume ↓ = Weak Bulls' },
    short_covering: { label: 'Short Covering', color: '#0ea5e9', icon: '🔵', desc: 'Price ↑ + Volume ↓ = Weak Bears' },
};

function enrichData(raw: OIHistoryPoint[]): EnrichedOIPoint[] {
    return raw.map((point, i) => {
        const prev = i > 0 ? raw[i - 1] : point;
        const priceChange = point.price - prev.price;
        const volumeChange = point.volume - prev.volume;
        return {
            ...point,
            priceChange,
            volumeChange,
            buildup: classifyBuildup(priceChange, volumeChange),
        };
    });
}

export default function OIPage() {
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [data, setData] = useState<EnrichedOIPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    const selectedCommodity = OI_COMMODITIES[selectedIdx];

    // Fetch real data
    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        fetchOIHistory(selectedCommodity.ticker).then((raw) => {
            if (!cancelled) {
                setData(enrichData(raw));
                setLoading(false);
            }
        });

        return () => { cancelled = true; };
    }, [selectedCommodity.ticker]);

    // Buildup distribution
    const buildupCounts = useMemo(() => {
        const counts: Record<string, number> = { long_buildup: 0, short_buildup: 0, long_unwinding: 0, short_covering: 0 };
        data.forEach((d) => counts[d.buildup]++);
        return counts;
    }, [data]);

    const latestBuildup = data[data.length - 1]?.buildup || 'long_buildup';
    const totalDays = data.length;

    // Chart: Price vs Volume (dual axis)
    useEffect(() => {
        if (!chartContainerRef.current || data.length === 0) return;

        const safeRemove = () => {
            if (chartRef.current) {
                try { chartRef.current.remove(); } catch { /* disposed */ }
                chartRef.current = null;
            }
        };
        safeRemove();

        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 360,
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#9ca3b4',
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
            },
            grid: {
                vertLines: { color: 'rgba(255,255,255,0.04)' },
                horzLines: { color: 'rgba(255,255,255,0.04)' },
            },
            rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
            timeScale: { borderColor: 'rgba(255,255,255,0.06)' },
        });
        chartRef.current = chart;

        // Price line
        const priceSeries = chart.addSeries(LineSeries, {
            color: '#6366f1',
            lineWidth: 2,
            title: 'Price',
            priceScaleId: 'price',
        });
        priceSeries.setData(data.map((d) => ({ time: d.date as Time, value: d.price })));

        // Volume line
        const volumeSeries = chart.addSeries(LineSeries, {
            color: '#22c55e',
            lineWidth: 2,
            title: 'Volume',
            priceScaleId: 'volume',
        });
        volumeSeries.setData(data.map((d) => ({ time: d.date as Time, value: d.volume })));

        chart.priceScale('price').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.3 } });
        chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.3 } });

        // Volume change histogram
        const volumeChangeSeries = chart.addSeries(HistogramSeries, {
            priceScaleId: 'volchange',
            title: 'Vol Change',
        });
        chart.priceScale('volchange').applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
        });
        volumeChangeSeries.setData(data.map((d) => ({
            time: d.date as Time,
            value: d.volumeChange,
            color: d.volumeChange >= 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
        })));

        chart.timeScale().fitContent();

        const handleResize = () => {
            try {
                if (chartContainerRef.current && chartRef.current) {
                    chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
                }
            } catch { /* chart disposed */ }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            safeRemove();
        };
    }, [data]);

    return (
        <AppShell title="Open Interest" subtitle="OI Analysis & Buildup Classification — Live Data">
            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                <select
                    className="select"
                    value={selectedIdx}
                    onChange={(e) => setSelectedIdx(Number(e.target.value))}
                >
                    {OI_COMMODITIES.map((c, i) => (
                        <option key={c.id} value={i}>{c.name}</option>
                    ))}
                </select>

                {!loading && data.length > 0 && (
                    <div className="oi-current-buildup">
                        Current Buildup:{' '}
                        <span style={{ color: BUILDUP_META[latestBuildup].color, fontWeight: 700 }}>
                            {BUILDUP_META[latestBuildup].icon} {BUILDUP_META[latestBuildup].label}
                        </span>
                    </div>
                )}
            </div>

            {loading && (
                <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    ⏳ Loading market data for {selectedCommodity.name}...
                </div>
            )}

            {!loading && data.length === 0 && (
                <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    ⚠️ No historical data available for {selectedCommodity.name}
                </div>
            )}

            {!loading && data.length > 0 && (
                <>
                    {/* Buildup Distribution Cards */}
                    <div className="oi-buildup-grid">
                        {Object.entries(BUILDUP_META).map(([key, meta]) => {
                            const count = buildupCounts[key] || 0;
                            const pct = totalDays ? ((count / totalDays) * 100).toFixed(0) : '0';
                            return (
                                <div key={key} className="oi-buildup-card" style={{ borderLeftColor: meta.color }}>
                                    <div className="oi-buildup-card-header">
                                        <span>{meta.icon} {meta.label}</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{pct}%</span>
                                    </div>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{meta.desc}</div>
                                    <div className="oi-buildup-bar" style={{ marginTop: 'var(--space-2)' }}>
                                        <div style={{ width: `${pct}%`, height: 4, borderRadius: 2, background: meta.color }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Price vs Volume Chart */}
                    <div className="card" style={{ padding: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                            <h3 style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                                📈 Price vs Volume — {selectedCommodity.name}
                            </h3>
                            <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-xs)' }}>
                                <span style={{ color: '#6366f1' }}>━ Price</span>
                                <span style={{ color: '#22c55e' }}>━ Volume</span>
                                <span style={{ color: 'var(--text-tertiary)' }}>▮ Vol Change</span>
                            </div>
                        </div>
                        <div ref={chartContainerRef} style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }} />
                    </div>

                    {/* Recent Data Table */}
                    <div className="card" style={{ padding: 0, overflow: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th style={{ textAlign: 'right' }}>Price</th>
                                    <th style={{ textAlign: 'right' }}>Change</th>
                                    <th style={{ textAlign: 'right' }}>Volume</th>
                                    <th style={{ textAlign: 'right' }}>Vol Change</th>
                                    <th>Buildup</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.slice(-15).reverse().map((d) => {
                                    const meta = BUILDUP_META[d.buildup];
                                    return (
                                        <tr key={d.date}>
                                            <td>{d.date}</td>
                                            <td className="mono-cell" style={{ textAlign: 'right' }}>
                                                {d.price.toFixed(2)}
                                            </td>
                                            <td className="mono-cell" style={{ textAlign: 'right' }}>
                                                <span className={d.priceChange >= 0 ? 'text-gain' : 'text-loss'}>
                                                    {d.priceChange >= 0 ? '+' : ''}{d.priceChange.toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="mono-cell" style={{ textAlign: 'right' }}>
                                                {d.volume.toLocaleString()}
                                            </td>
                                            <td className="mono-cell" style={{ textAlign: 'right' }}>
                                                <span className={d.volumeChange >= 0 ? 'text-gain' : 'text-loss'}>
                                                    {d.volumeChange >= 0 ? '+' : ''}{d.volumeChange.toLocaleString()}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="oi-buildup-badge" style={{ color: meta.color, borderColor: meta.color }}>
                                                    {meta.icon} {meta.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </AppShell>
    );
}
