// ============================================================
// Price Data Service — Real API data only
// Strategy: Yahoo (full OHLCV) → Twelve Data → Metals.dev (spot only)
// MCX prices derived from global equivalents + USDINR
// ============================================================

import { CommoditySpec, ALL_COMMODITIES, COMMODITIES_BY_ID } from '@/lib/data/commodities';
import { calculateMCXPrice, convertPrice } from '@/lib/utils/conversions';

export interface PriceData {
    commodityId: string;
    price: number;
    previousClose: number;
    change: number;
    changePercent: number;
    dayHigh: number;
    dayLow: number;
    volume: number;
    openInterest?: number;
    timestamp: number;
    source: 'twelvedata' | 'yahoo' | 'metals' | 'derived' | 'mcx';
}

export interface PriceResponse {
    data: PriceData[];
    errors: string[];
    timestamp: number;
}

export interface OHLCVPoint {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

// ── In-memory cache ──────────────────────────────────────────

const priceCache: Map<string, { data: PriceData; expires: number }> = new Map();
const historyCache: Map<string, { data: OHLCVPoint[]; expires: number }> = new Map();
const CACHE_TTL_MS = 60_000;
const HISTORY_CACHE_TTL_MS = 300_000;

function getCached(commodityId: string): PriceData | null {
    const entry = priceCache.get(commodityId);
    if (entry && Date.now() < entry.expires) return entry.data;
    return null;
}

function setCache(data: PriceData) {
    priceCache.set(data.commodityId, { data, expires: Date.now() + CACHE_TTL_MS });
}

// ── Yahoo Finance (primary — gives full OHLCV quotes) ────────

async function fetchYahooBatch(commodities: CommoditySpec[]): Promise<Map<string, PriceData>> {
    const result = new Map<string, PriceData>();
    const tickerMap = new Map<string, CommoditySpec>();

    for (const c of commodities) {
        if (c.yahooTicker) {
            tickerMap.set(c.yahooTicker, c);
        }
    }

    if (tickerMap.size === 0) return result;

    const entries = Array.from(tickerMap.entries());
    const fetchPromises = entries.map(async ([ticker, commodity]) => {
        try {
            const res = await fetch(`/api/prices/yahoo?symbols=${encodeURIComponent(ticker)}`);
            if (!res.ok) return;

            const data = await res.json();
            const chartResult = data?.chart?.result?.[0];
            if (!chartResult) return;

            const meta = chartResult.meta;
            const price = meta.regularMarketPrice || 0;
            if (price === 0) return;

            const prevClose = meta.previousClose || meta.chartPreviousClose || price;
            const change = price - prevClose;
            const pctChange = prevClose ? (change / prevClose) * 100 : 0;

            // Get intraday high/low from the chart data if meta doesn't have it
            let dayHigh = meta.regularMarketDayHigh || 0;
            let dayLow = meta.regularMarketDayLow || 0;

            // Pull from OHLCV bar data if meta is empty
            if ((!dayHigh || !dayLow) && chartResult.indicators?.quote?.[0]) {
                const q = chartResult.indicators.quote[0];
                const highs = (q.high || []).filter((v: number) => v > 0);
                const lows = (q.low || []).filter((v: number) => v > 0);
                if (highs.length > 0) dayHigh = Math.max(...highs);
                if (lows.length > 0) dayLow = Math.min(...lows);
            }

            if (!dayHigh) dayHigh = price;
            if (!dayLow) dayLow = price;

            const pd: PriceData = {
                commodityId: commodity.id,
                price,
                previousClose: prevClose,
                change: parseFloat(change.toFixed(4)),
                changePercent: parseFloat(pctChange.toFixed(2)),
                dayHigh,
                dayLow,
                volume: meta.regularMarketVolume || 0,
                timestamp: Date.now(),
                source: 'yahoo',
            };

            result.set(commodity.id, pd);
            setCache(pd);
        } catch (err) {
            console.error(`Yahoo fetch error for ${ticker}:`, err);
        }
    });

    // Process in batches of 5 to manage rate limits
    for (let i = 0; i < fetchPromises.length; i += 5) {
        await Promise.allSettled(fetchPromises.slice(i, i + 5));
    }

    return result;
}

// ── Twelve Data (secondary — for commodities Yahoo doesn't cover) ─

interface TDQuote {
    symbol: string;
    name: string;
    close: string;
    previous_close: string;
    change: string;
    percent_change: string;
    high: string;
    low: string;
    volume: string;
    datetime: string;
}

async function fetchTwelveDataBatch(commodities: CommoditySpec[]): Promise<Map<string, PriceData>> {
    const result = new Map<string, PriceData>();
    const symbolMap = new Map<string, CommoditySpec>();

    for (const c of commodities) {
        if (c.twelveDataSymbol) {
            symbolMap.set(c.twelveDataSymbol, c);
        }
    }

    if (symbolMap.size === 0) return result;

    const symbolList = Array.from(symbolMap.keys());
    const batches: string[][] = [];
    for (let i = 0; i < symbolList.length; i += 8) {
        batches.push(symbolList.slice(i, i + 8));
    }

    for (const batch of batches) {
        try {
            const symbols = batch.join(',');
            const res = await fetch(`/api/prices/twelvedata?symbols=${encodeURIComponent(symbols)}`);
            if (!res.ok) continue;

            const data = await res.json();
            const quotes: Record<string, TDQuote> = batch.length === 1
                ? { [batch[0]]: data }
                : data;

            for (const [sym, quote] of Object.entries(quotes)) {
                if (!quote || quote.close === undefined || (quote as any).status === 'error') continue;

                const commodity = symbolMap.get(sym);
                if (!commodity) continue;

                const price = parseFloat(quote.close) || 0;
                if (price === 0) continue;

                const prevClose = parseFloat(quote.previous_close) || price;
                const change = parseFloat(quote.change) || (price - prevClose);
                const pctChange = parseFloat(quote.percent_change) || (prevClose ? ((price - prevClose) / prevClose) * 100 : 0);

                const pd: PriceData = {
                    commodityId: commodity.id,
                    price,
                    previousClose: prevClose,
                    change: parseFloat(change.toFixed(4)),
                    changePercent: parseFloat(pctChange.toFixed(2)),
                    dayHigh: parseFloat(quote.high) || price,
                    dayLow: parseFloat(quote.low) || price,
                    volume: parseInt(quote.volume) || 0,
                    timestamp: Date.now(),
                    source: 'twelvedata',
                };

                result.set(commodity.id, pd);
                setCache(pd);
            }
        } catch (err) {
            console.error('Twelve Data batch error:', err);
        }
    }

    return result;
}

// ── Metals.dev (for precious metals that may not have Yahoo data) ─

const METALS_KEY_MAP: Record<string, string> = {
    gold: 'gold-comex',
    silver: 'silver-comex',
    platinum: 'platinum-nymex',
    palladium: 'palladium-nymex',
};

async function fetchMetalsDevPrices(): Promise<Map<string, PriceData>> {
    const result = new Map<string, PriceData>();

    try {
        const res = await fetch('/api/prices/metals');
        if (!res.ok) return result;

        const data = await res.json();
        const metals = data?.metals;
        if (!metals) return result;

        for (const [metalKey, commodityId] of Object.entries(METALS_KEY_MAP)) {
            const metalData = metals[metalKey];
            if (!metalData) continue;

            const commodity = COMMODITIES_BY_ID[commodityId];
            if (!commodity) continue;

            const numPrice = typeof metalData === 'number' ? metalData : parseFloat(metalData);
            if (isNaN(numPrice) || numPrice === 0) continue;

            // Only set if not already fetched from Yahoo/Twelve Data (which has better data)
            const pd: PriceData = {
                commodityId,
                price: numPrice,
                previousClose: numPrice,
                change: 0,
                changePercent: 0,
                dayHigh: numPrice,
                dayLow: numPrice,
                volume: 0,
                timestamp: Date.now(),
                source: 'metals',
            };

            result.set(commodityId, pd);
            setCache(pd);
        }
    } catch (err) {
        console.error('Metals.dev error:', err);
    }

    return result;
}

// ── USDINR rate fetching ─────────────────────────────────────

let cachedUSDINR: { rate: number; expires: number } | null = null;

async function getUSDINR(): Promise<number> {
    if (cachedUSDINR && Date.now() < cachedUSDINR.expires) return cachedUSDINR.rate;

    // Try Yahoo Finance for USDINR
    try {
        const res = await fetch('/api/prices/yahoo?symbols=INR%3DX');
        if (res.ok) {
            const data = await res.json();
            const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
            if (rate && rate > 0) {
                cachedUSDINR = { rate, expires: Date.now() + 300_000 }; // 5 min cache
                return rate;
            }
        }
    } catch { }

    // Try Twelve Data
    try {
        const res = await fetch('/api/prices/twelvedata?symbols=USD/INR');
        if (res.ok) {
            const data = await res.json();
            const rate = parseFloat(data?.close);
            if (rate && rate > 0) {
                cachedUSDINR = { rate, expires: Date.now() + 300_000 };
                return rate;
            }
        }
    } catch { }

    // Fallback rate
    return 83.50;
}

// ── Fetch MCX prices from Google Finance ─────────────────────

async function fetchMCXPrices(commodities: CommoditySpec[]): Promise<Map<string, PriceData>> {
    const result = new Map<string, PriceData>();
    const mcxCommodities = commodities.filter((c) => c.exchange === 'MCX' && c.googleFinanceSymbol);

    if (mcxCommodities.length === 0) return result;

    // MCX India API symbol mapping — googleFinanceSymbol maps to mcxindia.com symbols
    // mcxindia.com returns base symbols like GOLD, SILVER, CRUDEOIL, NATURALGAS, etc.
    const symbolMap = new Map<string, CommoditySpec[]>();
    for (const c of mcxCommodities) {
        const sym = c.googleFinanceSymbol!.toUpperCase();
        if (!symbolMap.has(sym)) symbolMap.set(sym, []);
        symbolMap.get(sym)!.push(c);
    }

    // Fetch all MCX symbols in one call (MCX API returns all market data at once)
    const symbolList = Array.from(symbolMap.keys());
    const batches: string[][] = [];
    for (let i = 0; i < symbolList.length; i += 10) {
        batches.push(symbolList.slice(i, i + 10));
    }

    for (const batch of batches) {
        try {
            const symbols = batch.join(',');
            const res = await fetch(`/api/prices/mcx?symbols=${encodeURIComponent(symbols)}`);
            if (!res.ok) continue;

            const data = await res.json();
            for (const [sym, quote] of Object.entries(data)) {
                if (!quote) continue;

                // Match to all commodities that map to this base symbol
                const matchedCommodities = symbolMap.get(sym.toUpperCase()) || [];
                if (matchedCommodities.length === 0) continue;

                const q = quote as any;
                if (!q.price || q.price === 0) continue;

                for (const commodity of matchedCommodities) {
                    const pd: PriceData = {
                        commodityId: commodity.id,
                        price: q.price,
                        previousClose: q.previousClose || q.price,
                        change: q.change || 0,
                        changePercent: q.changePercent || 0,
                        dayHigh: q.dayHigh || q.price,
                        dayLow: q.dayLow || q.price,
                        volume: q.volume || 0,
                        openInterest: q.oi || 0,
                        timestamp: Date.now(),
                        source: 'mcx',
                    };

                    result.set(commodity.id, pd);
                    setCache(pd);
                }
            }
        } catch (err) {
            console.error('MCX batch fetch error:', err);
        }
    }

    return result;
}

// ── Main fetch function ──────────────────────────────────────

export async function fetchAllPrices(): Promise<PriceResponse> {
    const errors: string[] = [];
    const priceMap = new Map<string, PriceData>();

    // Check cache first
    const uncached: CommoditySpec[] = [];
    for (const c of ALL_COMMODITIES) {
        const cached = getCached(c.id);
        if (cached) {
            priceMap.set(c.id, cached);
        } else {
            uncached.push(c);
        }
    }

    if (uncached.length === 0) {
        return { data: Array.from(priceMap.values()), errors, timestamp: Date.now() };
    }

    // Tier 1: Yahoo Finance (global commodities, gives full OHLCV)
    try {
        const yahooCommodities = uncached.filter((c) => c.yahooTicker);
        if (yahooCommodities.length > 0) {
            const yahooResults = await fetchYahooBatch(yahooCommodities);
            yahooResults.forEach((pd, id) => priceMap.set(id, pd));
        }
    } catch (err: any) {
        errors.push(`Yahoo Finance: ${err.message}`);
    }

    // Tier 2: Twelve Data (commodities not yet fetched)
    try {
        const stillMissing = uncached.filter((c) => !priceMap.has(c.id) && c.twelveDataSymbol);
        if (stillMissing.length > 0) {
            const tdResults = await fetchTwelveDataBatch(stillMissing);
            tdResults.forEach((pd, id) => {
                if (!priceMap.has(id)) priceMap.set(id, pd);
            });
        }
    } catch (err: any) {
        errors.push(`Twelve Data: ${err.message}`);
    }

    // Tier 3: Metals.dev (precious metals still missing)
    try {
        const preciousIds = ['gold-comex', 'silver-comex', 'platinum-nymex', 'palladium-nymex'];
        const needPrecious = preciousIds.some((id) => !priceMap.has(id));
        if (needPrecious) {
            const metalsResults = await fetchMetalsDevPrices();
            metalsResults.forEach((pd, id) => {
                if (!priceMap.has(id)) priceMap.set(id, pd);
            });
        }
    } catch (err: any) {
        errors.push(`Metals.dev: ${err.message}`);
    }

    // Tier 4: MCX — Live prices from Google Finance
    try {
        const mcxMissing = uncached.filter((c) => !priceMap.has(c.id) && c.exchange === 'MCX');
        if (mcxMissing.length > 0) {
            const mcxResults = await fetchMCXPrices(mcxMissing);
            mcxResults.forEach((pd, id) => priceMap.set(id, pd));
        }
    } catch (err: any) {
        errors.push(`MCX Google Finance: ${err.message}`);
    }

    return {
        data: Array.from(priceMap.values()),
        errors,
        timestamp: Date.now(),
    };
}

export async function fetchPriceById(commodityId: string): Promise<PriceData | null> {
    const commodity = COMMODITIES_BY_ID[commodityId];
    if (!commodity) return null;

    const cached = getCached(commodityId);
    if (cached) return cached;

    // For MCX, fetch from Google Finance
    if (commodity.exchange === 'MCX' && commodity.googleFinanceSymbol) {
        const results = await fetchMCXPrices([commodity]);
        if (results.has(commodityId)) return results.get(commodityId)!;
    }

    // Try Yahoo first
    if (commodity.yahooTicker) {
        const results = await fetchYahooBatch([commodity]);
        if (results.has(commodityId)) return results.get(commodityId)!;
    }

    // Try Twelve Data
    if (commodity.twelveDataSymbol) {
        const results = await fetchTwelveDataBatch([commodity]);
        if (results.has(commodityId)) return results.get(commodityId)!;
    }

    return null;
}

export async function fetchPricesBySector(sector: string): Promise<PriceData[]> {
    const commodities = ALL_COMMODITIES.filter((c) => c.sector === sector);
    const response = await fetchAllPrices();
    return response.data.filter((p) => commodities.some((c) => c.id === p.commodityId));
}

// ── Historical data for charts ───────────────────────────────

export async function fetchHistoricalData(
    commodityId: string,
    interval: string = '1day',
    outputSize: number = 180,
): Promise<OHLCVPoint[]> {
    const cacheKey = `${commodityId}:${interval}:${outputSize}`;
    const cached = historyCache.get(cacheKey);
    if (cached && Date.now() < cached.expires) return cached.data;

    const commodity = COMMODITIES_BY_ID[commodityId];
    if (!commodity) return [];

    // For MCX commodities, fetch their global equivalent's history
    const targetCommodity = (commodity.exchange === 'MCX' && commodity.globalEquivalent)
        ? COMMODITIES_BY_ID[commodity.globalEquivalent]
        : commodity;

    if (!targetCommodity) return [];

    // Try Yahoo Finance first (most reliable for historical data)
    if (targetCommodity.yahooTicker) {
        try {
            const rangeDays = outputSize;
            const yahooRange = rangeDays <= 7 ? '5d' : rangeDays <= 30 ? '1mo' : rangeDays <= 90 ? '3mo' : rangeDays <= 180 ? '6mo' : '1y';
            const yahooInterval = interval === '1day' ? '1d' : interval === '1week' ? '1wk' : '1d';

            const res = await fetch(
                `/api/prices/yahoo?symbols=${encodeURIComponent(targetCommodity.yahooTicker)}&range=${yahooRange}&interval=${yahooInterval}`
            );
            if (res.ok) {
                const data = await res.json();
                const chartResult = data?.chart?.result?.[0];
                if (chartResult) {
                    const timestamps = chartResult.timestamp || [];
                    const quote = chartResult.indicators?.quote?.[0];
                    if (quote && timestamps.length > 0) {
                        let points: OHLCVPoint[] = timestamps
                            .map((ts: number, i: number) => ({
                                time: new Date(ts * 1000).toISOString().split('T')[0],
                                open: quote.open?.[i] || 0,
                                high: quote.high?.[i] || 0,
                                low: quote.low?.[i] || 0,
                                close: quote.close?.[i] || 0,
                                volume: quote.volume?.[i] || 0,
                            }))
                            .filter((p: OHLCVPoint) => p.open > 0 && p.close > 0);

                        // If MCX, convert prices to INR
                        if (commodity.exchange === 'MCX' && commodity.globalEquivalent) {
                            const usdInr = await getUSDINR();
                            const global = COMMODITIES_BY_ID[commodity.globalEquivalent];
                            if (global) {
                                points = points.map((p) => ({
                                    ...p,
                                    open: parseFloat(calculateMCXPrice({ internationalPrice: p.open, fromUnit: global.unit, toUnit: commodity.unit, usdInr, importDuty: 0 }).toFixed(2)),
                                    high: parseFloat(calculateMCXPrice({ internationalPrice: p.high, fromUnit: global.unit, toUnit: commodity.unit, usdInr, importDuty: 0 }).toFixed(2)),
                                    low: parseFloat(calculateMCXPrice({ internationalPrice: p.low, fromUnit: global.unit, toUnit: commodity.unit, usdInr, importDuty: 0 }).toFixed(2)),
                                    close: parseFloat(calculateMCXPrice({ internationalPrice: p.close, fromUnit: global.unit, toUnit: commodity.unit, usdInr, importDuty: 0 }).toFixed(2)),
                                }));
                            }
                        }

                        if (points.length > 0) {
                            historyCache.set(cacheKey, { data: points, expires: Date.now() + HISTORY_CACHE_TTL_MS });
                            return points;
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Yahoo historical fetch error:', err);
        }
    }

    // Fallback: Twelve Data time_series
    if (targetCommodity.twelveDataSymbol) {
        try {
            const res = await fetch(
                `/api/prices/twelvedata?symbols=${encodeURIComponent(targetCommodity.twelveDataSymbol)}&type=timeseries&interval=${interval}&outputsize=${outputSize}`
            );
            if (res.ok) {
                const data = await res.json();
                const values = data?.values;
                if (Array.isArray(values) && values.length > 0) {
                    let points: OHLCVPoint[] = values
                        .map((v: any) => ({
                            time: v.datetime?.split(' ')[0] || v.datetime,
                            open: parseFloat(v.open),
                            high: parseFloat(v.high),
                            low: parseFloat(v.low),
                            close: parseFloat(v.close),
                            volume: parseInt(v.volume) || 0,
                        }))
                        .filter((p: OHLCVPoint) => !isNaN(p.open) && !isNaN(p.close))
                        .reverse();

                    // If MCX, convert prices
                    if (commodity.exchange === 'MCX' && commodity.globalEquivalent) {
                        const usdInr = await getUSDINR();
                        const global = COMMODITIES_BY_ID[commodity.globalEquivalent];
                        if (global) {
                            points = points.map((p) => ({
                                ...p,
                                open: parseFloat(calculateMCXPrice({ internationalPrice: p.open, fromUnit: global.unit, toUnit: commodity.unit, usdInr, importDuty: 0 }).toFixed(2)),
                                high: parseFloat(calculateMCXPrice({ internationalPrice: p.high, fromUnit: global.unit, toUnit: commodity.unit, usdInr, importDuty: 0 }).toFixed(2)),
                                low: parseFloat(calculateMCXPrice({ internationalPrice: p.low, fromUnit: global.unit, toUnit: commodity.unit, usdInr, importDuty: 0 }).toFixed(2)),
                                close: parseFloat(calculateMCXPrice({ internationalPrice: p.close, fromUnit: global.unit, toUnit: commodity.unit, usdInr, importDuty: 0 }).toFixed(2)),
                            }));
                        }
                    }

                    if (points.length > 0) {
                        historyCache.set(cacheKey, { data: points, expires: Date.now() + HISTORY_CACHE_TTL_MS });
                        return points;
                    }
                }
            }
        } catch (err) {
            console.error('Twelve Data historical fetch error:', err);
        }
    }

    return [];
}

// ── Yahoo Finance Options Chain ──────────────────────────────

export interface OptionQuote {
    strike: number;
    callOI: number;
    callVolume: number;
    callLTP: number;
    callIV: number;
    callChange: number;
    putOI: number;
    putVolume: number;
    putLTP: number;
    putIV: number;
    putChange: number;
}

export interface OptionsChainData {
    underlyingPrice: number;
    expirationDates: string[];
    options: OptionQuote[];
    source?: string;
    currency?: string;
    marketClosed?: boolean;
    info?: string;
}

export async function fetchOptionsChain(yahooTicker: string, expirationDate?: string): Promise<OptionsChainData | null> {
    try {
        let url = `/api/prices/yahoo-options?symbol=${encodeURIComponent(yahooTicker)}`;
        if (expirationDate) {
            // Convert date string to Unix timestamp for Yahoo
            const ts = Math.floor(new Date(expirationDate).getTime() / 1000);
            url += `&date=${ts}`;
        }
        const res = await fetch(url);
        if (!res.ok) return null;

        const data = await res.json();
        if (data.error) return null;
        return data;
    } catch (err) {
        console.error('Options chain fetch error:', err);
        return null;
    }
}

// Fetch commodity options chain from NSE India (for MCX commodities)
export async function fetchNSEOptionsChain(symbol: string): Promise<OptionsChainData | null> {
    try {
        const url = `/api/prices/nse-options?symbol=${encodeURIComponent(symbol)}`;
        const res = await fetch(url);
        if (!res.ok) return null;

        const data = await res.json();
        // Don't reject on data.error alone — NSE returns structure even when market closed
        if (data.error && (!data.options || data.options.length === 0)) return null;

        // Convert NSE format to our OptionsChainData format
        return {
            underlyingPrice: data.underlyingPrice || 0,
            expirationDates: data.expirationDates || [],
            options: (data.options || []).map((o: any) => ({
                strike: o.strike,
                callOI: o.callOI || 0,
                callVolume: o.callVolume || 0,
                callLTP: o.callLTP || 0,
                callChange: o.callChange || 0,
                callIV: o.callIV || 0,
                putOI: o.putOI || 0,
                putVolume: o.putVolume || 0,
                putLTP: o.putLTP || 0,
                putChange: o.putChange || 0,
                putIV: o.putIV || 0,
            })),
            source: data.source || undefined,
            currency: data.currency || undefined,
            marketClosed: data.marketClosed || false,
            info: data.info || undefined,
        };
    } catch (err) {
        console.error('NSE options chain fetch error:', err);
        return null;
    }
}

// ── Historical Price + Volume data ───────────────────────────

export interface OIHistoryPoint {
    date: string;
    price: number;
    volume: number;
    oi: number;
}

export async function fetchOIHistory(yahooTicker: string, range: string = '3mo'): Promise<OIHistoryPoint[]> {
    try {
        const res = await fetch(
            `/api/prices/yahoo?symbols=${encodeURIComponent(yahooTicker)}&range=${range}&interval=1d`
        );
        if (!res.ok) return [];

        const data = await res.json();
        const chartResult = data?.chart?.result?.[0];
        if (!chartResult) return [];

        const timestamps = chartResult.timestamp || [];
        const quote = chartResult.indicators?.quote?.[0];
        if (!quote || timestamps.length === 0) return [];

        return timestamps
            .map((ts: number, i: number) => ({
                date: new Date(ts * 1000).toISOString().split('T')[0],
                price: quote.close?.[i] || 0,
                volume: quote.volume?.[i] || 0,
                oi: 0,
            }))
            .filter((p: OIHistoryPoint) => p.price > 0);
    } catch (err) {
        console.error('OI history fetch error:', err);
        return [];
    }
}
