// Yahoo Finance Options Chain API proxy
// Uses cookie/crumb authentication required by Yahoo Finance v7 API

import { NextResponse } from 'next/server';

// Cache the auth credentials (cookies + crumb) — valid for ~30 minutes
let authCache: { cookies: string; crumb: string; expires: number } | null = null;

async function getYahooAuth(): Promise<{ cookies: string; crumb: string }> {
    // Return cached auth if still valid
    if (authCache && Date.now() < authCache.expires) {
        return { cookies: authCache.cookies, crumb: authCache.crumb };
    }

    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    // Step 1: Get consent/session cookies from Yahoo
    const initRes = await fetch('https://fc.yahoo.com', {
        redirect: 'manual',
        headers: { 'User-Agent': UA },
    });

    // Collect Set-Cookie headers
    const rawCookies: string[] = [];
    initRes.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') {
            rawCookies.push(value.split(';')[0]);
        }
    });

    // Also try getSetCookie if available
    if (typeof (initRes.headers as any).getSetCookie === 'function') {
        const setCookies = (initRes.headers as any).getSetCookie();
        for (const c of setCookies) {
            const cookiePart = c.split(';')[0];
            if (!rawCookies.includes(cookiePart)) {
                rawCookies.push(cookiePart);
            }
        }
    }

    const cookieStr = rawCookies.join('; ');

    // Step 2: Get crumb using the cookies
    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
        headers: {
            'User-Agent': UA,
            Cookie: cookieStr,
        },
    });

    if (!crumbRes.ok) {
        throw new Error(`Failed to get Yahoo crumb: ${crumbRes.status}`);
    }

    const crumb = await crumbRes.text();

    if (!crumb || crumb.length > 50) {
        throw new Error('Invalid crumb received from Yahoo');
    }

    // Cache for 20 minutes
    authCache = { cookies: cookieStr, crumb, expires: Date.now() + 20 * 60 * 1000 };

    return { cookies: cookieStr, crumb };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const date = searchParams.get('date');

    if (!symbol) {
        return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
    }

    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    try {
        // Get auth credentials
        const { cookies, crumb } = await getYahooAuth();

        // Build URL with crumb
        let url = `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(symbol)}?crumb=${encodeURIComponent(crumb)}`;
        if (date) {
            url += `&date=${date}`;
        }

        const res = await fetch(url, {
            headers: {
                'User-Agent': UA,
                Cookie: cookies,
                Accept: 'application/json',
            },
        });

        if (!res.ok) {
            // If 401, invalidate cache and retry once
            if (res.status === 401 && authCache) {
                authCache = null;
                const retryAuth = await getYahooAuth();
                let retryUrl = `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(symbol)}?crumb=${encodeURIComponent(retryAuth.crumb)}`;
                if (date) retryUrl += `&date=${date}`;

                const retryRes = await fetch(retryUrl, {
                    headers: {
                        'User-Agent': UA,
                        Cookie: retryAuth.cookies,
                        Accept: 'application/json',
                    },
                });

                if (!retryRes.ok) {
                    throw new Error(`Yahoo Options returned ${retryRes.status} after retry`);
                }

                const retryData = await retryRes.json();
                return processOptionsData(retryData);
            }

            throw new Error(`Yahoo Options returned ${res.status}`);
        }

        const data = await res.json();
        return processOptionsData(data);
    } catch (error: any) {
        console.error('Yahoo Options API error:', error.message);
        return NextResponse.json(
            { error: 'Failed to fetch options data', message: error.message },
            { status: 502 }
        );
    }
}

function processOptionsData(data: any): NextResponse {
    const result = data?.optionChain?.result?.[0];

    if (!result) {
        return NextResponse.json({ error: 'No options data available' }, { status: 404 });
    }

    const quote = result.quote;
    const underlyingPrice = quote?.regularMarketPrice || 0;
    const expirationDates = (result.expirationDates || []).map((ts: number) =>
        new Date(ts * 1000).toISOString().split('T')[0]
    );

    const calls = result.options?.[0]?.calls || [];
    const puts = result.options?.[0]?.puts || [];

    // Build unified strike map
    const strikeMap = new Map<number, any>();

    for (const call of calls) {
        const strike = call.strike;
        if (!strikeMap.has(strike)) {
            strikeMap.set(strike, {
                strike,
                callOI: 0, callVolume: 0, callLTP: 0, callIV: 0, callChange: 0,
                putOI: 0, putVolume: 0, putLTP: 0, putIV: 0, putChange: 0,
            });
        }
        const entry = strikeMap.get(strike)!;
        entry.callOI = call.openInterest || 0;
        entry.callVolume = call.volume || 0;
        entry.callLTP = call.lastPrice || 0;
        entry.callIV = call.impliedVolatility ? parseFloat((call.impliedVolatility * 100).toFixed(1)) : 0;
        entry.callChange = call.change || 0;
    }

    for (const put of puts) {
        const strike = put.strike;
        if (!strikeMap.has(strike)) {
            strikeMap.set(strike, {
                strike,
                callOI: 0, callVolume: 0, callLTP: 0, callIV: 0, callChange: 0,
                putOI: 0, putVolume: 0, putLTP: 0, putIV: 0, putChange: 0,
            });
        }
        const entry = strikeMap.get(strike)!;
        entry.putOI = put.openInterest || 0;
        entry.putVolume = put.volume || 0;
        entry.putLTP = put.lastPrice || 0;
        entry.putIV = put.impliedVolatility ? parseFloat((put.impliedVolatility * 100).toFixed(1)) : 0;
        entry.putChange = put.change || 0;
    }

    const options = Array.from(strikeMap.values()).sort((a, b) => a.strike - b.strike);

    return NextResponse.json({
        underlyingPrice,
        expirationDates,
        options,
    });
}
