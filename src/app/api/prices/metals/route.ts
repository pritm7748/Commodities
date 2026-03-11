// Metals.dev API proxy — Precious metals live prices

import { NextResponse } from 'next/server';

export async function GET() {
    const apiKey = process.env.METALS_DEV_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'Metals.dev API key not configured' }, { status: 500 });
    }

    try {
        const url = `https://api.metals.dev/v1/latest?api_key=${apiKey}&currency=USD&unit=toz`;

        const res = await fetch(url, {
            next: { revalidate: 60 }, // ≤60s delay per their free tier
        });

        if (!res.ok) {
            throw new Error(`Metals.dev returned ${res.status}`);
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Metals.dev API error:', error.message);
        return NextResponse.json(
            { error: 'Failed to fetch from Metals.dev', message: error.message },
            { status: 502 }
        );
    }
}
