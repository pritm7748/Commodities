// ═══════════════════════════════════════════════════════════
// News Cache Service — Server-side daily cache for NewsData.io
// Fetches 50 articles in 5×10 batches, deduplicates by title,
// and caches to disk so API credits aren't wasted on repeat visits.
// ═══════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';

interface CachedNews {
    fetchedAt: string;          // ISO timestamp
    articles: NewsArticle[];
}

export interface NewsArticle {
    title?: string;
    description?: string;
    link?: string;
    pubDate?: string;
    source_name?: string;
    category?: string[];
    sentiment?: string;
    image_url?: string | null;
    [key: string]: unknown;
}

const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'news-cache.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const BATCH_SIZE = 10;  // NewsData.io free plan max per request
const BATCH_COUNT = 5;  // 5 batches × 10 = 50 raw articles
const BATCH_DELAY_MS = 1100; // slight delay between batches to avoid rate-limiting

// ── Helpers ───────────────────────────────────────────────

function normalizeTitle(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
    const seen = new Set<string>();
    const deduped: NewsArticle[] = [];

    for (const article of articles) {
        if (!article.title) continue;
        const norm = normalizeTitle(article.title);
        // Match on first 50 chars to catch near-identical titles from different regions
        const key = norm.length > 50 ? norm.substring(0, 50) : norm;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(article);
    }

    return deduped;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Cache I/O ─────────────────────────────────────────────

function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}

function readCache(): CachedNews | null {
    try {
        if (!fs.existsSync(CACHE_FILE)) return null;
        const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
        const cached: CachedNews = JSON.parse(raw);
        return cached;
    } catch {
        return null;
    }
}

function writeCache(articles: NewsArticle[]) {
    ensureCacheDir();
    const data: CachedNews = {
        fetchedAt: new Date().toISOString(),
        articles,
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function isCacheValid(cached: CachedNews): boolean {
    const fetchedDate = new Date(cached.fetchedAt);
    const now = new Date();

    // Invalidate if it's a new calendar day (clears stale cache automatically)
    const sameDay =
        fetchedDate.getFullYear() === now.getFullYear() &&
        fetchedDate.getMonth() === now.getMonth() &&
        fetchedDate.getDate() === now.getDate();

    if (!sameDay) {
        // Delete stale cache file to free storage
        try { fs.unlinkSync(CACHE_FILE); } catch { /* ignore */ }
        return false;
    }

    return true;
}

// ── Batch Fetcher ─────────────────────────────────────────

async function fetchBatch(
    apiKey: string,
    query: string,
    category: string,
    language: string,
    nextPage?: string,
): Promise<{ articles: NewsArticle[]; nextPage?: string }> {
    let url = `https://newsdata.io/api/1/latest?apikey=${apiKey}&q=${encodeURIComponent(query)}&category=${category}&language=${language}&size=${BATCH_SIZE}`;
    if (nextPage) {
        url += `&page=${nextPage}`;
    }

    const res = await fetch(url, {
        headers: { 'User-Agent': 'CommodityHQ/1.0' },
    });

    if (!res.ok) {
        throw new Error(`NewsData returned ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    return {
        articles: data?.results || [],
        nextPage: data?.nextPage || undefined,
    };
}

// ── Main Entry Point ──────────────────────────────────────

export async function getNews(options: {
    forceRefresh?: boolean;
    query?: string;
    category?: string;
    language?: string;
} = {}): Promise<{ articles: NewsArticle[]; fromCache: boolean; fetchedAt: string }> {
    const {
        forceRefresh = false,
        query = 'commodity OR crude oil OR gold OR OPEC OR geopolitical',
        category = 'business',
        language = 'en',
    } = options;

    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
        throw new Error('NEWS_API_KEY not configured');
    }

    // Check cache first (unless forced refresh)
    if (!forceRefresh) {
        const cached = readCache();
        if (cached && isCacheValid(cached) && cached.articles.length > 0) {
            return {
                articles: cached.articles,
                fromCache: true,
                fetchedAt: cached.fetchedAt,
            };
        }
    }

    // Fetch in batches of 10
    const allArticles: NewsArticle[] = [];
    let nextPage: string | undefined;

    for (let batch = 0; batch < BATCH_COUNT; batch++) {
        try {
            const result = await fetchBatch(apiKey, query, category, language, nextPage);
            allArticles.push(...result.articles);
            nextPage = result.nextPage;

            // If no more pages, stop early
            if (!nextPage) break;

            // Delay between batches to avoid rate-limiting
            if (batch < BATCH_COUNT - 1) {
                await sleep(BATCH_DELAY_MS);
            }
        } catch (err) {
            console.error(`News batch ${batch + 1} failed:`, err);
            // If we already have some articles, continue with what we have
            if (allArticles.length > 0) break;
            throw err;
        }
    }

    // Deduplicate
    const deduped = deduplicateArticles(allArticles);

    // Write to cache
    writeCache(deduped);

    return {
        articles: deduped,
        fromCache: false,
        fetchedAt: new Date().toISOString(),
    };
}
