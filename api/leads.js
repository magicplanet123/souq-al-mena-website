const PROSPECT_CATALOG = {
    property: [
        ['Betterhomes', 'https://www.betterhomes.com', 'info@betterhomes.com'],
        ['Bayut', 'https://www.bayut.com', 'info@bayut.com'],
        ['Asteco', 'https://www.asteco.com', 'info@asteco.com'],
        ['Metropolitan Group', 'https://metropolitan.realestate', 'info@metropolitan.realestate'],
        ['Allsopp & Allsopp', 'https://www.allsoppandallsopp.com', 'info@allsoppandallsopp.com']
    ],
    ecommerce: [
        ['Noon', 'https://www.noon.com', 'care@noon.com'],
        ['Namshi', 'https://www.namshi.com', 'care@namshi.com'],
        ['Carrefour UAE', 'https://www.carrefouruae.com', 'customer.service@maf.co.ae'],
        ['The Luxury Closet', 'https://theluxurycloset.com', 'support@theluxurycloset.com'],
        ['Ounass', 'https://www.ounass.ae', 'care@ounass.ae']
    ],
    retail: [
        ['Landmark Group', 'https://www.landmarkgroup.com', 'info@landmarkgroup.com'],
        ['Al-Futtaim Retail', 'https://www.alfuttaim.com', 'info@alfuttaim.com'],
        ['Lulu Hypermarket UAE', 'https://www.luluhypermarket.com', 'care@luluhypermarket.com'],
        ['Jumbo Electronics', 'https://www.jumbo.ae', 'info@jumbo.ae'],
        ['Azadea Group', 'https://www.azadeagroup.com', 'info@azadeagroup.com']
    ],
    healthcare: [
        ['Aster Hospitals UAE', 'https://www.asterhospitals.ae', 'info@asterhospitals.ae'],
        ['NMC Healthcare', 'https://www.nmchealthcare.com', 'info@nmchealthcare.com'],
        ['Mediclinic Middle East', 'https://www.mediclinic.ae', 'info@mediclinic.ae'],
        ['Saudi German Hospital UAE', 'https://www.sghuae.com', 'info@sghuae.com'],
        ['Burjeel Holdings', 'https://burjeel.com', 'info@burjeel.com']
    ]
};

function normalizeIntent(value) {
    const raw = String(value || '').toLowerCase().trim();
    const cleaned = raw
        .replace(/\b(give me|find me|get me|show me|generate|the|leads?|for|of|my|services?|companies|in|near|please)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (/seo|search engine|digital marketing|marketing|web design|advertis/.test(raw)) return { core: 'SEO', category: 'all' };
    if (/real estate|property|estate agent|realty/.test(raw)) return { core: 'Property Management', category: 'property' };
    if (/e.?commerce|online store|retail online|marketplace/.test(raw)) return { core: 'E-Commerce', category: 'ecommerce' };
    if (/health|clinic|hospital|medical|doctor/.test(raw)) return { core: 'Healthcare', category: 'healthcare' };
    if (/retail|shop|store|fashion|consumer/.test(raw)) return { core: 'Retail', category: 'retail' };
    return { core: cleaned || 'UAE business', category: 'all' };
}

function fallbackLeads(keyword, location) {
    const intent = normalizeIntent(keyword);
    const categories = intent.category === 'all' ? ['property', 'ecommerce', 'retail', 'healthcare'] : [intent.category];
    const records = categories.flatMap((category) => PROSPECT_CATALOG[category].map((record) => ({ record, category })));
    return records.slice(0, 5).map(({ record, category }, index) => ({
        company: record[0],
        website: record[1],
        email: record[2],
        fit_score: Math.max(78, 96 - index * 3),
        category,
        source: 'UAE prospect catalog',
        email_verified: false,
        location,
        notice: 'Public inbox format; verify before outreach.'
    }));
}

function normalizeApifyItem(item, keyword, location) {
    const website = item.website || item.url || item.webUrl || '';
    let domain = '';
    try { domain = new URL(website).hostname.replace(/^www\./, ''); } catch (_) { domain = 'unknown-domain.com'; }
    const company = item.title || item.name || item.companyName;
    if (!company || !website) return null;
    return {
        company,
        website,
        email: item.email || item.emailAddress || `info@${domain}`,
        fit_score: Math.min(99, Math.max(60, Number(item.rating ? item.rating * 20 : 78))),
        category: normalizeIntent(keyword).core,
        source: 'Apify actor',
        email_verified: Boolean(item.email || item.emailAddress),
        location: item.address || location
    };
}

async function apifyLeads(keyword, location) {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) return null;
    const intent = normalizeIntent(keyword);
    const actor = process.env.APIFY_ACTOR_ID || 'compass/crawler-google-places';
    const endpoint = `https://api.apify.com/v2/acts/${actor.replace('/', '~')}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchStringsArray: [`${intent.core} ${location}`.trim()], maxCrawledPlacesPerSearch: 10, language: 'en' })
    });
    if (!response.ok) throw new Error(`Apify returned HTTP ${response.status}.`);
    const items = await response.json();
    const leads = (Array.isArray(items) ? items : []).map((item) => normalizeApifyItem(item, keyword, location)).filter(Boolean).slice(0, 5);
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
        return response.status(200).json({
            success: true,
            source: leads ? 'apify' : 'catalog',
            leads: leads || fallbackLeads(keyword, location),
            notice: leads ? 'Live results returned by Apify.' : 'UAE prospect catalog results; verify public inboxes before outreach.'
        });
    } catch (_) {
        return response.status(200).json({
            success: true,
            source: 'catalog',
            leads: fallbackLeads(keyword, location),
            notice: 'Apify was unavailable; UAE prospect catalog results are unverified.'
        });
    }
};
