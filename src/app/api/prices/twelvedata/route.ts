// Twelve Data API proxy route — supports quotes and time_series

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols');
    const type = searchParams.get('type') || 'quote'; // 'quote' or 'timeseries'
    const interval = searchParams.get('interval') || '1day';
    const outputsize = searchParams.get('outputsize') || '180';

    if (!symbols) {
        return NextResponse.json({ error: 'Missing symbols parameter' }, { status: 400 });
    }

    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'Twelve Data API key not configured' }, { status: 500 });
    }

    try {
        let url: string;

        if (type === 'timeseries') {
            url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbols)}&interval=${interval}&outputsize=${outputsize}&apikey=${apiKey}`;
        } else {
            url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols)}&apikey=${apiKey}`;
        }

        const res = await fetch(url, {
            next: { revalidate: 60 },
        });

        if (!res.ok) {
            throw new Error(`Twelve Data returned ${res.status}`);
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Twelve Data API error:', error.message);
        return NextResponse.json(
            { error: 'Failed to fetch from Twelve Data', message: error.message },
            { status: 502 }
        );
    }
}
