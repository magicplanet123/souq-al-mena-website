const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10000;

function decodeEntities(value) {
    return value
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function extractFirst(html, pattern) {
    const match = html.match(pattern);
    return match ? decodeEntities(match[1].replace(/<[^>]+>/g, '').trim()) : '';
}

function extractMeta(html, name) {
    const tagPattern = /<meta\b[^>]*>/gi;
    const attributePattern = new RegExp(`(?:name|property)=["']${name}["']`, 'i');
    const contentPattern = /content=["']([^"']*)["']/i;
    for (const tag of html.match(tagPattern) || []) {
        if (attributePattern.test(tag)) {
            const match = tag.match(contentPattern);
            return match ? decodeEntities(match[1].trim()) : '';
        }
    }
    return '';
}

function isPublicUrl(value) {
    let parsed;
    try {
        parsed = new URL(value);
    } catch (_) {
        return false;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '::1' || hostname.endsWith('.local')) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(hostname)) return false;
    if (hostname.startsWith('172.')) {
        const secondOctet = Number(hostname.split('.')[1]);
        if (secondOctet >= 16 && secondOctet <= 31) return false;
    }
    return true;
}

module.exports = async function handler(request, response) {
    response.setHeader('Access-Control-Allow-Origin', request.headers.origin || '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

    if (request.method === 'OPTIONS') {
        response.status(204).end();
        return;
    }
    if (request.method !== 'GET') {
        response.status(405).json({ error: 'Method not allowed.' });
        return;
    }

    const target = Array.isArray(request.query?.url) ? request.query.url[0] : request.query?.url;
    if (!target || !isPublicUrl(target)) {
        response.status(400).json({ error: 'A public HTTP or HTTPS URL is required.' });
        return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const upstream = await fetch(target, {
            headers: { 'User-Agent': 'SouqMENA-MetadataBot/1.0 (+https://souq-mena.com)' },
            redirect: 'follow',
            signal: controller.signal
        });
        if (!upstream.ok) {
            response.status(502).json({ error: `Target website returned HTTP ${upstream.status}.` });
            return;
        }
        const contentType = upstream.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
            response.status(415).json({ error: 'Target URL did not return an HTML page.' });
            return;
        }
        const html = await upstream.text();
        if (Buffer.byteLength(html, 'utf8') > MAX_RESPONSE_BYTES) {
            response.status(413).json({ error: 'Target page exceeds the metadata size limit.' });
            return;
        }
        const finalUrl = upstream.url || target;
        response.status(200).json({
            url: finalUrl,
            title: extractFirst(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i),
            description: extractMeta(html, 'description') || extractMeta(html, 'og:description'),
            h1: extractFirst(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i),
            siteName: extractMeta(html, 'og:site_name'),
            canonical: extractFirst(html, /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
        });
    } catch (error) {
        const message = error.name === 'AbortError' ? 'Target website timed out.' : 'Could not retrieve the target website.';
        response.status(502).json({ error: message });
    } finally {
        clearTimeout(timeout);
    }
};
