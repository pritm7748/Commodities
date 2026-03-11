// Yahoo Finance API proxy route
// Supports quote, chart, and historical data

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols');
    const range = searchParams.get('range') || '1d';
    const interval = searchParams.get('interval') || '1d';

    if (!symbols) {
        return NextResponse.json({ error: 'Missing symbols parameter' }, { status: 400 });
    }

    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbols)}?interval=${interval}&range=${range}`;

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            next: { revalidate: 60 },
        });

        if (!res.ok) {
            throw new Error(`Yahoo Finance returned ${res.status}`);
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Yahoo Finance API error:', error.message);
        return NextResponse.json(
            { error: 'Failed to fetch from Yahoo Finance', message: error.message },
            { status: 502 }
        );
    }
}
