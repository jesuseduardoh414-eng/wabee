import * as cheerio from 'cheerio';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_CONTENT_CHARS = 120_000;

export interface ScrapeResult {
    title: string;
    text: string;
    url: string;
}

/**
 * Downloads a public URL, strips markup, and returns clean text for RAG indexing.
 * Only works with public HTTP/HTTPS pages. Does not support login-gated content.
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let html: string;
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'WabeeKnowledgeBot/1.0 (+https://wabee.app)' },
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status} fetching ${url}`);
        }

        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
            throw new Error(`Unsupported content-type "${contentType}" — only HTML and plain text are supported`);
        }

        html = await res.text();
    } finally {
        clearTimeout(timer);
    }

    const $ = cheerio.load(html);

    // Remove non-content elements
    $('script, style, noscript, nav, footer, header, aside, [role="navigation"], [role="banner"], [aria-hidden="true"], .cookie-banner, #cookie-banner').remove();

    const title = $('title').first().text().trim() || $('h1').first().text().trim() || url;

    // Extract text from content areas (prefer article/main, fall back to body)
    const contentSelector = 'article, main, [role="main"], .content, #content, body';
    let text = $(contentSelector).first().text();

    if (!text || text.trim().length < 100) {
        text = $('body').text();
    }

    // Normalize whitespace
    text = text
        .replace(/\t/g, ' ')
        .replace(/ {2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (text.length > MAX_CONTENT_CHARS) {
        text = text.slice(0, MAX_CONTENT_CHARS);
    }

    if (text.trim().length < 50) {
        throw new Error('Page contains no readable text content (< 50 chars after extraction)');
    }

    return { title, text, url };
}
