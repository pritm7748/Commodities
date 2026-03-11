// EIA API proxy route — U.S. Energy Information Administration
// Free API: https://www.eia.gov/opendata/
// Key endpoints:
//   petroleum/stoc/wstk/data  — Weekly petroleum stocks
//   petroleum/crd/crpdn/data  — Crude oil production
//   natural-gas/stor/wkly/data — Weekly natural gas storage

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint'); // e.g. "petroleum/stoc/wstk/data"
    const frequency = searchParams.get('frequency') || 'weekly';
    const seriesId = searchParams.get('series_id'); // optional EIA series facet
    const limit = searchParams.get('limit') || '12';
    const dataCol = searchParams.get('data') || 'value'; // data column to return

    if (!endpoint) {
        return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
    }

    const apiKey = process.env.EIA_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'EIA_API_KEY not configured' }, { status: 500 });
    }

    try {
        // Always request the data column explicitly — without this, values are null
        let url = `https://api.eia.gov/v2/${endpoint}?api_key=${apiKey}&frequency=${frequency}&length=${limit}&data[0]=${dataCol}&sort[0][column]=period&sort[0][direction]=desc`;

        if (seriesId) {
            url += `&facets[series][]=${seriesId}`;
        }

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'CommodityHQ/1.0',
            },
            next: { revalidate: 300 }, // cache for 5 minutes
        });

        if (!res.ok) {
            throw new Error(`EIA returned ${res.status}`);
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('EIA API error:', error.message);
        return NextResponse.json(
            { error: 'Failed to fetch from EIA', message: error.message },
            { status: 502 }
        );
    }
}
