// MCX Commodity Options Chain API — Pure Node.js (Vercel-compatible)
// Fetches real-time option chain data from mcxindia.com using fetch().
// No Python dependency, no filesystem writes.

import { NextResponse } from 'next/server';

// ── Types ─────────────────────────────────────────────────────
interface OptionRow {
    strike: number;
    callOI: number;
    callVolume: number;
    callLTP: number;
    callChange: number;
    callIV: number;
    callBidQty: number;
    callBidPrice: number;
    callAskQty: number;
    callAskPrice: number;
    putOI: number;
    putVolume: number;
    putLTP: number;
    putChange: number;
    putIV: number;
    putBidQty: number;
    putBidPrice: number;
    putAskQty: number;
    putAskPrice: number;
}

// ── In-memory cache ───────────────────────────────────────────
interface CachedChain {
    data: any;
    expires: number;
}
const chainCache = new Map<string, CachedChain>();
const CACHE_TTL = 60 * 1000; // 1 min

// ── MCX API Configuration ─────────────────────────────────────
const BASE_URL = 'https://www.mcxindia.com';

const MCX_HEADERS: Record<string, string> = {
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Content-Type': 'application/json',
    'Origin': BASE_URL,
    'Referer': `${BASE_URL}/market-data/option-chain`,
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'X-Requested-With': 'XMLHttpRequest',
};

// ── Session cookie handling ───────────────────────────────────
// MCX requires session cookies set by visiting the homepage first

async function createSession(): Promise<string[]> {
    try {
        const res = await fetch(BASE_URL, {
            headers: { 'User-Agent': MCX_HEADERS['User-Agent'] },
            redirect: 'follow',
        });
        // Extract Set-Cookie headers
        const cookies: string[] = [];
        const setCookies = res.headers.getSetCookie?.() || [];
        for (const c of setCookies) {
            const name = c.split(';')[0];
            if (name) cookies.push(name);
        }
        return cookies;
    } catch {
        return [];
    }
}

function parseExpiry(expStr: string): Date | null {
    // Parse "27FEB2026" format
    const months: Record<string, number> = {
        JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
        JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
    };
    const match = expStr.match(/^(\d{2})([A-Z]{3})(\d{4})$/);
    if (!match) return null;
    const [, day, mon, year] = match;
    const monthIdx = months[mon];
    if (monthIdx === undefined) return null;
    return new Date(parseInt(year), monthIdx, parseInt(day));
}

// ── Get expiry dates from market watch ────────────────────────
async function getExpiryDates(cookies: string[], commodity: string): Promise<string[]> {
    try {
        const res = await fetch(`${BASE_URL}/backpage.aspx/GetMarketWatch`, {
            method: 'POST',
            headers: {
                ...MCX_HEADERS,
                'Cookie': cookies.join('; '),
            },
            body: JSON.stringify({}),
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) return [];

        const data = await res.json();
        const items = data?.d?.Data || [];
        const expiries = new Set<string>();

        for (const item of items) {
            const sym = (item?.Symbol || '').toUpperCase();
            if (sym === commodity.toUpperCase()) {
                const exp = item?.ExpiryDate;
                if (exp) expiries.add(exp);
            }
        }

        // Sort chronologically
        return Array.from(expiries).sort((a, b) => {
            const da = parseExpiry(a);
            const db = parseExpiry(b);
            if (!da || !db) return 0;
            return da.getTime() - db.getTime();
        });
    } catch {
        return [];
    }
}

// ── Fetch option chain ────────────────────────────────────────
async function fetchOptionChain(commodity: string, expiry?: string): Promise<any> {
    const cookies = await createSession();
    let expiryDates: string[] = [];

    if (!expiry) {
        expiryDates = await getExpiryDates(cookies, commodity);
        if (expiryDates.length > 0) {
            expiry = expiryDates[0];
        } else {
            // Fallback: guess nearest future date
            const now = new Date();
            expiry = `${String(now.getDate()).padStart(2, '0')}${now.toLocaleString('en', { month: 'short' }).toUpperCase()}${now.getFullYear()}`;
        }
    }

    // Normalize expiry format (convert dd-mm-yyyy to ddMMMYYYY)
    if (expiry && expiry.includes('-')) {
        const parts = expiry.split('-');
        if (parts.length === 3) {
            const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            expiry = `${String(d.getDate()).padStart(2, '0')}${d.toLocaleString('en', { month: 'short' }).toUpperCase()}${d.getFullYear()}`;
        }
    }

    try {
        const res = await fetch(`${BASE_URL}/backpage.aspx/GetOptionChain`, {
            method: 'POST',
            headers: {
                ...MCX_HEADERS,
                'Cookie': cookies.join('; '),
            },
            body: JSON.stringify({ Commodity: commodity.toUpperCase(), Expiry: expiry }),
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
            return { error: `MCX API returned ${res.status}` };
        }

        const data = await res.json();
        const items = data?.d?.Data || [];
        const summary = data?.d?.Summary || {};

        if (!items || items.length === 0) {
            return {
                error: `No data for ${commodity}/${expiry}`,
                expirationDates: expiryDates,
            };
        }

        const underlying = items[0]?.UnderlyingValue || 0;

        const options: OptionRow[] = [];
        for (const item of items) {
            const strike = item.CE_StrikePrice || item.PE_StrikePrice || 0;
            if (strike === 0) continue;

            options.push({
                strike,
                callOI: item.CE_OpenInterest || 0,
                callVolume: item.CE_Volume || 0,
                callLTP: item.CE_LTP || 0,
                callChange: item.CE_AbsoluteChange || 0,
                callIV: 0,
                callBidQty: item.CE_BidQty || 0,
                callBidPrice: item.CE_BidPrice || 0,
                callAskQty: item.CE_AskQty || 0,
                callAskPrice: item.CE_AskPrice || 0,
                putOI: item.PE_OpenInterest || 0,
                putVolume: item.PE_Volume || 0,
                putLTP: item.PE_LTP || 0,
                putChange: item.PE_AbsoluteChange || 0,
                putIV: 0,
                putBidQty: item.PE_BidQty || 0,
                putBidPrice: item.PE_BidPrice || 0,
                putAskQty: item.PE_AskQty || 0,
                putAskPrice: item.PE_AskPrice || 0,
            });
        }

        // Sort by strike
        options.sort((a, b) => a.strike - b.strike);

        // Parse as-on timestamp
        let asOn: string | null = null;
        if (summary?.AsOn) {
            const match = String(summary.AsOn).match(/\((\d+)\)/);
            if (match) {
                const ts = parseInt(match[1]) / 1000;
                asOn = new Date(ts * 1000).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
            }
        }

        return {
            symbol: commodity.toUpperCase(),
            underlyingPrice: underlying,
            expirationDates: expiryDates.length > 0 ? expiryDates : [expiry],
            options,
            source: 'MCX India (Live)',
            currency: '₹',
            asOn,
            totalStrikes: summary?.Count || options.length,
        };
    } catch (err: any) {
        if (err.name === 'TimeoutError') {
            return { error: 'MCX API timeout' };
        }
        return { error: err.message || String(err) };
    }
}

// ── Check if data has actual values ───────────────────────────
function hasActualData(options: OptionRow[]): boolean {
    return options.some(o =>
        o.callOI > 0 || o.callLTP > 0 || o.putOI > 0 || o.putLTP > 0
    );
}

// ── Route Handler ─────────────────────────────────────────────
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
    }

    const upperSymbol = symbol.toUpperCase();
    const expiry = searchParams.get('expiry') || undefined;

    // Check in-memory cache
    const cached = chainCache.get(upperSymbol);
    if (cached && Date.now() < cached.expires) {
        return NextResponse.json(cached.data);
    }

    // Fetch from MCX India
    const mcxData = await fetchOptionChain(upperSymbol, expiry);

    if (mcxData.error) {
        console.warn(`MCX fetch warning for ${upperSymbol}:`, mcxData.error);
        return NextResponse.json({
            symbol: upperSymbol,
            underlyingPrice: 0,
            expirationDates: mcxData.expirationDates || [],
            options: [],
            source: 'none',
            error: mcxData.error,
        });
    }

    // Cache and return
    const liveDataAvailable = mcxData.options?.length > 0 && hasActualData(mcxData.options);
    if (liveDataAvailable) {
        chainCache.set(upperSymbol, { data: mcxData, expires: Date.now() + CACHE_TTL });
    }

    return NextResponse.json(mcxData);
}
