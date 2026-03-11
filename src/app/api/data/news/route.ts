// News API proxy route — uses batched fetcher with daily disk cache
// Fetches 50 articles in 5×10 batches, deduplicates, caches for 24h.
// Pass ?refresh=true to force re-fetch from API.

import { NextResponse } from 'next/server';
import { getNews } from '@/lib/services/newsCache';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    try {
        const { articles, fromCache, fetchedAt } = await getNews({ forceRefresh });

        return NextResponse.json({
            status: 'success',
            totalResults: articles.length,
            fromCache,
            fetchedAt,
            results: articles,
        });
    } catch (error: any) {
        console.error('News API error:', error.message);
        return NextResponse.json(
            { error: 'Failed to fetch news', message: error.message },
            { status: 502 }
        );
    }
}
