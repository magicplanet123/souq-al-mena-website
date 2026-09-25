(function () {
    'use strict';

    const API_BASE_URL = (window.SOUQ_API_BASE || '').replace(/\/$/, '');
    const FREE_USE_LIMIT = 3;
    const FREE_USE_KEY = 'souq-mena-free-tools-uses';

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

    function getFreeUseCount() {
        return Number.parseInt(window.localStorage.getItem(FREE_USE_KEY) || '0', 10);
    }

    function consumeFreeUse() {
        const count = getFreeUseCount();
        if (count >= FREE_USE_LIMIT) {
            openToolModal('Upgrade your access', "You've reached your free audit limit. Contact our team for unlimited enterprise access.", '/contact.html');
            return false;
        }
        window.localStorage.setItem(FREE_USE_KEY, String(count + 1));
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

    async function requestApi(path, options) {
        const response = await fetch(`${API_BASE_URL}${path}`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
            ...options
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(data.error || `The audit service returned HTTP ${response.status}.`);
            error.code = data.code;
            error.upgradeUrl = data.upgrade_url;
            throw error;
        }
        return data;
    }

    function wait(milliseconds) {
        return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }

    async function runBackendAudit(url) {
        const started = await requestApi('/api/seo/crawl/', {
            method: 'POST',
            body: JSON.stringify({
                name: `Free SEO audit: ${url}`,
                start_url: url,
                max_pages: 100,
                concurrency: 4,
                timeout: 30,
                respect_robots_txt: true,
                follow_redirects: true
            })
        });
        for (let attempt = 0; attempt < 80; attempt += 1) {
            await wait(attempt === 0 ? 500 : 1500);
            const status = await requestApi(`/api/seo/crawl/${started.job_id}/`);
            if (status.status === 'failed') throw new Error(status.error_message || 'The full-site audit failed.');
            if (status.status === 'completed') {
                const findings = await requestApi(`/api/seo/crawl/${started.job_id}/results/?limit=100`);
                return { status, findings: findings.results || [] };
            }
        }
        throw new Error('The audit is taking longer than expected. Check the job status and try again later.');
    }

    function renderCrawlerResults(audit) {
        const resultNode = document.getElementById('seo-audit-results');
        if (!resultNode) return;
        const totalErrors = audit.findings.reduce((sum, item) => sum + item.error_count, 0);
        const totalWarnings = audit.findings.reduce((sum, item) => sum + item.warning_count, 0);
        const totalInfo = audit.findings.reduce((sum, item) => sum + item.info_count, 0);
        const score = Math.max(0, 100 - totalErrors * 5 - totalWarnings * 2 - totalInfo);
        const pages = audit.status.pages_crawled;
        const issueMarkup = audit.findings.length
            ? audit.findings.slice(0, 25).map((item) => `<li class="seo-issue ${item.error_count ? 'seo-issue-error' : item.warning_count ? 'seo-issue-warning' : 'seo-issue-info'}"><strong>${escapeHtml(item.url)}</strong><span>${item.error_count} errors · ${item.warning_count} warnings · ${item.info_count} info</span></li>`).join('')
            : '<li class="seo-issue seo-issue-success"><strong>No findings returned</strong><span>The crawl completed without persisted page findings.</span></li>';
        resultNode.innerHTML = `<div class="seo-score"><span>Full-site score</span><strong>${score}<small>/100</small></strong><p>${pages} pages crawled</p></div><div class="seo-metrics"><span><strong>${totalErrors}</strong> errors</span><span><strong>${totalWarnings}</strong> warnings</span><span><strong>${totalInfo}</strong> info</span><span><strong>${pages}</strong> pages</span></div><h3>Top page findings</h3><ul class="seo-issues">${issueMarkup}</ul>`;
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
            if (!consumeFreeUse()) {
                submit.disabled = false;
                return;
            }
            try {
                renderCrawlerResults(await runBackendAudit(url));
                status.className = 'tool-status tool-status-success';
                status.textContent = 'Full-site audit complete. Results were generated by the backend crawler.';
            } catch (error) {
                if (error.code === 'free_limit_reached') {
                    openToolModal('Upgrade your access', "You've reached your free audit limit. Contact our team for unlimited enterprise access.", error.upgradeUrl);
                    status.className = 'tool-status tool-status-error';
                    status.textContent = 'Your free audit limit has been reached.';
                    submit.disabled = false;
                    return;
                }
                status.className = 'tool-status tool-status-error';
                status.textContent = error.name === 'AbortError'
                    ? 'The crawler request timed out. Please try again.'
                    : `${error.message} The full-site audit requires the crawler API to be online.`;
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
            if (!consumeFreeUse()) return;
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
            if (!textCountStarted && !consumeFreeUse()) return;
            textCountStarted = true;
            const value = textInput.value.trim();
            textOutput.textContent = `${value ? value.split(/\s+/).length : 0} words · ${textInput.value.length} characters`;
        });

        const urlInput = document.getElementById('url-input');
        const urlOutput = document.getElementById('url-output');
        document.getElementById('url-encode-button')?.addEventListener('click', () => {
            if (!consumeFreeUse()) return;
            urlOutput.textContent = encodeURIComponent(urlInput.value);
            urlOutput.className = 'utility-output utility-output-success';
        });
    }

    function initializeSuiteTools() {
        let latestLead = null;
        let latestEmail = null;

        function downloadFile(filename, content, type) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(new Blob([content], { type }));
            link.download = filename;
            link.click();
            URL.revokeObjectURL(link.href);
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

        async function fetchLeadMetadata(website) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            try {
                const response = await fetch(website, { mode: 'cors', signal: controller.signal });
                if (!response.ok) throw new Error(`Website returned HTTP ${response.status}.`);
                const html = await response.text();
                const parsed = new DOMParser().parseFromString(html, 'text/html');
                return {
                    title: parsed.querySelector('title')?.textContent.trim() || '',
                    description: parsed.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '',
                    h1: parsed.querySelector('h1')?.textContent.trim() || ''
                };
            } finally {
                clearTimeout(timeout);
            }
        }

        document.getElementById('lead-capture-form')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const company = document.getElementById('lead-company').value.trim();
            let website;
            try {
                website = normalizeUrl(document.getElementById('lead-website').value);
            } catch (error) {
                document.getElementById('lead-output').textContent = error.message;
                document.getElementById('lead-output').className = 'utility-output utility-output-error';
                return;
            }
            if (!consumeFreeUse()) return;
            const email = document.getElementById('lead-email').value.trim();
            const output = document.getElementById('lead-output');
            output.textContent = 'Reading public website metadata...';
            output.className = 'utility-output';
            let metadata = {};
            let metadataNotice = '';
            try {
                metadata = await fetchLeadMetadata(website);
            } catch (error) {
                metadataNotice = ` Public metadata could not be read: ${error.message}`;
            }
            latestLead = {
                company,
                website,
                email,
                metadata,
                captured_at: new Date().toISOString(),
                metadata_notice: metadataNotice || null
            };
            output.textContent = `${company} · ${email} · ${website}${metadata.title ? ` · ${metadata.title}` : ''}.${metadataNotice}`;
            output.className = metadataNotice ? 'utility-output utility-output-error' : 'utility-output utility-output-success';
            document.getElementById('lead-actions').hidden = false;
        });

        document.getElementById('outreach-form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!consumeFreeUse()) return;
            const name = document.getElementById('outreach-name').value.trim();
            const company = document.getElementById('outreach-company').value.trim();
            const opportunity = document.getElementById('outreach-issue').value.trim();
            const subject = `A quick idea for ${company}`;
            const body = `Hi ${name},\n\nI noticed an opportunity around ${opportunity}. Souq Al Mena can help turn this into a practical growth plan. Would a short conversation be useful?\n\nRegards,\nSouq Al Mena`;
            latestEmail = { subject, body };
            document.getElementById('outreach-output').textContent = `Subject: ${subject}\n\n${body}`;
            document.getElementById('outreach-output').className = 'utility-output utility-output-success';
            document.getElementById('outreach-actions').hidden = false;
            document.getElementById('outreach-send').href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        });

        document.getElementById('lead-json-download')?.addEventListener('click', () => {
            if (latestLead) downloadFile('souq-mena-lead.json', JSON.stringify(latestLead, null, 2), 'application/json');
        });
        document.getElementById('lead-csv-download')?.addEventListener('click', () => {
            if (!latestLead) return;
            const row = [latestLead.company, latestLead.website, latestLead.email, latestLead.metadata.title || '', latestLead.metadata.description || '', latestLead.captured_at];
            downloadFile('souq-mena-lead.csv', `company,website,email,title,description,captured_at\n${row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')}\n`, 'text/csv');
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
