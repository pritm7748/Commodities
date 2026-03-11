// FRED API proxy route — Federal Reserve Economic Data
// Free API: https://api.stlouisfed.org/

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const seriesId = searchParams.get('series_id');
    const limit = searchParams.get('limit') || '2'; // default last 2 observations for current + previous

    if (!seriesId) {
        return NextResponse.json({ error: 'Missing series_id parameter' }, { status: 400 });
    }

    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'FRED_API_KEY not configured' }, { status: 500 });
    }

    try {
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}`;

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'CommodityHQ/1.0',
            },
            next: { revalidate: 3600 }, // cache for 1 hour (macro data updates infrequently)
        });

        if (!res.ok) {
            throw new Error(`FRED returned ${res.status}`);
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('FRED API error:', error.message);
        return NextResponse.json(
            { error: 'Failed to fetch from FRED', message: error.message },
            { status: 502 }
        );
    }
}
