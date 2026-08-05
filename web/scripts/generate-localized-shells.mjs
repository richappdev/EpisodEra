import {mkdir, readFile, writeFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(webRoot, "..");
const distRoot = resolve(webRoot, "dist");
const baseHtml = await readFile(resolve(distRoot, "index.html"), "utf8");
const origin = "https://episodera.web.app";

const locales = {
  "en-us": {language: "en-US", ogLocale: "en_US"},
  "zh-tw": {language: "zh-Hant-TW", ogLocale: "zh_TW"},
};

const fixedRoutes = [
  {path: "", indexable: true},
  {path: "home", indexable: true},
  {path: "franchises", indexable: true},
  {path: "play/daily-puzzle", indexable: true},
  {path: "privacy", indexable: true},
  {path: "search", indexable: false},
  {path: "watchlist", indexable: false},
  {path: "continue-watching", indexable: false},
  {path: "likes", indexable: false},
  {path: "timeline", indexable: false},
  {path: "social", indexable: false},
  {path: "profile", indexable: false},
  {path: "settings", indexable: false},
  {path: "login", indexable: false},
  {path: "signup", indexable: false},
  {path: "admin/puzzles", indexable: false},
  {path: "play", indexable: false},
];

const copy = {
  "en-us": {
    description: "Track movies and TV, never lose the next episode, and keep a personal diary of what you watched.",
    landingTitle: "Episodera — Track shows, episodes & watch history",
  },
  "zh-tw": {
    description: "追蹤電影與影集、不再錯過下一集，並留下你看過什麼的個人日記。",
    landingTitle: "Episodera — 追蹤影集、集數與觀看紀錄",
  },
};

const routeLabel = (locale, path) => {
  const labels = locale === "zh-tw"
    ? {home: "首頁", franchises: "片單宇宙", "play/daily-puzzle": "每日謎題", privacy: "隱私權"}
    : {home: "Home", franchises: "Franchises", "play/daily-puzzle": "Daily puzzle", privacy: "Privacy"};
  return labels[path] ?? (locale === "zh-tw" ? "Episodera 應用程式" : "Episodera app");
};

const injectHead = (html, locale, route) => {
  const path = `/${locale}${route.path ? `/${route.path}` : ""}`;
  const canonical = `${origin}${path}`;
  const title = route.path ? `${routeLabel(locale, route.path)} · Episodera` : copy[locale].landingTitle;
  const description = copy[locale].description;
  const alternatePath = route.path ? `/${route.path}` : "";
  const links = route.indexable
    ? [
        `<link rel="canonical" href="${canonical}" />`,
        `<link rel="alternate" hreflang="en-US" href="${origin}/en-us${alternatePath}" />`,
        `<link rel="alternate" hreflang="zh-TW" href="${origin}/zh-tw${alternatePath}" />`,
        `<link rel="alternate" hreflang="x-default" href="${origin}/en-us${alternatePath}" />`,
      ].join("\n    ")
    : `<link rel="canonical" href="${canonical}" />`;
  return html
    .replace(/<html lang="[^"]*"/, `<html lang="${locales[locale].language}"`)
    .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
    .replace(/<meta name="description"\s+content="[^"]*"\s*\/>/s, `<meta name="description" content="${description}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description"\s+content="[^"]*"\s*\/>/s, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta name="twitter:description"\s+content="[^"]*"\s*\/>/s, `<meta name="twitter:description" content="${description}" />`)
    .replace(/<meta name="robots" content="[^"]*" \/>/, `<meta name="robots" content="${route.indexable ? "index,follow" : "noindex,follow"}" />`)
    .replace(/<meta property="og:locale" content="[^"]*" \/>/, `<meta property="og:locale" content="${locales[locale].ogLocale}" />`)
    .replace("</head>", `    ${links}\n    <meta property="og:url" content="${canonical}" />\n  </head>`);
};

for (const locale of Object.keys(locales)) {
  for (const route of fixedRoutes) {
    const relativeFile = route.path ? `${locale}/${route.path}.html` : `${locale}.html`;
    const outputFile = resolve(distRoot, relativeFile);
    await mkdir(dirname(outputFile), {recursive: true});
    await writeFile(outputFile, injectHead(baseHtml, locale, route), "utf8");
  }
}

const sitemapUrls = fixedRoutes
  .filter((route) => route.indexable)
  .flatMap((route) => Object.keys(locales).map((locale) => `${origin}/${locale}${route.path ? `/${route.path}` : ""}`));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}\n</urlset>\n`;
await writeFile(resolve(distRoot, "sitemap.xml"), sitemap, "utf8");
await writeFile(resolve(distRoot, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`, "utf8");

const functionShell = resolve(repoRoot, "functions", "generated", "web", "index.html");
await mkdir(dirname(functionShell), {recursive: true});
await writeFile(functionShell, baseHtml, "utf8");
