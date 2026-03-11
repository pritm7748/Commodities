'use client';

import { useEffect, useRef } from 'react';
import {
    createChart,
    IChartApi,
    Time,
    ColorType,
    CandlestickSeriesOptions,
    LineSeriesOptions,
    AreaSeriesOptions,
    HistogramSeriesOptions,
    CandlestickSeries,
    LineSeries,
    AreaSeries,
    HistogramSeries,
} from 'lightweight-charts';
import { CommoditySpec, SECTOR_META } from '@/lib/data/commodities';

export interface ChartDataPoint {
    time: string; // YYYY-MM-DD format
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

type ChartType = 'candlestick' | 'line' | 'area';
type Indicator = 'sma20' | 'sma50' | 'ema20' | 'bollinger' | 'rsi' | 'macd' | 'volume';

interface CommodityChartProps {
    commodity: CommoditySpec;
    data: ChartDataPoint[];
    chartType?: ChartType;
    indicators?: Indicator[];
    height?: number;
}

interface LineDataPoint {
    time: Time;
    value: number;
}

interface HistogramDataPoint {
    time: Time;
    value: number;
    color?: string;
}

// ── Indicator calculations ────────────────────────────────

function calcSMA(data: ChartDataPoint[], period: number): LineDataPoint[] {
    const result: LineDataPoint[] = [];
    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);
        const avg = slice.reduce((sum, d) => sum + d.close, 0) / period;
        result.push({ time: data[i].time as Time, value: avg });
    }
    return result;
}

function calcEMA(data: ChartDataPoint[], period: number): LineDataPoint[] {
    const result: LineDataPoint[] = [];
    const k = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period;
    result.push({ time: data[period - 1].time as Time, value: ema });

    for (let i = period; i < data.length; i++) {
        ema = data[i].close * k + ema * (1 - k);
        result.push({ time: data[i].time as Time, value: ema });
    }
    return result;
}

function calcBollinger(data: ChartDataPoint[], period: number = 20, stdDev: number = 2) {
    const upper: LineDataPoint[] = [];
    const middle: LineDataPoint[] = [];
    const lower: LineDataPoint[] = [];

    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);
        const avg = slice.reduce((sum, d) => sum + d.close, 0) / period;
        const variance = slice.reduce((sum, d) => sum + Math.pow(d.close - avg, 2), 0) / period;
        const std = Math.sqrt(variance);

        const time = data[i].time as Time;
        upper.push({ time, value: avg + stdDev * std });
        middle.push({ time, value: avg });
        lower.push({ time, value: avg - stdDev * std });
    }

    return { upper, middle, lower };
}

function calcRSI(data: ChartDataPoint[], period: number = 14): LineDataPoint[] {
    const result: LineDataPoint[] = [];
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 1; i <= period; i++) {
        const change = data[i].close - data[i - 1].close;
        if (change > 0) avgGain += change;
        else avgLoss += Math.abs(change);
    }
    avgGain /= period;
    avgLoss /= period;

    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push({ time: data[period].time as Time, value: 100 - 100 / (1 + rs) });

    for (let i = period + 1; i < data.length; i++) {
        const change = data[i].close - data[i - 1].close;
        if (change > 0) {
            avgGain = (avgGain * (period - 1) + change) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        } else {
            avgGain = (avgGain * (period - 1)) / period;
            avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
        }
        rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result.push({ time: data[i].time as Time, value: 100 - 100 / (1 + rs) });
    }

    return result;
}

function calcMACD(data: ChartDataPoint[]) {
    const ema12 = calcEMA(data, 12);
    const ema26 = calcEMA(data, 26);

    const macdLine: LineDataPoint[] = [];
    const startIdx = 26 - 12;

    for (let i = startIdx; i < ema12.length && i - startIdx < ema26.length; i++) {
        macdLine.push({
            time: ema12[i].time,
            value: ema12[i].value - ema26[i - startIdx].value,
        });
    }

    const signalLine: LineDataPoint[] = [];
    if (macdLine.length >= 9) {
        const k = 2 / 10;
        let ema = macdLine.slice(0, 9).reduce((s, d) => s + d.value, 0) / 9;
        signalLine.push({ time: macdLine[8].time, value: ema });
        for (let i = 9; i < macdLine.length; i++) {
            ema = macdLine[i].value * k + ema * (1 - k);
            signalLine.push({ time: macdLine[i].time, value: ema });
        }
    }

    const histogram: HistogramDataPoint[] = [];
    const signalStartIdx = macdLine.length - signalLine.length;
    for (let i = 0; i < signalLine.length; i++) {
        const val = macdLine[i + signalStartIdx].value - signalLine[i].value;
        histogram.push({
            time: signalLine[i].time,
            value: val,
            color: val >= 0 ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)',
        });
    }

    return { macdLine: macdLine.slice(signalStartIdx), signalLine, histogram };
}



// ── Helper: create chart with common options ──────────────

function createChartWithOptions(container: HTMLElement, chartHeight: number): IChartApi {
    return createChart(container, {
        width: container.clientWidth,
        height: chartHeight,
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
        crosshair: {
            mode: 0,
            vertLine: { color: 'rgba(99, 102, 241, 0.4)', width: 1, style: 2, labelBackgroundColor: '#6366f1' },
            horzLine: { color: 'rgba(99, 102, 241, 0.4)', width: 1, style: 2, labelBackgroundColor: '#6366f1' },
        },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
        timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: false },
    });
}

// ── Main Chart Component ──────────────────────────────────

export default function CommodityChart({
    commodity,
    data,
    chartType = 'candlestick',
    indicators = [],
    height = 500,
}: CommodityChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const rsiContainerRef = useRef<HTMLDivElement>(null);
    const rsiChartRef = useRef<IChartApi | null>(null);
    const macdContainerRef = useRef<HTMLDivElement>(null);
    const macdChartRef = useRef<IChartApi | null>(null);

    const hasRSI = indicators.includes('rsi');
    const hasMACD = indicators.includes('macd');
    const hasVolume = indicators.includes('volume');

    useEffect(() => {
        if (!chartContainerRef.current || data.length === 0) return;

        // Safely dispose old charts (guards against React strict mode double-firing)
        const safeRemove = (ref: React.MutableRefObject<IChartApi | null>) => {
            if (ref.current) {
                try { ref.current.remove(); } catch { /* already disposed */ }
                ref.current = null;
            }
        };
        safeRemove(chartRef);
        safeRemove(rsiChartRef);
        safeRemove(macdChartRef);

        // ── Main chart ─────────────────────────────
        const chart = createChartWithOptions(chartContainerRef.current, height);
        chartRef.current = chart;

        // Main series (using v5 addSeries API)
        if (chartType === 'candlestick') {
            const series = chart.addSeries(CandlestickSeries, {
                upColor: '#22c55e',
                downColor: '#ef4444',
                borderDownColor: '#ef4444',
                borderUpColor: '#22c55e',
                wickDownColor: '#ef4444',
                wickUpColor: '#22c55e',
            });
            series.setData(data.map((d) => ({ time: d.time as Time, open: d.open, high: d.high, low: d.low, close: d.close })));
        } else if (chartType === 'line') {
            const series = chart.addSeries(LineSeries, {
                color: '#6366f1',
                lineWidth: 2,
            });
            series.setData(data.map((d) => ({ time: d.time as Time, value: d.close })));
        } else if (chartType === 'area') {
            const series = chart.addSeries(AreaSeries, {
                topColor: 'rgba(99, 102, 241, 0.3)',
                bottomColor: 'rgba(99, 102, 241, 0.02)',
                lineColor: '#6366f1',
                lineWidth: 2,
            });
            series.setData(data.map((d) => ({ time: d.time as Time, value: d.close })));
        }

        // Volume
        if (hasVolume) {
            const volumeSeries = chart.addSeries(HistogramSeries, {
                priceFormat: { type: 'volume' },
                priceScaleId: 'volume',
            });
            chart.priceScale('volume').applyOptions({
                scaleMargins: { top: 0.85, bottom: 0 },
            });
            volumeSeries.setData(
                data.map((d) => ({
                    time: d.time as Time,
                    value: d.volume || 0,
                    color: d.close >= d.open ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                }))
            );
        }

        // SMA 20
        if (indicators.includes('sma20')) {
            const sma = calcSMA(data, 20);
            const series = chart.addSeries(LineSeries, { color: '#eab308', lineWidth: 1, title: 'SMA 20' });
            series.setData(sma);
        }

        // SMA 50
        if (indicators.includes('sma50')) {
            const sma = calcSMA(data, 50);
            const series = chart.addSeries(LineSeries, { color: '#ef4444', lineWidth: 1, title: 'SMA 50' });
            series.setData(sma);
        }

        // EMA 20
        if (indicators.includes('ema20')) {
            const ema = calcEMA(data, 20);
            const series = chart.addSeries(LineSeries, { color: '#0ea5e9', lineWidth: 1, title: 'EMA 20' });
            series.setData(ema);
        }

        // Bollinger Bands
        if (indicators.includes('bollinger')) {
            const bb = calcBollinger(data, 20, 2);
            chart.addSeries(LineSeries, { color: 'rgba(168, 85, 247, 0.5)', lineWidth: 1, title: 'BB Upper' }).setData(bb.upper);
            chart.addSeries(LineSeries, { color: 'rgba(168, 85, 247, 0.8)', lineWidth: 1, title: 'BB Mid' }).setData(bb.middle);
            chart.addSeries(LineSeries, { color: 'rgba(168, 85, 247, 0.5)', lineWidth: 1, title: 'BB Lower' }).setData(bb.lower);
        }

        chart.timeScale().fitContent();

        // ── RSI sub-chart ──────────────────────────
        if (hasRSI && rsiContainerRef.current) {
            const rsiChart = createChartWithOptions(rsiContainerRef.current, 120);
            rsiChart.applyOptions({ timeScale: { visible: false } });
            rsiChartRef.current = rsiChart;

            const rsiData = calcRSI(data, 14);
            const rsiSeries = rsiChart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 2, title: 'RSI 14' });
            rsiSeries.setData(rsiData);

            // Overbought/Oversold lines
            const ob = rsiData.map((d) => ({ time: d.time, value: 70 }));
            const os = rsiData.map((d) => ({ time: d.time, value: 30 }));
            rsiChart.addSeries(LineSeries, { color: 'rgba(239, 68, 68, 0.3)', lineWidth: 1, lineStyle: 2 }).setData(ob);
            rsiChart.addSeries(LineSeries, { color: 'rgba(34, 197, 94, 0.3)', lineWidth: 1, lineStyle: 2 }).setData(os);

            rsiChart.timeScale().fitContent();

            chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
                if (range) {
                    try { rsiChart.timeScale().setVisibleLogicalRange(range); } catch { /* disposed */ }
                }
            });
        }

        // ── MACD sub-chart ─────────────────────────
        if (hasMACD && macdContainerRef.current) {
            const macdChart = createChartWithOptions(macdContainerRef.current, 120);
            macdChartRef.current = macdChart;

            const macd = calcMACD(data);
            macdChart.addSeries(LineSeries, { color: '#0ea5e9', lineWidth: 2, title: 'MACD' }).setData(macd.macdLine);
            macdChart.addSeries(LineSeries, { color: '#ef4444', lineWidth: 1, title: 'Signal' }).setData(macd.signalLine);
            macdChart.addSeries(HistogramSeries, { title: 'Histogram' }).setData(macd.histogram);

            macdChart.timeScale().fitContent();

            chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
                if (range) {
                    try { macdChart.timeScale().setVisibleLogicalRange(range); } catch { /* disposed */ }
                }
            });
        }

        // Resize handler
        const handleResize = () => {
            try {
                if (chartContainerRef.current && chartRef.current) {
                    chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
                }
                if (rsiContainerRef.current && rsiChartRef.current) {
                    rsiChartRef.current.applyOptions({ width: rsiContainerRef.current.clientWidth });
                }
                if (macdContainerRef.current && macdChartRef.current) {
                    macdChartRef.current.applyOptions({ width: macdContainerRef.current.clientWidth });
                }
            } catch { /* chart disposed during resize */ }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            safeRemove(chartRef);
            safeRemove(rsiChartRef);
            safeRemove(macdChartRef);
        };
    }, [data, chartType, indicators, commodity, height, hasRSI, hasMACD, hasVolume]);

    return (
        <div>
            <div ref={chartContainerRef} style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }} />
            {hasRSI && (
                <div style={{ marginTop: 2 }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', padding: '4px 0' }}>RSI (14)</div>
                    <div ref={rsiContainerRef} style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden' }} />
                </div>
            )}
            {hasMACD && (
                <div style={{ marginTop: 2 }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', padding: '4px 0' }}>MACD (12, 26, 9)</div>
                    <div ref={macdContainerRef} style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden' }} />
                </div>
            )}
        </div>
    );
}
