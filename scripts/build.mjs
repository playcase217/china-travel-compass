import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const contentDir = join(root, "content/guides");
const publicDir = join(root, "public");
const outDir = join(root, "dist");

const escapeHtml = (value = "") =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

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

const layout = ({ title, description, content, current = "" }) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | China Travel Compass</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/"><span class="brand-mark">中</span><span>China Travel Compass</span></a>
    <nav><a class="${current === "home" ? "active" : ""}" href="/">Home</a><a class="${current === "guides" ? "active" : ""}" href="/guides/">Guides</a><a href="/about/">About</a></nav>
  </header>
  ${content}
  <footer><strong>China Travel Compass</strong><span>Clear, practical guidance for exploring China independently.</span><small>Travel rules can change. Confirm critical details with official sources before departure.</small></footer>
</body>
</html>`;

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await cp(publicDir, outDir, { recursive: true, filter: (source) => extname(source) !== ".png" });

const guideFiles = (await readdir(contentDir)).filter((name) => name.endsWith(".md"));
const guides = [];
for (const file of guideFiles) {
  const { meta, body } = parseGuide(await readFile(join(contentDir, file), "utf8"));
  guides.push(meta);
  const article = `<main>
    <section class="article-hero">
      <img src="${meta.hero}" alt="${escapeHtml(meta.heroAlt)}">
      <div class="article-hero-copy"><span class="eyebrow">${meta.category}</span><h1>${meta.title}</h1><p>${meta.description}</p><span class="meta">Updated ${meta.date} · ${meta.readTime}</span></div>
    </section>
    <article class="article">${markdown(body)}</article>
  </main>`;
  const dir = join(outDir, "guides", meta.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.html"), layout({ title: meta.title, description: meta.description, content: article }));
}

guides.sort((a, b) => b.date.localeCompare(a.date));
const guide = guides[0];
const guideCards = guides.map((item) => `<a class="guide-card" href="/guides/${item.slug}/"><img src="${item.hero}" alt="${escapeHtml(item.heroAlt)}"><span class="eyebrow">${item.category}</span><h3>${item.title}</h3><p>${item.description}</p><strong>Read guide →</strong></a>`).join("");
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
await writeFile(join(outDir, "index.html"), layout({ title: "Practical China travel guides", description: "Clear, practical China travel guides for international visitors.", content: home, current: "home" }));

await mkdir(join(outDir, "guides"), { recursive: true });
await writeFile(join(outDir, "guides/index.html"), layout({
  title: "Travel guides",
  description: "Practical China travel guides for international visitors.",
  current: "guides",
  content: `<main class="guide-section guide-index"><span class="eyebrow">China travel guides</span><h1>Plan clearly. Travel confidently.</h1><p>Start with the essentials, then choose the places and experiences that suit your pace.</p><div class="guide-grid">${guideCards}</div></main>`
}));

await mkdir(join(outDir, "about"), { recursive: true });
await writeFile(join(outDir, "about/index.html"), layout({
  title: "About",
  description: "About China Travel Compass.",
  content: `<main class="simple-page"><span class="eyebrow">About</span><h1>Travel guidance with the details in view.</h1><p>China Travel Compass helps international visitors plan independent trips with practical, easy-to-follow guidance.</p><p>We prioritize clear explanations and links to official sources for details that can change. Always confirm entry policies and booking requirements before departure.</p></main>`
}));

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
