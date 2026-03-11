'use client';

import { useState, useMemo, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import CommodityChart, { ChartDataPoint } from '@/components/charts/CommodityChart';
import { ALL_COMMODITIES, SECTOR_META, CommoditySpec } from '@/lib/data/commodities';
import { fetchHistoricalData, OHLCVPoint } from '@/lib/services/priceService';

type ChartType = 'candlestick' | 'line' | 'area';
type Indicator = 'sma20' | 'sma50' | 'ema20' | 'bollinger' | 'rsi' | 'macd' | 'volume';

const TIMEFRAMES = ['1W', '1M', '3M', '6M', '1Y'] as const;
const CHART_TYPES: { id: ChartType; label: string; icon: string }[] = [
    { id: 'candlestick', label: 'Candles', icon: '🕯' },
    { id: 'line', label: 'Line', icon: '📈' },
    { id: 'area', label: 'Area', icon: '📊' },
];

const AVAILABLE_INDICATORS: { id: Indicator; label: string; group: string }[] = [
    { id: 'sma20', label: 'SMA 20', group: 'Moving Averages' },
    { id: 'sma50', label: 'SMA 50', group: 'Moving Averages' },
    { id: 'ema20', label: 'EMA 20', group: 'Moving Averages' },
    { id: 'bollinger', label: 'Bollinger Bands', group: 'Bands' },
    { id: 'rsi', label: 'RSI (14)', group: 'Oscillators' },
    { id: 'macd', label: 'MACD', group: 'Oscillators' },
    { id: 'volume', label: 'Volume', group: 'Volume' },
];

function tfToDays(tf: string): number {
    return { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }[tf] || 180;
}

export default function ChartingPage() {
    const [selectedCommodity, setSelectedCommodity] = useState<CommoditySpec>(ALL_COMMODITIES[0]);
    const [chartType, setChartType] = useState<ChartType>('candlestick');
    const [activeIndicators, setActiveIndicators] = useState<Indicator[]>(['volume']);
    const [timeframe, setTimeframe] = useState<typeof TIMEFRAMES[number]>('6M');
    const [showIndicatorPanel, setShowIndicatorPanel] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch real historical data
    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        const load = async () => {
            const days = tfToDays(timeframe);
            const data = await fetchHistoricalData(selectedCommodity.id, '1day', days);

            if (!cancelled) {
                setChartData(data.map((d) => ({
                    time: d.time,
                    open: d.open,
                    high: d.high,
                    low: d.low,
                    close: d.close,
                    volume: d.volume,
                })));
                setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [selectedCommodity.id, timeframe]);

    const filteredCommodities = useMemo(() => {
        if (!searchQuery.trim()) return ALL_COMMODITIES;
        const q = searchQuery.toLowerCase();
        return ALL_COMMODITIES.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                c.symbol.toLowerCase().includes(q) ||
                c.exchange.toLowerCase().includes(q)
        );
    }, [searchQuery]);

    const toggleIndicator = (ind: Indicator) => {
        setActiveIndicators((prev) =>
            prev.includes(ind) ? prev.filter((i) => i !== ind) : [...prev, ind]
        );
    };

    const lastBar = chartData[chartData.length - 1];
    const prevBar = chartData[chartData.length - 2];
    const priceChange = lastBar && prevBar ? lastBar.close - prevBar.close : 0;
    const priceChangePercent = prevBar ? (priceChange / prevBar.close) * 100 : 0;

    return (
        <AppShell title="Charts" subtitle="Advanced Technical Analysis">
            <div className="chart-page-layout">
                {/* Commodity selector sidebar */}
                <div className="chart-selector-panel">
                    <input
                        type="text"
                        className="input"
                        placeholder="Search commodities..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ marginBottom: 'var(--space-2)' }}
                    />
                    <div className="chart-commodity-list">
                        {filteredCommodities.map((c) => (
                            <button
                                key={c.id}
                                className={`chart-commodity-item ${selectedCommodity.id === c.id ? 'active' : ''}`}
                                onClick={() => setSelectedCommodity(c)}
                            >
                                <span className="chart-commodity-item-icon">
                                    {SECTOR_META[c.sector].icon}
                                </span>
                                <div>
                                    <div className="chart-commodity-item-name">{c.name}</div>
                                    <div className="chart-commodity-item-exchange">{c.exchange}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main chart area */}
                <div className="chart-main-area">
                    {/* Chart header */}
                    <div className="chart-header-bar">
                        <div className="chart-header-info">
                            <span className="chart-header-icon">
                                {SECTOR_META[selectedCommodity.sector].icon}
                            </span>
                            <div>
                                <h2 className="chart-header-title">
                                    {selectedCommodity.name}
                                    <span className="chart-header-exchange">{selectedCommodity.exchange}</span>
                                </h2>
                                <div className="chart-header-price-row">
                                    {lastBar ? (
                                        <>
                                            <span className="chart-header-price">
                                                {selectedCommodity.currency === 'INR' ? '₹' : '$'}
                                                {lastBar.close.toFixed(2)}
                                            </span>
                                            <span className={`chart-header-change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
                                                {priceChange >= 0 ? '▲' : '▼'}{' '}
                                                {Math.abs(priceChange).toFixed(2)} ({priceChangePercent >= 0 ? '+' : ''}
                                                {priceChangePercent.toFixed(2)}%)
                                            </span>
                                        </>
                                    ) : loading ? (
                                        <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>Loading...</span>
                                    ) : (
                                        <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>No data available</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="chart-header-controls">
                            <div className="filter-toggle">
                                {TIMEFRAMES.map((tf) => (
                                    <button
                                        key={tf}
                                        className={`filter-btn ${timeframe === tf ? 'active' : ''}`}
                                        onClick={() => setTimeframe(tf)}
                                    >
                                        {tf}
                                    </button>
                                ))}
                            </div>

                            <div className="filter-toggle">
                                {CHART_TYPES.map((ct) => (
                                    <button
                                        key={ct.id}
                                        className={`filter-btn ${chartType === ct.id ? 'active' : ''}`}
                                        onClick={() => setChartType(ct.id)}
                                        title={ct.label}
                                    >
                                        {ct.icon}
                                    </button>
                                ))}
                            </div>

                            <button
                                className={`btn btn-sm ${showIndicatorPanel ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setShowIndicatorPanel(!showIndicatorPanel)}
                            >
                                📐 Indicators ({activeIndicators.length})
                            </button>
                        </div>
                    </div>

                    {showIndicatorPanel && (
                        <div className="indicator-panel animate-fade-in">
                            {AVAILABLE_INDICATORS.map((ind) => (
                                <button
                                    key={ind.id}
                                    className={`indicator-chip ${activeIndicators.includes(ind.id) ? 'active' : ''}`}
                                    onClick={() => toggleIndicator(ind.id)}
                                >
                                    {activeIndicators.includes(ind.id) && <span style={{ marginRight: 4 }}>✓</span>}
                                    {ind.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Chart */}
                    <div className="card" style={{ padding: 'var(--space-3)' }}>
                        {loading && chartData.length === 0 ? (
                            <div style={{ height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                                <span>⏳ Loading chart data from API...</span>
                            </div>
                        ) : chartData.length === 0 ? (
                            <div style={{ height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                                <span>📊 No historical data available for {selectedCommodity.name}. Requires Twelve Data or Yahoo Finance ticker.</span>
                            </div>
                        ) : (
                            <CommodityChart
                                commodity={selectedCommodity}
                                data={chartData}
                                chartType={chartType}
                                indicators={activeIndicators}
                                height={480}
                            />
                        )}
                    </div>

                    {/* Chart stats */}
                    {lastBar && (
                        <div className="chart-stats-bar">
                            <div className="chart-stat">
                                <span className="chart-stat-label">Open</span>
                                <span className="chart-stat-value">{lastBar.open.toFixed(2)}</span>
                            </div>
                            <div className="chart-stat">
                                <span className="chart-stat-label">High</span>
                                <span className="chart-stat-value text-gain">{lastBar.high.toFixed(2)}</span>
                            </div>
                            <div className="chart-stat">
                                <span className="chart-stat-label">Low</span>
                                <span className="chart-stat-value text-loss">{lastBar.low.toFixed(2)}</span>
                            </div>
                            <div className="chart-stat">
                                <span className="chart-stat-label">Close</span>
                                <span className="chart-stat-value">{lastBar.close.toFixed(2)}</span>
                            </div>
                            <div className="chart-stat">
                                <span className="chart-stat-label">Volume</span>
                                <span className="chart-stat-value">{(lastBar.volume || 0).toLocaleString()}</span>
                            </div>
                            <div className="chart-stat">
                                <span className="chart-stat-label">Unit</span>
                                <span className="chart-stat-value">{selectedCommodity.unit}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}
