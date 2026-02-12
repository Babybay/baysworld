/**
 * SEO Routes — server-side rendered pages for crawlers & social sharing.
 * Also serves sitemap.xml and rss.xml.
 */
const { Router } = require('express');
const Store = require('../services/store');
const r = Router();

const BASE_URL = process.env.BASE_URL || 'https://thebaysworld.xyz';

// ── SSR Project Page ──
r.get('/p/:slug', async (req, res) => {
    try {
        const project = await Store.getProjectBySlug(req.params.slug);
        if (!project) return res.status(404).send(renderNotFound('Project'));

        const description = (project.description || project.name).slice(0, 160);
        const canonicalUrl = `${BASE_URL}/p/${project.slug}`;

        const jsonLd = `<script type="application/ld+json">${JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareSourceCode",
            "name": project.name,
            "description": description,
            "dateCreated": project.createdAt,
            "dateModified": project.updatedAt,
            "programmingLanguage": project.techStack,
            "codeRepository": project.githubUrl || undefined,
            "url": canonicalUrl,
        })}</script>`;

        res.render('layout', {
            title: project.name,
            description,
            canonicalUrl,
            ogType: 'article',
            jsonLd,
            body: '', // will be filled by project.ejs include
            project,
        }, (err, _) => {
            // Render project partial into body, then render layout
            res.render('project', { project }, (err2, projectHtml) => {
                if (err2) throw err2;
                res.render('layout', {
                    title: project.name,
                    description,
                    canonicalUrl,
                    ogType: 'article',
                    jsonLd,
                    body: projectHtml,
                });
            });
        });
    } catch (err) {
        console.error('SSR project error:', err);
        res.status(500).send('Server error');
    }
});

// ── SSR Note Page ──
r.get('/n/:slug', async (req, res) => {
    try {
        const note = await Store.getNoteBySlug(req.params.slug);
        if (!note) return res.status(404).send(renderNotFound('Note'));

        const description = (note.content || note.title).replace(/[#*`\n]/g, ' ').slice(0, 160).trim();
        const canonicalUrl = `${BASE_URL}/n/${note.slug}`;

        const jsonLd = `<script type="application/ld+json">${JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": note.title,
            "description": description,
            "datePublished": note.createdAt,
            "dateModified": note.updatedAt,
            "articleSection": note.category,
            "url": canonicalUrl,
        })}</script>`;

        res.render('note', { note }, (err, noteHtml) => {
            if (err) throw err;
            res.render('layout', {
                title: note.title,
                description,
                canonicalUrl,
                ogType: 'article',
                jsonLd,
                body: noteHtml,
            });
        });
    } catch (err) {
        console.error('SSR note error:', err);
        res.status(500).send('Server error');
    }
});

// ── Sitemap.xml ──
r.get('/sitemap.xml', async (req, res) => {
    try {
        const [projects, notes] = await Promise.all([
            Store.getAllProjects(),
            Store.getAllNotes(),
        ]);

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

        // Homepage
        xml += `  <url>\n    <loc>${BASE_URL}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

        // Projects
        for (const p of projects) {
            if (!p.slug) continue;
            xml += `  <url>\n    <loc>${BASE_URL}/p/${p.slug}</loc>\n`;
            xml += `    <lastmod>${new Date(p.updatedAt).toISOString().split('T')[0]}</lastmod>\n`;
            xml += `    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
        }

        // Notes
        for (const n of notes) {
            if (!n.slug) continue;
            xml += `  <url>\n    <loc>${BASE_URL}/n/${n.slug}</loc>\n`;
            xml += `    <lastmod>${new Date(n.updatedAt).toISOString().split('T')[0]}</lastmod>\n`;
            xml += `    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
        }

        xml += '</urlset>';
        res.set('Content-Type', 'application/xml');
        res.send(xml);
    } catch (err) {
        console.error('Sitemap error:', err);
        res.status(500).send('Error generating sitemap');
    }
});

// ── RSS Feed ──
r.get('/rss.xml', async (req, res) => {
    try {
        const [projects, notes] = await Promise.all([
            Store.getAllProjects(),
            Store.getAllNotes(),
        ]);

        // Combine and sort by updatedAt
        const items = [
            ...projects.map(p => ({
                title: `[Project] ${p.name}`,
                link: `${BASE_URL}/p/${p.slug}`,
                description: p.description || p.name,
                pubDate: new Date(p.updatedAt).toUTCString(),
                category: 'Projects',
            })),
            ...notes.map(n => ({
                title: `[Note] ${n.title}`,
                link: `${BASE_URL}/n/${n.slug}`,
                description: (n.content || n.title).replace(/[#*`\n]/g, ' ').slice(0, 300),
                pubDate: new Date(n.updatedAt).toUTCString(),
                category: n.category || 'General',
            })),
        ].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)).slice(0, 30);

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n';
        xml += `  <title>BaysWorld — Developer Hub</title>\n`;
        xml += `  <link>${BASE_URL}</link>\n`;
        xml += `  <description>Babybay's project portfolio and knowledge base</description>\n`;
        xml += `  <language>en</language>\n`;
        xml += `  <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml"/>\n`;

        for (const item of items) {
            xml += '  <item>\n';
            xml += `    <title><![CDATA[${item.title}]]></title>\n`;
            xml += `    <link>${item.link}</link>\n`;
            xml += `    <description><![CDATA[${item.description}]]></description>\n`;
            xml += `    <pubDate>${item.pubDate}</pubDate>\n`;
            xml += `    <category>${item.category}</category>\n`;
            xml += `    <guid>${item.link}</guid>\n`;
            xml += '  </item>\n';
        }

        xml += '</channel>\n</rss>';
        res.set('Content-Type', 'application/rss+xml');
        res.send(xml);
    } catch (err) {
        console.error('RSS error:', err);
        res.status(500).send('Error generating RSS');
    }
});

function renderNotFound(type) {
    return `<!DOCTYPE html><html><head><title>Not Found — BaysWorld</title>
    <meta name="robots" content="noindex"><link rel="stylesheet" href="/styles.css"></head>
    <body style="background:#008080;display:flex;justify-content:center;padding-top:50px;">
    <div class="win-window" style="width:400px;"><div class="win-title-bar"><span>❌ Not Found</span></div>
    <div class="win-body" style="padding:20px;text-align:center;">
    <p style="font-size:14px;">${type} not found.</p>
    <a href="/" class="win-btn" style="margin-top:10px;">Back to BaysWorld</a>
    </div></div></body></html>`;
}

module.exports = r;
