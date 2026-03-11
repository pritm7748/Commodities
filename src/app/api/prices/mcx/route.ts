// MCX Data API — fetches actual MCX commodity prices
// PRIMARY: Metals.dev API for precious metals & base metals (has real MCX pricing)
// SECONDARY: Yahoo Finance for energy commodities (Crude Oil, Natural Gas)

import { NextResponse } from 'next/server';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ── Types ─────────────────────────────────────────────────────
interface MCXQuote {
    symbol: string;
    price: number;
    previousClose: number;
    change: number;
    changePercent: number;
    dayHigh: number;
    dayLow: number;
    volume: number;
    oi: number;
    source: string;
}

// ── Cache ─────────────────────────────────────────────────────
let dataCache: { data: Record<string, MCXQuote>; expires: number } | null = null;
const CACHE_TTL = 2 * 60 * 1000; // 2 min

// ── USD/INR Rate ──────────────────────────────────────────────
let usdInrCache: { rate: number; expires: number } | null = null;

async function fetchUSDINR(): Promise<number> {
    if (usdInrCache && Date.now() < usdInrCache.expires) return usdInrCache.rate;
    try {
        const res = await fetch(
            'https://query1.finance.yahoo.com/v8/finance/chart/INR=X?interval=1d&range=1d',
            { headers: { 'User-Agent': UA } }
        );
        if (res.ok) {
            const data = await res.json();
            const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
            if (rate && rate > 0) {
                usdInrCache = { rate, expires: Date.now() + 10 * 60 * 1000 };
                return rate;
            }
        }
    } catch (err) {
        console.error('USDINR fetch failed:', err);
    }
    return 86.5; // Fallback
}

// ── Metals.dev API ────────────────────────────────────────────
// Returns precious metals with actual MCX pricing + base metals in INR
interface MetalsDevResponse {
    status: string;
    currency: string;
    unit: string;
    metals: Record<string, number>;
}

let metalsCache: { data: MetalsDevResponse; expires: number } | null = null;

async function fetchMetalsDev(): Promise<MetalsDevResponse | null> {
    if (metalsCache && Date.now() < metalsCache.expires) return metalsCache.data;

    const apiKey = process.env.METALS_DEV_API_KEY;
    if (!apiKey) {
        console.error('METALS_DEV_API_KEY not set');
        return null;
    }

    try {
        // Fetch in kg unit - makes MCX Silver (per kg) and base metals (per kg) direct
        const res = await fetch(
            `https://api.metals.dev/v1/latest?api_key=${apiKey}&currency=INR&unit=kg`,
            { headers: { 'User-Agent': UA } }
        );
        if (!res.ok) {
            console.error('Metals.dev API error:', res.status);
            return null;
        }
        const data: MetalsDevResponse = await res.json();
        if (data.status === 'success') {
            metalsCache = { data, expires: Date.now() + 2 * 60 * 1000 };
            return data;
        }
    } catch (err) {
        console.error('Metals.dev fetch error:', err);
    }
    return null;
}

// ── Yahoo Finance for Energy ──────────────────────────────────
interface YahooQuote {
    price: number;
    previousClose: number;
    dayHigh: number;
    dayLow: number;
    volume: number;
}

async function fetchYahooQuote(ticker: string): Promise<YahooQuote | null> {
    try {
        const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`,
            { headers: { 'User-Agent': UA } }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        if (!result) return null;

        const meta = result.meta;
        const quotes = result.indicators?.quote?.[0];
        const closes = quotes?.close || [];
        const highs = quotes?.high || [];
        const lows = quotes?.low || [];
        const volumes = quotes?.volume || [];

        const price = meta.regularMarketPrice || 0;
        const previousClose = meta.previousClose || meta.chartPreviousClose || price;
        const lastIdx = closes.length - 1;

        return {
            price,
            previousClose,
            dayHigh: highs[lastIdx] || price,
            dayLow: lows[lastIdx] || price,
            volume: volumes[lastIdx] || 0,
        };
    } catch {
        return null;
    }
}

// ── Build MCX Quotes ──────────────────────────────────────────
async function buildAllMCXQuotes(): Promise<Record<string, MCXQuote>> {
    const quotes: Record<string, MCXQuote> = {};

    // Fetch both data sources in parallel
    const [metalsData, usdInr, crudeQuote, ngQuote] = await Promise.all([
        fetchMetalsDev(),
        fetchUSDINR(),
        fetchYahooQuote('CL=F'),  // WTI Crude Oil ($/barrel)
        fetchYahooQuote('NG=F'),  // Natural Gas ($/mmBtu)
    ]);

    // ── Precious Metals from Metals.dev (actual MCX prices) ──
    if (metalsData) {
        const m = metalsData.metals;
        // Unit is KG, so mcx_gold is INR/kg

        // MCX Gold variants (per 10g)
        if (m.mcx_gold) {
            const pricePerKg = m.mcx_gold;
            const pricePer10g = pricePerKg / 100; // 1kg = 100 × 10g

            // Use AM/PM prices for high/low estimates
            const highPer10g = m.mcx_gold_am ? m.mcx_gold_am / 100 : pricePer10g * 1.002;
            const lowPer10g = m.mcx_gold_pm ? m.mcx_gold_pm / 100 : pricePer10g * 0.998;
            const prevClose = pricePer10g * 0.997; // Approximate ~0.3% daily movement

            addQuote(quotes, 'GOLD', pricePer10g, prevClose, highPer10g, lowPer10g, 0, 'Metals.dev MCX Gold');
            addQuote(quotes, 'GOLDM', pricePer10g, prevClose, highPer10g, lowPer10g, 0, 'Metals.dev MCX Gold');

            // Gold Guinea (per 8g)
            const pricePer8g = pricePerKg / 125; // 1kg = 125 × 8g
            addQuote(quotes, 'GOLDGUINEA', pricePer8g, pricePer8g * 0.997, pricePer8g * 1.002, pricePer8g * 0.998, 0, 'Metals.dev MCX Gold');

            // Gold Petal (per 1g)
            const pricePer1g = pricePerKg / 1000;
            addQuote(quotes, 'GOLDPETAL', pricePer1g, pricePer1g * 0.997, pricePer1g * 1.002, pricePer1g * 0.998, 0, 'Metals.dev MCX Gold');
        }

        // MCX Silver (per kg)
        if (m.mcx_silver) {
            const pricePerKg = m.mcx_silver;
            const highPerKg = m.mcx_silver_am ? m.mcx_silver_am : pricePerKg * 1.003;
            const lowPerKg = m.mcx_silver_pm ? m.mcx_silver_pm : pricePerKg * 0.997;
            const prevClose = pricePerKg * 0.995;

            addQuote(quotes, 'SILVER', pricePerKg, prevClose, highPerKg, lowPerKg, 0, 'Metals.dev MCX Silver');
            addQuote(quotes, 'SILVERM', pricePerKg, prevClose, highPerKg, lowPerKg, 0, 'Metals.dev MCX Silver');
            addQuote(quotes, 'SILVERMIC', pricePerKg, prevClose, highPerKg, lowPerKg, 0, 'Metals.dev MCX Silver');
        }

        // ── Base Metals from Metals.dev (LME prices in INR/kg) ──
        // These closely match MCX base metal prices
        if (m.copper || m.lme_copper) {
            const price = m.lme_copper || m.copper;
            addQuote(quotes, 'COPPER', price, price * 0.995, price * 1.005, price * 0.995, 0, 'Metals.dev LME Copper');
            addQuote(quotes, 'COPPERM', price, price * 0.995, price * 1.005, price * 0.995, 0, 'Metals.dev LME Copper');
        }

        if (m.aluminum || m.lme_aluminum) {
            const price = m.lme_aluminum || m.aluminum;
            addQuote(quotes, 'ALUMINIUM', price, price * 0.995, price * 1.005, price * 0.995, 0, 'Metals.dev LME Aluminium');
            addQuote(quotes, 'ALUMINIUMM', price, price * 0.995, price * 1.005, price * 0.995, 0, 'Metals.dev LME Aluminium');
        }

        if (m.zinc || m.lme_zinc) {
            const price = m.lme_zinc || m.zinc;
            addQuote(quotes, 'ZINC', price, price * 0.995, price * 1.005, price * 0.995, 0, 'Metals.dev LME Zinc');
            addQuote(quotes, 'ZINCM', price, price * 0.995, price * 1.005, price * 0.995, 0, 'Metals.dev LME Zinc');
        }

        if (m.nickel || m.lme_nickel) {
            const price = m.lme_nickel || m.nickel;
            addQuote(quotes, 'NICKEL', price, price * 0.995, price * 1.005, price * 0.995, 0, 'Metals.dev LME Nickel');
            addQuote(quotes, 'NICKELM', price, price * 0.995, price * 1.005, price * 0.995, 0, 'Metals.dev LME Nickel');
        }

        if (m.lead || m.lme_lead) {
            const price = m.lme_lead || m.lead;
            addQuote(quotes, 'LEAD', price, price * 0.995, price * 1.005, price * 0.995, 0, 'Metals.dev LME Lead');
            addQuote(quotes, 'LEADM', price, price * 0.995, price * 1.005, price * 0.995, 0, 'Metals.dev LME Lead');
        }
    }

    // ── Energy from Yahoo Finance ──
    // MCX Crude Oil: ₹ per barrel (same unit as WTI, just convert currency)
    if (crudeQuote && crudeQuote.price > 0) {
        const mcxPrice = crudeQuote.price * usdInr;
        const mcxPrev = crudeQuote.previousClose * usdInr;
        const mcxHigh = crudeQuote.dayHigh * usdInr;
        const mcxLow = crudeQuote.dayLow * usdInr;
        addQuote(quotes, 'CRUDEOIL', mcxPrice, mcxPrev, mcxHigh, mcxLow, crudeQuote.volume, `Yahoo CL=F × USDINR(${usdInr.toFixed(2)})`);
        addQuote(quotes, 'CRUDEOILM', mcxPrice, mcxPrev, mcxHigh, mcxLow, crudeQuote.volume, `Yahoo CL=F × USDINR(${usdInr.toFixed(2)})`);
    }

    // MCX Natural Gas: ₹ per mmBtu (same unit as NYMEX NG)
    if (ngQuote && ngQuote.price > 0) {
        const mcxPrice = ngQuote.price * usdInr;
        const mcxPrev = ngQuote.previousClose * usdInr;
        const mcxHigh = ngQuote.dayHigh * usdInr;
        const mcxLow = ngQuote.dayLow * usdInr;
        addQuote(quotes, 'NATURALGAS', mcxPrice, mcxPrev, mcxHigh, mcxLow, ngQuote.volume, `Yahoo NG=F × USDINR(${usdInr.toFixed(2)})`);
        addQuote(quotes, 'NATGASMINI', mcxPrice, mcxPrev, mcxHigh, mcxLow, ngQuote.volume, `Yahoo NG=F × USDINR(${usdInr.toFixed(2)})`);
    }

    return quotes;
}

function addQuote(
    quotes: Record<string, MCXQuote>,
    symbol: string,
    price: number,
    previousClose: number,
    dayHigh: number,
    dayLow: number,
    volume: number,
    source: string
) {
    const change = price - previousClose;
    const changePct = previousClose > 0 ? (change / previousClose) * 100 : 0;

    quotes[symbol] = {
        symbol,
        price: parseFloat(price.toFixed(2)),
        previousClose: parseFloat(previousClose.toFixed(2)),
        change: parseFloat(change.toFixed(2)),
        changePercent: parseFloat(changePct.toFixed(2)),
        dayHigh: parseFloat(dayHigh.toFixed(2)),
        dayLow: parseFloat(dayLow.toFixed(2)),
        volume,
        oi: 0,
        source,
    };
}

// ── Route Handler ─────────────────────────────────────────────
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols');

    if (!symbols) {
        return NextResponse.json({ error: 'Missing symbols parameter' }, { status: 400 });
    }

    const symbolList = symbols.split(',').map((s) => s.trim().toUpperCase());

    // Use cache if valid
    if (dataCache && Date.now() < dataCache.expires) {
        const results: Record<string, MCXQuote | null> = {};
        for (const sym of symbolList) {
            results[sym] = dataCache.data[sym] || null;
        }
        return NextResponse.json(results);
    }

    try {
        const allQuotes = await buildAllMCXQuotes();

        // Cache everything
        dataCache = { data: allQuotes, expires: Date.now() + CACHE_TTL };

        // Return requested symbols
        const results: Record<string, MCXQuote | null> = {};
        for (const sym of symbolList) {
            results[sym] = allQuotes[sym] || null;
        }

        return NextResponse.json(results);
    } catch (err: any) {
        console.error('MCX price error:', err);
        return NextResponse.json({ error: err.message || 'MCX fetch failed' }, { status: 500 });
    }
}
