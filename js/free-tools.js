(function () {
    'use strict';

    const FREE_USE_LIMIT = 3;
    const FREE_USE_KEY = 'souq-mena-free-tools-uses-v2';
    const LEAD_STORAGE_KEY = 'souq-mena-lead-records-v2';

    function normalizeUrl(value) {
        const candidate = value.trim();
        if (!candidate) {
            throw new Error('Enter a website URL.');
        }
        const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
        const parsed = new URL(withProtocol);
        if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
            throw new Error('Use a valid HTTP or HTTPS URL.');
        }
        parsed.hash = '';
        return parsed.toString();
    }

    function issue(category, severity, title, description, recommendation) {
        return { category, severity, title, description, recommendation };
    }

    function getFreeUseCount(tool) {
        const counts = JSON.parse(window.localStorage.getItem(FREE_USE_KEY) || '{}');
        return Number.parseInt(counts[tool] || '0', 10);
    }

    function consumeFreeUse(tool) {
        const counts = JSON.parse(window.localStorage.getItem(FREE_USE_KEY) || '{}');
        const count = getFreeUseCount(tool);
        if (count >= FREE_USE_LIMIT) {
            openToolModal('Upgrade your access', "You've reached your free audit limit. Contact our team for unlimited enterprise access.", '/contact.html');
            return false;
        }
        counts[tool] = count + 1;
        window.localStorage.setItem(FREE_USE_KEY, JSON.stringify(counts));
        return true;
    }

    function auditHtml(html, pageUrl, statusCode) {
        const documentNode = new DOMParser().parseFromString(html, 'text/html');
        const title = documentNode.querySelector('title')?.textContent.trim() || '';
        const description = documentNode.querySelector('meta[name="description"]')?.getAttribute('content')?.trim()
            || documentNode.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() || '';
        const h1s = [...documentNode.querySelectorAll('h1')];
        const bodyText = documentNode.body?.innerText.replace(/\s+/g, ' ').trim() || '';
        const wordCount = bodyText ? bodyText.split(' ').length : 0;
        const canonicalElement = documentNode.querySelector('link[rel="canonical"]');
        const canonical = canonicalElement?.getAttribute('href') || '';
        const robots = documentNode.querySelector('meta[name="robots"]')?.getAttribute('content')?.toLowerCase() || '';
        const structuredData = documentNode.querySelectorAll('script[type="application/ld+json"]').length;
        const images = [...documentNode.querySelectorAll('img')];
        const missingAlt = images.filter((image) => !image.getAttribute('alt')?.trim()).length;
        const baseUrl = new URL(pageUrl);
        const links = [...documentNode.querySelectorAll('a[href]')].map((link) => {
            try {
                return { url: new URL(link.href, pageUrl), rel: link.getAttribute('rel') || '' };
            } catch (_) {
                return null;
            }
        }).filter(Boolean);
        const internalLinks = links.filter((link) => link.url.hostname === baseUrl.hostname).length;
        const externalLinks = links.length - internalLinks;
        const issues = [];

        if (!title) issues.push(issue('title', 'error', 'Missing page title', 'No title element was found.', 'Add a unique title between 50 and 60 characters.'));
        else if (title.length < 30) issues.push(issue('title', 'warning', 'Title is too short', `The title is ${title.length} characters.`, 'Expand it toward 50-60 characters.'));
        else if (title.length > 60) issues.push(issue('title', 'warning', 'Title is too long', `The title is ${title.length} characters.`, 'Shorten it to under 60 characters.'));

        if (!description) issues.push(issue('meta', 'error', 'Missing meta description', 'No description meta tag was found.', 'Add a useful description between 70 and 160 characters.'));
        else if (description.length < 70) issues.push(issue('meta', 'warning', 'Meta description is short', `The description is ${description.length} characters.`, 'Expand it toward 150-160 characters.'));
        else if (description.length > 160) issues.push(issue('meta', 'warning', 'Meta description is long', `The description is ${description.length} characters.`, 'Shorten it to under 160 characters.'));

        if (h1s.length === 0) issues.push(issue('headings', 'error', 'Missing H1 heading', 'No H1 heading was found.', 'Add one descriptive H1 for the page topic.'));
        if (h1s.length > 1) issues.push(issue('headings', 'warning', 'Multiple H1 headings', `Found ${h1s.length} H1 headings.`, 'Keep one primary H1 and use H2/H3 for sections.'));
        if (wordCount < 300) issues.push(issue('content', 'warning', 'Low visible word count', `Found approximately ${wordCount} words.`, 'Add useful, relevant content where appropriate.'));
        if (robots.includes('noindex')) issues.push(issue('technical', 'warning', 'Page is set to noindex', `Robots meta value: ${robots}.`, 'Remove noindex if search visibility is intended.'));
        if (images.length && missingAlt) issues.push(issue('images', 'warning', 'Images missing alt text', `${missingAlt} of ${images.length} images have no alt text.`, 'Add descriptive alt text to content images.'));
        if (!structuredData) issues.push(issue('structured-data', 'info', 'No structured data found', 'No JSON-LD block was found.', 'Add relevant Schema.org data where it helps search engines.'));
        if (canonical) {
            try {
                if (new URL(canonical, pageUrl).href !== pageUrl) issues.push(issue('canonical', 'info', 'Canonical points elsewhere', `Canonical URL: ${new URL(canonical, pageUrl).href}`, 'Confirm the canonical target is intentional.'));
            } catch (_) {
                issues.push(issue('canonical', 'warning', 'Canonical URL is invalid', 'The canonical link could not be resolved.', 'Use an absolute, valid canonical URL.'));
            }
        }
        if (statusCode >= 400) issues.push(issue('technical', 'error', `HTTP ${statusCode} response`, 'The page returned an error status.', 'Check the URL and server response.'));
        if (baseUrl.protocol !== 'https:') issues.push(issue('security', 'warning', 'Page is not using HTTPS', 'The requested URL uses HTTP.', 'Redirect the site to HTTPS.'));

        const errors = issues.filter((item) => item.severity === 'error').length;
        const warnings = issues.filter((item) => item.severity === 'warning').length;
        const infos = issues.filter((item) => item.severity === 'info').length;
        return {
            url: pageUrl,
            statusCode,
            title,
            description,
            h1Count: h1s.length,
            wordCount,
            images: images.length,
            missingAlt,
            internalLinks,
            externalLinks,
            structuredData,
            errors,
            warnings,
            infos,
            score: Math.max(0, 100 - errors * 15 - warnings * 7 - infos * 2),
            issues
        };
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
    }

    function renderResults(results) {
        const resultNode = document.getElementById('seo-audit-results');
        if (!resultNode) return;
        const issueMarkup = results.issues.length
            ? results.issues.map((item) => `<li class="seo-issue seo-issue-${item.severity}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.description)}</span><small>${escapeHtml(item.recommendation)}</small></li>`).join('')
            : '<li class="seo-issue seo-issue-success"><strong>No issues found</strong><span>This page passed the checks included in this free audit.</span></li>';
        resultNode.innerHTML = `
            <div class="seo-score"><span>Audit score</span><strong>${results.score}<small>/100</small></strong><p>${escapeHtml(results.url)}</p></div>
            <div class="seo-metrics"><span><strong>${results.errors}</strong> errors</span><span><strong>${results.warnings}</strong> warnings</span><span><strong>${results.infos}</strong> info</span><span><strong>${results.wordCount}</strong> words</span><span><strong>${results.internalLinks}</strong> internal links</span></div>
            <h3>Audit findings</h3>
            <ul class="seo-issues">${issueMarkup}</ul>`;
        resultNode.hidden = false;
    }

    async function runClientAudit(url) {
        let html;
        let source = 'target page';
        try {
            const response = await fetch(url, { mode: 'cors' });
            if (!response.ok) throw new Error(`Target returned HTTP ${response.status}.`);
            html = await response.text();
        } catch (_) {
            html = document.documentElement.outerHTML;
            source = 'current page because the target blocks browser access';
        }
        const parsed = auditHtml(html, url, 200);
        return {
            status: { pages_crawled: 1 },
            findings: [{
                url,
                error_count: parsed.errors,
                warning_count: parsed.warnings,
                info_count: parsed.infos,
                issues: parsed.issues
            }],
            source
        };
    }

    function renderCrawlerResults(audit) {
        const resultNode = document.getElementById('seo-audit-results');
        if (!resultNode) return;
        const findings = Array.isArray(audit?.findings) ? audit.findings : [];
        const totalErrors = findings.reduce((sum, item) => sum + Number(item.error_count || 0), 0);
        const totalWarnings = findings.reduce((sum, item) => sum + Number(item.warning_count || 0), 0);
        const totalInfo = findings.reduce((sum, item) => sum + Number(item.info_count || 0), 0);
        const score = Math.max(0, 100 - totalErrors * 5 - totalWarnings * 2 - totalInfo);
        const pages = Number(audit?.status?.pages_crawled || findings.length || 1);
        const issueMarkup = findings.length
            ? findings.slice(0, 25).map((item) => `<li class="seo-issue ${item.error_count ? 'seo-issue-error' : item.warning_count ? 'seo-issue-warning' : 'seo-issue-info'}"><strong>${escapeHtml(item.url || 'Current page')}</strong><span>${item.error_count || 0} errors · ${item.warning_count || 0} warnings · ${item.info_count || 0} info</span></li>`).join('')
            : '<li class="seo-issue seo-issue-success"><strong>No findings returned</strong><span>The crawl completed without persisted page findings.</span></li>';
        resultNode.innerHTML = `<div class="seo-score"><span>SEO score</span><strong>${score}<small>/100</small></strong><p>${pages} page analyzed${audit?.source ? ` from ${escapeHtml(audit.source)}` : ''}</p></div><div class="seo-metrics"><span><strong>${totalErrors}</strong> errors</span><span><strong>${totalWarnings}</strong> warnings</span><span><strong>${totalInfo}</strong> info</span></div><h3>Audit findings</h3><ul class="seo-issues">${issueMarkup}</ul>`;
        resultNode.hidden = false;
    }

    function initializeAudit() {
        const form = document.getElementById('seo-audit-form');
        const status = document.getElementById('seo-audit-status');
        const submit = document.getElementById('seo-audit-submit');
        if (!form || !status || !submit) return;
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            let url;
            try {
                url = normalizeUrl(new FormData(form).get('url'));
            } catch (error) {
                status.className = 'tool-status tool-status-error';
                status.textContent = error.message;
                return;
            }
            submit.disabled = true;
            status.className = 'tool-status';
            status.textContent = 'Fetching the page and running the audit...';
            if (!consumeFreeUse('seo')) {
                submit.disabled = false;
                return;
            }
            try {
                renderCrawlerResults(await runClientAudit(url));
                status.className = 'tool-status tool-status-success';
                status.textContent = 'SEO audit complete. The report was generated in your browser.';
            } catch (error) {
                if (error.code === 'free_limit_reached') {
                    openToolModal('Upgrade your access', "You've reached your free audit limit. Contact our team for unlimited enterprise access.", error.upgradeUrl);
                    status.className = 'tool-status tool-status-error';
                    status.textContent = 'Your free audit limit has been reached.';
                    submit.disabled = false;
                    return;
                }
                status.className = 'tool-status tool-status-error';
                status.textContent = `${error.message} Please check the URL and try again.`;
            } finally {
                submit.disabled = false;
            }
        });
    }

    function openToolModal(title, copy, actionUrl) {
        const modal = document.getElementById('tool-modal');
        if (!modal) return;
        document.getElementById('tool-modal-title').textContent = title;
        document.getElementById('tool-modal-copy').textContent = copy;
        if (actionUrl) document.getElementById('tool-modal-action').href = actionUrl;
        modal.hidden = false;
    }

    function initializeHelpAndUpgrade() {
        document.querySelectorAll('.help-trigger').forEach((button) => {
            button.addEventListener('click', () => openToolModal(button.dataset.helpTitle, button.dataset.helpCopy, '../contact.html'));
        });
        document.getElementById('upgrade-trigger')?.addEventListener('click', () => openToolModal('Upgrade your access', "You've reached your free audit limit. Contact our team for unlimited enterprise access.", '../contact.html'));
        const modal = document.getElementById('tool-modal');
        document.getElementById('tool-modal-close')?.addEventListener('click', () => { modal.hidden = true; });
        modal?.addEventListener('click', (event) => { if (event.target === modal) modal.hidden = true; });
        document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modal) modal.hidden = true; });
    }

    function initializeUtilities() {
        const jsonInput = document.getElementById('json-input');
        const jsonOutput = document.getElementById('json-output');
        document.getElementById('json-format-button')?.addEventListener('click', () => {
            if (!consumeFreeUse('utilities')) return;
            try {
                jsonOutput.textContent = JSON.stringify(JSON.parse(jsonInput.value), null, 2);
                jsonOutput.className = 'utility-output utility-output-success';
            } catch (_) {
                jsonOutput.textContent = 'Invalid JSON. Check commas, quotes, and brackets.';
                jsonOutput.className = 'utility-output utility-output-error';
            }
        });

        const textInput = document.getElementById('text-input');
        const textOutput = document.getElementById('text-output');
        let textCountStarted = false;
        textInput?.addEventListener('input', () => {
            if (!textCountStarted && !consumeFreeUse('utilities')) return;
            textCountStarted = true;
            const value = textInput.value.trim();
            textOutput.textContent = `${value ? value.split(/\s+/).length : 0} words · ${textInput.value.length} characters`;
        });

        const urlInput = document.getElementById('url-input');
        const urlOutput = document.getElementById('url-output');
        document.getElementById('url-encode-button')?.addEventListener('click', () => {
            if (!consumeFreeUse('utilities')) return;
            urlOutput.textContent = encodeURIComponent(urlInput.value);
            urlOutput.className = 'utility-output utility-output-success';
        });
    }

    function initializeSuiteTools() {
        let latestEmail = null;
        let leadSessionStarted = false;
        let latestLeads = [];
        try {
            latestLeads = JSON.parse(window.localStorage.getItem(LEAD_STORAGE_KEY) || '[]');
            if (!Array.isArray(latestLeads)) latestLeads = [];
        } catch (_) {
            latestLeads = [];
        }

        function downloadFile(filename, content, type) {
            const link = document.createElement('a');
            const objectUrl = URL.createObjectURL(new Blob([content], { type }));
            link.href = objectUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        }

        async function copyText(text) {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return;
            }
            const input = document.createElement('textarea');
            input.value = text;
            document.body.appendChild(input);
            input.select();
            const copied = document.execCommand('copy');
            input.remove();
            if (!copied) throw new Error('Clipboard access was denied.');
        }

        function renderLeadCount() {
            document.getElementById('lead-output').textContent = `${latestLeads.length} of 5 free leads captured`;
        }

        function renderLeadTable() {
            const table = document.getElementById('lead-table-wrap');
            table.innerHTML = `<table class="lead-table"><thead><tr><th>Company Name</th><th>Website URL</th><th>Contact Email</th><th>Fit Score</th></tr></thead><tbody>${latestLeads.map((lead) => `<tr><td>${escapeHtml(lead.company)}</td><td>${escapeHtml(lead.website || 'Not provided')}</td><td>${escapeHtml(lead.email)}${lead.email_verified === false ? '<small class="unverified-label">unverified</small>' : ''}</td><td>${lead.fit_score}/100</td></tr>`).join('')}</tbody></table>`;
            table.hidden = false;
        }

        function localLeadGenerator(query, location) {
            const base = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'mena-business';
            const descriptors = ['Solutions', 'Trading', 'Projects', 'Services', 'Systems'];
            return descriptors.map((descriptor, index) => {
                const domain = `${base}-${descriptor.toLowerCase()}.com`;
                return {
                    company: `${query} ${descriptor}`,
                    website: `https://${domain}`,
                    email: `info@${domain}`,
                    fit_score: Math.max(72, 94 - index * 4),
                    source: 'structured candidate generator',
                    email_verified: false,
                    location
                };
            });
        }

        async function fetchLeads(query, location) {
            if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
                return { source: 'structured candidate generator', leads: localLeadGenerator(query, location), notice: 'Candidate emails are unverified until confirmed.' };
            }
            try {
                const response = await fetch(`/api/leads?keyword=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}`, { headers: { Accept: 'application/json' } });
                if (!response.ok) throw new Error(`Lead service returned HTTP ${response.status}.`);
                const data = await response.json();
                if (Array.isArray(data.leads) && data.leads.length >= 5) return data;
            } catch (_) {
                // The local generator below keeps the static page usable when Vercel functions are unavailable.
            }
            return { source: 'structured candidate generator', leads: localLeadGenerator(query, location), notice: 'Candidate emails are unverified until confirmed.' };
        }

        document.getElementById('lead-capture-form')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (latestLeads.length >= 5) {
                openToolModal('Free lead limit reached', 'You can capture up to 5 leads in the free tier. Contact our team for unlimited enterprise access.', '/contact.html');
                return;
            }
            const query = document.getElementById('lead-query').value.trim();
            const location = document.getElementById('lead-location').value.trim();
            if (!leadSessionStarted) {
                if (!consumeFreeUse('leads')) return;
                leadSessionStarted = true;
            }
            const output = document.getElementById('lead-output');
            output.textContent = 'Finding candidate businesses...';
            output.className = 'utility-output';
            const generated = await fetchLeads(query, location);
            latestLeads = generated.leads.slice(0, 5).map((lead) => ({ ...lead, captured_at: new Date().toISOString() }));
            window.localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify(latestLeads));
            output.textContent = `${latestLeads.length} candidate leads generated for “${query}” in ${location}. ${generated.notice || 'Live results returned by Apify.'}`;
            output.className = generated.source === 'apify' ? 'utility-output utility-output-success' : 'utility-output utility-output-error';
            renderLeadTable();
            document.getElementById('lead-actions').hidden = false;
            event.target.reset();
        });

        document.getElementById('outreach-form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!consumeFreeUse('outreach')) return;
            const name = document.getElementById('outreach-name').value.trim();
            const sender = document.getElementById('outreach-sender').value.trim();
            const company = document.getElementById('outreach-company').value.trim();
            const opportunity = document.getElementById('outreach-issue').value.trim();
            const subject = `A quick idea for ${company}`;
            const body = `Hi ${name},\n\nI noticed an opportunity around ${opportunity} at ${company}. This is often a practical way to improve visibility and create more qualified enquiries.\n\n${sender} helps MENA businesses turn technical gaps into focused growth plans, with clear priorities and measurable next steps.\n\nWould you be open to a 15-minute conversation next week so we can share two ideas specific to ${company}?\n\nRegards,\n${sender}`;
            latestEmail = { subject, body, sender, company };
            document.getElementById('outreach-output').textContent = `Subject: ${subject}\n\n${body}`;
            document.getElementById('outreach-output').className = 'utility-output utility-output-success';
            document.getElementById('outreach-actions').hidden = false;
            document.getElementById('outreach-send').href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        });

        document.getElementById('lead-json-download')?.addEventListener('click', () => {
            if (latestLeads.length) downloadFile('souq-mena-leads.json', JSON.stringify(latestLeads, null, 2), 'application/json');
        });
        document.getElementById('lead-csv-download')?.addEventListener('click', () => {
            if (!latestLeads.length) return;
            const header = 'company,website,email,fit_score,email_verified,source,captured_at\n';
            const rows = latestLeads.map((lead) => [lead.company, lead.website, lead.email, lead.fit_score, lead.email_verified, lead.source, lead.captured_at].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
            downloadFile('souq-mena-leads.csv', `${header}${rows}\n`, 'text/csv');
        });
        document.getElementById('outreach-copy')?.addEventListener('click', async () => {
            if (!latestEmail) return;
            try {
                await copyText(`Subject: ${latestEmail.subject}\n\n${latestEmail.body}`);
                document.getElementById('outreach-copy').textContent = 'Copied';
            } catch (error) {
                document.getElementById('outreach-output').textContent += `\n\n${error.message}`;
            }
        });
        renderLeadCount();
        if (latestLeads.length) {
            renderLeadTable();
            document.getElementById('lead-actions').hidden = false;
        }
    }

    if (typeof window !== 'undefined') {
        window.SouqFreeTools = { normalizeUrl, auditHtml };
        document.addEventListener('DOMContentLoaded', () => {
            initializeAudit();
            initializeUtilities();
            initializeSuiteTools();
            initializeHelpAndUpgrade();
        });
    }
}());
