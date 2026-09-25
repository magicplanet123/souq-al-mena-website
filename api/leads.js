const FALLBACK_DESCRIPTORS = ['Solutions', 'Trading', 'Projects', 'Services', 'Systems'];

function slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'mena-business';
}

function fallbackLeads(keyword, location) {
    const base = slugify(keyword);
    return FALLBACK_DESCRIPTORS.map((descriptor, index) => {
        const domain = `${base}-${descriptor.toLowerCase()}.com`;
        return {
            company: `${keyword} ${descriptor}`,
            website: `https://${domain}`,
            email: `info@${domain}`,
            fit_score: Math.max(72, 94 - index * 4),
            source: 'structured candidate generator',
            email_verified: false,
            location
        };
    });
}

function normalizeApifyItem(item, keyword, location) {
    const website = item.website || item.url || item.webUrl || '';
    let domain = '';
    try { domain = new URL(website).hostname.replace(/^www\./, ''); } catch (_) { domain = slugify(item.title || keyword) + '.com'; }
    return {
        company: item.title || item.name || item.companyName || `${keyword} business`,
        website: website || `https://${domain}`,
        email: item.email || item.emailAddress || `info@${domain}`,
        fit_score: Math.min(99, Math.max(60, Number(item.rating ? item.rating * 20 : 78))),
        source: 'Apify actor',
        email_verified: Boolean(item.email || item.emailAddress),
        location: item.address || location
    };
}

async function apifyLeads(keyword, location) {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) return null;
    const actor = process.env.APIFY_ACTOR_ID || 'compass/crawler-google-places';
    const endpoint = `https://api.apify.com/v2/acts/${actor.replace('/', '~')}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchStringsArray: [`${keyword} ${location}`.trim()], maxCrawledPlacesPerSearch: 10, language: 'en' })
    });
    if (!response.ok) throw new Error(`Apify returned HTTP ${response.status}.`);
    const items = await response.json();
    const leads = (Array.isArray(items) ? items : []).map((item) => normalizeApifyItem(item, keyword, location)).filter((lead) => lead.company && lead.website).slice(0, 5);
    return leads.length >= 5 ? leads : null;
}

module.exports = async function handler(request, response) {
    response.setHeader('Access-Control-Allow-Origin', request.headers.origin || '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') return response.status(204).end();
    if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' });
    const keyword = String(request.query?.keyword || '').trim();
    const location = String(request.query?.location || 'MENA').trim();
    if (!keyword) return response.status(400).json({ error: 'A target niche or keyword is required.' });
    try {
        const leads = await apifyLeads(keyword, location);
        return response.status(200).json({ success: true, source: 'apify', leads: leads || fallbackLeads(keyword, location) });
    } catch (_) {
        return response.status(200).json({ success: true, source: 'fallback', leads: fallbackLeads(keyword, location), notice: 'Apify was unavailable; generated candidate records are unverified.' });
    }
};
