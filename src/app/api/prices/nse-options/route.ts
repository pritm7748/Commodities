// MCX Commodity Options Chain API
// Calls Python helper script (scripts/mcx_option_chain.py) which uses
// requests.Session() to handle MCX India's Akamai anti-bot cookies.
// The Python script fetches real-time option chain data from mcxindia.com.

import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';

const execFileAsync = promisify(execFile);

// ── In-memory cache ───────────────────────────────────────────
interface CachedChain {
    data: any;
    expires: number;
}
const chainCache = new Map<string, CachedChain>();
const CACHE_TTL = 60 * 1000; // 1 min

// ── Persistent file cache (survives restarts) ──────────────────
const CACHE_DIR = path.join(process.cwd(), '.cache', 'mcx-options');

async function saveToFileCache(symbol: string, data: any): Promise<void> {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
        await fs.writeFile(
            path.join(CACHE_DIR, `${symbol}.json`),
            JSON.stringify({ data, savedAt: new Date().toISOString() })
        );
    } catch {
        // Silently fail — file cache is best-effort
    }
}

async function loadFromFileCache(symbol: string): Promise<any | null> {
    try {
        const raw = await fs.readFile(path.join(CACHE_DIR, `${symbol}.json`), 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed?.data) {
            return { ...parsed.data, cachedAt: parsed.savedAt };
        }
    } catch {
        // No cached file
    }
    return null;
}

// ── Check if data has actual values (not just skeleton) ───────
function hasActualData(options: any[]): boolean {
    return options.some(o =>
        o.callOI > 0 || o.callLTP > 0 || o.putOI > 0 || o.putLTP > 0
    );
}

// ── Call Python helper script ─────────────────────────────────
async function fetchMCXOptionChain(symbol: string, expiry?: string): Promise<any> {
    const scriptPath = path.join(process.cwd(), 'scripts', 'mcx_option_chain.py');
    const args = [scriptPath, symbol];
    if (expiry) args.push(expiry);

    try {
        const { stdout, stderr } = await execFileAsync('python', args, {
            timeout: 30000, // 30s timeout
            maxBuffer: 10 * 1024 * 1024, // 10MB
            cwd: process.cwd(),
        });

        if (stderr) {
            console.warn(`MCX Python stderr for ${symbol}:`, stderr.substring(0, 200));
        }

        const result = JSON.parse(stdout.trim());
        return result;
    } catch (err: any) {
        console.error(`MCX Python script error for ${symbol}:`, err.message || err);
        return { error: `Python script failed: ${err.message || 'Unknown error'}` };
    }
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

    // Fetch from MCX India via Python script
    const mcxData = await fetchMCXOptionChain(upperSymbol, expiry);

    if (mcxData.error) {
        console.warn(`MCX fetch warning for ${upperSymbol}:`, mcxData.error);

        // Try file cache
        const fileCached = await loadFromFileCache(upperSymbol);
        if (fileCached && fileCached.options && hasActualData(fileCached.options)) {
            const result = {
                ...fileCached,
                source: 'MCX India — cached from last session',
                expirationDates: mcxData.expirationDates || fileCached.expirationDates || [],
            };
            chainCache.set(upperSymbol, { data: result, expires: Date.now() + CACHE_TTL });
            return NextResponse.json(result);
        }

        return NextResponse.json({
            symbol: upperSymbol,
            underlyingPrice: 0,
            expirationDates: mcxData.expirationDates || [],
            options: [],
            source: 'none',
            error: mcxData.error,
        });
    }

    // Check if the data has actual values
    const liveDataAvailable = mcxData.options && mcxData.options.length > 0 && hasActualData(mcxData.options);

    if (liveDataAvailable) {
        // Cache in memory + persist to file
        chainCache.set(upperSymbol, { data: mcxData, expires: Date.now() + CACHE_TTL });
        await saveToFileCache(upperSymbol, mcxData);
        return NextResponse.json(mcxData);
    }

    // Data returned but all zeros — try file cache
    const fileCached = await loadFromFileCache(upperSymbol);
    if (fileCached && fileCached.options && hasActualData(fileCached.options)) {
        const result = {
            ...fileCached,
            source: 'MCX India — last session data (market closed)',
            marketClosed: true,
            info: 'Showing data from last trading session. Live data available during MCX market hours (Mon-Fri 9:00 AM – 11:30 PM IST).',
        };
        chainCache.set(upperSymbol, { data: result, expires: Date.now() + CACHE_TTL });
        return NextResponse.json(result);
    }

    // Return whatever we got
    return NextResponse.json(mcxData);
}
