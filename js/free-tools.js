(function () {
    'use strict';

    const MAX_AUDIT_BYTES = 3 * 1024 * 1024;
    const REQUEST_TIMEOUT_MS = 15000;

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

    async function fetchAuditPage(url) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(url, { mode: 'cors', signal: controller.signal, redirect: 'follow' });
            if (!response.ok) throw new Error(`The website returned HTTP ${response.status}.`);
            const contentLength = Number(response.headers.get('content-length') || 0);
            if (contentLength > MAX_AUDIT_BYTES) throw new Error('The page is larger than the free audit limit.');
            const html = await response.text();
            if (new Blob([html]).size > MAX_AUDIT_BYTES) throw new Error('The page is larger than the free audit limit.');
            return auditHtml(html, url, response.status);
        } finally {
            clearTimeout(timeout);
        }
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
            try {
                renderResults(await fetchAuditPage(url));
                status.className = 'tool-status tool-status-success';
                status.textContent = 'Audit complete. Results are calculated in your browser.';
            } catch (error) {
                status.className = 'tool-status tool-status-error';
                status.textContent = error.name === 'AbortError'
                    ? 'The request timed out. Try a smaller or faster page.'
                    : `${error.message} If the site blocks CORS, paste its HTML into a local audit or use a same-origin endpoint.`;
            } finally {
                submit.disabled = false;
            }
        });
    }

    function initializeUtilities() {
        const jsonInput = document.getElementById('json-input');
        const jsonOutput = document.getElementById('json-output');
        document.getElementById('json-format-button')?.addEventListener('click', () => {
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
        textInput?.addEventListener('input', () => {
            const value = textInput.value.trim();
            textOutput.textContent = `${value ? value.split(/\s+/).length : 0} words · ${textInput.value.length} characters`;
        });

        const urlInput = document.getElementById('url-input');
        const urlOutput = document.getElementById('url-output');
        document.getElementById('url-encode-button')?.addEventListener('click', () => {
            urlOutput.textContent = encodeURIComponent(urlInput.value);
            urlOutput.className = 'utility-output utility-output-success';
        });
    }

    if (typeof window !== 'undefined') {
        window.SouqFreeTools = { normalizeUrl, auditHtml };
        document.addEventListener('DOMContentLoaded', () => {
            initializeAudit();
            initializeUtilities();
        });
    }
}());
