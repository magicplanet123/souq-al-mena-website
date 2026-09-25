const MAX_PAGES = 20;
const REQUEST_TIMEOUT_MS = 10000;
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function text(value) {
    return (value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function first(html, pattern) {
    const match = html.match(pattern);
    return match ? text(match[1]) : '';
}

function meta(html, name) {
    const tags = html.match(/<meta\b[^>]*>/gi) || [];
    const wanted = new RegExp(`(?:name|property)=["']${name}["']`, 'i');
    for (const tag of tags) {
        if (!wanted.test(tag)) continue;
        const match = tag.match(/content=["']([^"']*)["']/i);
        if (match) return match[1].trim();
    }
    return '';
}

function links(html, pageUrl) {
    return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map((match) => {
        try { return new URL(match[1], pageUrl); } catch (_) { return null; }
    }).filter(Boolean);
}

function issue(severity, title, description) {
    return { severity, title, description };
}

function auditPage(html, pageUrl, statusCode) {
    const title = first(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const description = meta(html, 'description') || meta(html, 'og:description');
    const h1Count = (html.match(/<h1\b/gi) || []).length;
    const wordCount = text(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')).split(/\s+/).filter(Boolean).length;
    const images = html.match(/<img\b[^>]*>/gi) || [];
    const missingAlt = images.filter((tag) => !/\balt=["'][^"']*["']/i.test(tag)).length;
    const canonical = first(html, /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    const page = new URL(pageUrl);
    const pageLinks = links(html, pageUrl);
    const internalLinks = pageLinks.filter((link) => link.hostname === page.hostname).map((link) => link.href);
    const externalLinks = pageLinks.filter((link) => link.hostname !== page.hostname).length;
    const issues = [];
    if (!title) issues.push(issue('error', 'Missing page title', 'No title element was found.'));
    else if (title.length < 30 || title.length > 60) issues.push(issue('warning', 'Title length needs attention', `The title is ${title.length} characters.`));
    if (!description) issues.push(issue('error', 'Missing meta description', 'No description meta tag was found.'));
    else if (description.length < 70 || description.length > 160) issues.push(issue('warning', 'Meta description length needs attention', `The description is ${description.length} characters.`));
    if (h1Count === 0) issues.push(issue('error', 'Missing H1 heading', 'No H1 heading was found.'));
    if (h1Count > 1) issues.push(issue('warning', 'Multiple H1 headings', `Found ${h1Count} H1 headings.`));
    if (wordCount < 300) issues.push(issue('warning', 'Low visible word count', `Found approximately ${wordCount} words.`));
    if (missingAlt) issues.push(issue('warning', 'Images missing alt text', `${missingAlt} of ${images.length} images need alt text.`));
    if (!html.includes('application/ld+json')) issues.push(issue('info', 'No structured data found', 'No JSON-LD block was found.'));
    if (statusCode >= 400) issues.push(issue('error', `HTTP ${statusCode} response`, 'The page returned an error status.'));
    return { url: pageUrl, status_code: statusCode, title, error_count: issues.filter((item) => item.severity === 'error').length, warning_count: issues.filter((item) => item.severity === 'warning').length, info_count: issues.filter((item) => item.severity === 'info').length, word_count: wordCount, internal_links: internalLinks.length, external_links: externalLinks, issues, internalLinks };
}

async function fetchPage(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'SouqMENA-SEO-Audit/1.0 (+https://souq-mena.com)' } });
        const html = await response.text();
        return { response, html };
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = async function handler(request, response) {
    response.setHeader('Access-Control-Allow-Origin', request.headers.origin || '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (request.method === 'OPTIONS') return response.status(204).end();
    if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
    const startUrl = String(request.body?.start_url || '').trim();
    let parsed;
    try { parsed = new URL(startUrl); } catch (_) { return response.status(400).json({ error: 'A valid website URL is required.' }); }
    if (!['http:', 'https:'].includes(parsed.protocol)) return response.status(400).json({ error: 'Only HTTP and HTTPS websites are supported.' });

    const queue = [parsed.href];
    const visited = new Set();
    const results = [];
    while (queue.length && results.length < Math.min(Number(request.body?.max_pages) || MAX_PAGES, MAX_PAGES)) {
        const url = queue.shift();
        if (visited.has(url)) continue;
        visited.add(url);
        try {
            const { response: upstream, html } = await fetchPage(url);
            const pageResult = auditPage(html, upstream.url || url, upstream.status);
            results.push(pageResult);
            for (const link of pageResult.internalLinks) {
                if (!visited.has(link) && queue.length < MAX_PAGES) queue.push(link.split('#')[0]);
            }
        } catch (error) {
            results.push({ url, status_code: 502, title: '', error_count: 1, warning_count: 0, info_count: 0, word_count: 0, internal_links: 0, external_links: 0, issues: [issue('error', 'Page fetch failed', error.name === 'AbortError' ? 'The page timed out.' : 'The page could not be fetched.')] });
        }
    }
    response.status(200).json({ success: true, status: { status: 'completed', pages_crawled: results.length, pages_failed: results.filter((item) => item.status_code >= 500).length }, results });
};
