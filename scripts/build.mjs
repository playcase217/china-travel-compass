import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const contentDir = join(root, "content/guides");
const publicDir = join(root, "public");
const outDir = join(root, "dist");
const site = "https://travel.juzhiic.com";
const siteName = "China Travel Compass";
const defaultImage = "/images/guides/first-trip-to-china/beijing-hero.webp";

const escapeHtml = (value = "") =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const escapeXml = (value = "") =>
  escapeHtml(value).replaceAll("'", "&apos;");
const absolute = (path = "/") => new URL(path, site).href;
const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replaceAll("<", "\\u003c")}</script>`;
const tagSlug = (tag = "") => tag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const tagsFor = (meta) => (meta.tags ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
const tagLinks = (tags) => `<div class="tag-list">${tags.map((tag) => `<a class="tag" href="/tags/${tagSlug(tag)}/">${escapeHtml(tag)}</a>`).join("")}</div>`;

function parseGuide(source) {
  const [, frontmatter, body] = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
  if (!frontmatter) throw new Error("Guide is missing frontmatter");
  const meta = Object.fromEntries(frontmatter.split("\n").map((line) => {
    const index = line.indexOf(":");
    return [line.slice(0, index), line.slice(index + 1).trim()];
  }));
  return { meta, body };
}

function inline(text) {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function markdown(body) {
  const lines = body.trim().split("\n");
  let html = "";
  let listOpen = false;
  const closeList = () => {
    if (listOpen) html += "</ul>";
    listOpen = false;
  };
  for (const line of lines) {
    if (!line.trim()) {
      closeList();
      continue;
    }
    if (line.startsWith("### ")) {
      closeList();
      html += `<h3>${inline(line.slice(4))}</h3>`;
    } else if (line.startsWith("## ")) {
      closeList();
      html += `<h2>${inline(line.slice(3))}</h2>`;
    } else if (line.startsWith("- ")) {
      if (!listOpen) html += "<ul>";
      listOpen = true;
      html += `<li>${inline(line.slice(2))}</li>`;
    } else if (line.startsWith("![")) {
      closeList();
      html += `<figure>${inline(line)}</figure>`;
    } else {
      closeList();
      html += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  return html;
}

const layout = ({ title, description, content, path = "/", image = defaultImage, type = "website", current = "", structuredData = [], robots = "index,follow" }) => {
const url = absolute(path);
return `<!doctype html>
<html lang="en">
<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-6JQKWPSRVY"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-6JQKWPSRVY');
  </script>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | ${siteName}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${url}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="alternate" href="/rss.xml" type="application/rss+xml" title="${siteName}">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:type" content="${type}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${absolute(image)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${absolute(image)}">
  <link rel="stylesheet" href="/styles.css">
  ${structuredData.map(jsonLd).join("\n  ")}
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/"><span class="brand-mark">中</span><span>China Travel Compass</span></a>
    <nav><a class="${current === "home" ? "active" : ""}" href="/">Home</a><a class="${current === "guides" ? "active" : ""}" href="/guides/">Guides</a><a class="${current === "tags" ? "active" : ""}" href="/tags/">Tags</a><a href="/about/">About</a></nav>
  </header>
  ${content}
  <footer><strong>${siteName}</strong><span>Clear, practical guidance for exploring China independently.</span><small><a href="/editorial-policy/">Editorial policy</a> · <a href="/rss.xml">RSS</a> · Travel rules can change. Confirm critical details with official sources before departure.</small></footer>
</body>
</html>`;
};

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await cp(publicDir, outDir, { recursive: true, filter: (source) => extname(source) !== ".png" });

const guideFiles = (await readdir(contentDir)).filter((name) => name.endsWith(".md"));
const guides = [];
for (const file of guideFiles) {
  const { meta, body } = parseGuide(await readFile(join(contentDir, file), "utf8"));
  meta.tagList = tagsFor(meta);
  guides.push(meta);
  const path = `/guides/${meta.slug}/`;
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absolute("/") },
      { "@type": "ListItem", position: 2, name: "Guides", item: absolute("/guides/") },
      { "@type": "ListItem", position: 3, name: meta.title, item: absolute(path) }
    ]
  };
  const articleData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: meta.title,
    description: meta.description,
    image: [absolute(meta.hero)],
    datePublished: meta.published,
    dateModified: meta.updated,
    keywords: meta.tagList,
    mainEntityOfPage: absolute(path),
    author: { "@type": "Organization", name: meta.author, url: absolute("/about/") },
    publisher: { "@type": "Organization", name: siteName, url: absolute("/"), logo: { "@type": "ImageObject", url: absolute("/favicon.svg") } }
  };
  const article = `<main>
    <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/guides/">Guides</a> / <span>${meta.title}</span></nav>
    <section class="article-hero">
      <img src="${meta.hero}" alt="${escapeHtml(meta.heroAlt)}">
      <div class="article-hero-copy"><span class="eyebrow">${meta.category}</span><h1>${meta.title}</h1><p>${meta.description}</p><span class="meta">By ${meta.author} · Updated <time datetime="${meta.updated}">${meta.updated}</time> · ${meta.readTime}</span>${tagLinks(meta.tagList)}</div>
    </section>
    <article class="article">
      <aside class="article-note">Reviewed for practical planning. Time-sensitive details are linked to official sources and should be confirmed before departure.</aside>
      ${markdown(body)}
    </article>
  </main>`;
  const dir = join(outDir, "guides", meta.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.html"), layout({ title: meta.title, description: meta.description, content: article, path, image: meta.hero, type: "article", structuredData: [articleData, breadcrumbData] }));
}

guides.sort((a, b) => b.updated.localeCompare(a.updated));
const guide = guides[0];
const guideCardsFor = (items) => items.map((item) => `<article class="guide-card"><a class="guide-card-main" href="/guides/${item.slug}/"><img src="${item.hero}" alt="${escapeHtml(item.heroAlt)}"><span class="eyebrow">${item.category}</span><h3>${item.title}</h3><p>${item.description}</p><strong>Read guide →</strong></a>${tagLinks(item.tagList)}</article>`).join("");
const guideCards = guideCardsFor(guides);
const home = `<main>
  <section class="home-hero">
    <div><span class="eyebrow">Travel China with confidence</span><h1>See more of China.<br><em>Stress less</em> about the details.</h1><p>Practical, carefully researched travel guides for international visitors. Start with the essentials, then build a trip that fits your pace.</p><a class="button" href="/guides/${guide.slug}/">Plan your first trip <span>→</span></a></div>
    <img src="${guide.hero}" alt="${escapeHtml(guide.heroAlt)}">
  </section>
  <section class="quick-grid">
    <div><span>01</span><h2>Prepare</h2><p>Entry rules, mobile data, payments, and booking basics.</p></div>
    <div><span>02</span><h2>Explore</h2><p>Focused city guides and realistic routes for independent travel.</p></div>
    <div><span>03</span><h2>Travel well</h2><p>Clear advice, official links, and useful context before you go.</p></div>
  </section>
  <section class="featured"><div><span class="eyebrow">Start here</span><h2>Your first China trip, made simpler</h2><p>${guide.description}</p><a href="/guides/${guide.slug}/">Read the guide →</a></div><img src="${guide.hero}" alt="${escapeHtml(guide.heroAlt)}"></section>
  <section class="guide-section"><span class="eyebrow">Latest guides</span><h2>Plan with the details in view</h2><div class="guide-grid">${guideCards}</div></section>
</main>`;
await writeFile(join(outDir, "index.html"), layout({
  title: "Practical China travel guides",
  description: "Clear, practical China travel guides for international visitors.",
  content: home,
  current: "home",
  structuredData: [{
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: siteName, url: absolute("/") },
      { "@type": "Organization", name: siteName, url: absolute("/"), description: "Practical China travel guidance for international visitors." }
    ]
  }]
}));

await mkdir(join(outDir, "guides"), { recursive: true });
await writeFile(join(outDir, "guides/index.html"), layout({
  title: "Travel guides",
  description: "Practical China travel guides for international visitors.",
  current: "guides",
  path: "/guides/",
  content: `<main class="guide-section guide-index"><span class="eyebrow">China travel guides</span><h1>Plan clearly. Travel confidently.</h1><p>Start with the essentials, then choose the places and experiences that suit your pace.</p><div class="guide-grid">${guideCards}</div></main>`
}));

const tags = new Map();
for (const item of guides) {
  for (const tag of item.tagList) {
    if (!tags.has(tag)) tags.set(tag, []);
    tags.get(tag).push(item);
  }
}
const sortedTags = [...tags.entries()].sort(([a], [b]) => a.localeCompare(b));
await mkdir(join(outDir, "tags"), { recursive: true });
await writeFile(join(outDir, "tags/index.html"), layout({
  title: "Browse travel guide tags",
  description: "Browse China travel guides by destination, activity, and practical planning topic.",
  current: "tags",
  path: "/tags/",
  content: `<main class="tag-index"><span class="eyebrow">Browse by topic</span><h1>Find the right guide faster.</h1><p>Use tags to explore destinations, practical essentials, and trip ideas.</p><div class="tag-cloud">${sortedTags.map(([tag, items]) => `<a class="tag-summary" href="/tags/${tagSlug(tag)}/"><strong>${escapeHtml(tag)}</strong><span>${items.length} ${items.length === 1 ? "guide" : "guides"}</span></a>`).join("")}</div></main>`
}));
for (const [tag, items] of sortedTags) {
  const path = `/tags/${tagSlug(tag)}/`;
  const dir = join(outDir, "tags", tagSlug(tag));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.html"), layout({
    title: `${tag} travel guides`,
    description: `Browse ${items.length} practical China travel ${items.length === 1 ? "guide" : "guides"} tagged ${tag}.`,
    current: "tags",
    path,
    robots: items.length > 1 ? "index,follow" : "noindex,follow",
    content: `<main class="guide-section guide-index"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/tags/">Tags</a> / <span>${escapeHtml(tag)}</span></nav><span class="eyebrow">Tagged guides</span><h1>${escapeHtml(tag)}</h1><p>${items.length} practical ${items.length === 1 ? "guide" : "guides"} for your China trip.</p><div class="guide-grid">${guideCardsFor(items)}</div></main>`
  }));
}

await mkdir(join(outDir, "about"), { recursive: true });
await writeFile(join(outDir, "about/index.html"), layout({
  title: "About",
  description: "About China Travel Compass.",
  path: "/about/",
  content: `<main class="simple-page"><span class="eyebrow">About</span><h1>Travel guidance with the details in view.</h1><p>China Travel Compass helps international visitors plan independent trips with practical, easy-to-follow guidance.</p><p>We prioritize clear explanations and links to official sources for details that can change. Always confirm entry policies and booking requirements before departure.</p><p>Read our <a href="/editorial-policy/">editorial policy</a> for the standards behind each guide.</p></main>`
}));

await mkdir(join(outDir, "editorial-policy"), { recursive: true });
await writeFile(join(outDir, "editorial-policy/index.html"), layout({
  title: "Editorial policy",
  description: "How China Travel Compass researches, reviews, and updates practical China travel guides.",
  path: "/editorial-policy/",
  content: `<main class="simple-page"><span class="eyebrow">Editorial policy</span><h1>Useful advice, clearly sourced.</h1><p>China Travel Compass publishes practical guidance for international visitors planning independent trips to China.</p><h2>How we work</h2><p>We separate durable travel advice from time-sensitive details. When entry policies, transport rules, payment instructions, or booking requirements may change, we point readers to official sources and recommend confirming the details before departure.</p><h2>Updates</h2><p>Guides display an update date. We revise articles when material facts change and prioritize pages that affect essential trip planning.</p><h2>Images and clarity</h2><p>We use original editorial visuals and descriptive alternative text. Articles begin with a concise answer, then add the context needed to make a practical decision.</p></main>`
}));

const sitemapPages = [
  { path: "/", updated: guide.updated },
  { path: "/guides/", updated: guide.updated },
  { path: "/tags/", updated: guide.updated },
  { path: "/about/", updated: guide.updated },
  { path: "/editorial-policy/", updated: guide.updated },
  ...sortedTags.filter(([, items]) => items.length > 1).map(([tag, items]) => ({ path: `/tags/${tagSlug(tag)}/`, updated: items[0].updated })),
  ...guides.map((item) => ({ path: `/guides/${item.slug}/`, updated: item.updated, image: item.hero, imageAlt: item.heroAlt }))
];
await writeFile(join(outDir, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${sitemapPages.map((page) => `  <url>
    <loc>${escapeXml(absolute(page.path))}</loc>
    <lastmod>${page.updated}</lastmod>${page.image ? `
    <image:image><image:loc>${escapeXml(absolute(page.image))}</image:loc><image:caption>${escapeXml(page.imageAlt)}</image:caption></image:image>` : ""}
  </url>`).join("\n")}
</urlset>`);
await writeFile(join(outDir, "robots.txt"), `User-agent: *
Allow: /

Sitemap: ${absolute("/sitemap.xml")}
`);
await writeFile(join(outDir, "rss.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${siteName}</title>
    <link>${site}</link>
    <description>Practical China travel guides for international visitors.</description>
    <language>en</language>
${guides.map((item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(absolute(`/guides/${item.slug}/`))}</link>
      <guid>${escapeXml(absolute(`/guides/${item.slug}/`))}</guid>
      <pubDate>${new Date(`${item.published}T00:00:00Z`).toUTCString()}</pubDate>
      <description>${escapeXml(item.description)}</description>
${item.tagList.map((tag) => `      <category>${escapeXml(tag)}</category>`).join("\n")}
    </item>`).join("\n")}
  </channel>
</rss>`);

if (process.argv.includes("--serve")) {
  createServer(async (req, res) => {
    const path = req.url === "/" ? "/index.html" : req.url.endsWith("/") ? `${req.url}index.html` : req.url;
    try {
      const file = await readFile(join(outDir, path));
      res.end(file);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  }).listen(4173, "127.0.0.1", () => console.log("Preview: http://localhost:4173"));
}
