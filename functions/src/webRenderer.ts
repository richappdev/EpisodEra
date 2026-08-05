import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {onRequest} from "firebase-functions/v2/https";
import {HttpError} from "./lib/httpError";
import {SupportedLanguage} from "./models/settings";
import {tmdbService} from "./services/tmdbService";

const siteOrigin = "https://episodera.web.app";
const locales = {
  "en-us": {language: "en-US" as SupportedLanguage, htmlLanguage: "en-US", ogLocale: "en_US"},
  "zh-tw": {language: "zh-TW" as SupportedLanguage, htmlLanguage: "zh-Hant-TW", ogLocale: "zh_TW"},
} as const;

type UrlLocale = keyof typeof locales;

interface PageMetadata {
  description: string;
  image: string;
  title: string;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const genericWebMetadata = (locale: UrlLocale, routePath: string): PageMetadata => {
  const chinese = locale === "zh-tw";
  const slug = routePath.split("/").filter(Boolean).at(-1)?.replace(/[-_]+/g, " ") ?? "";
  const label = routePath.startsWith("/movie/")
    ? chinese ? "電影" : "Movie"
    : routePath.startsWith("/tv/")
      ? chinese ? "影集" : "TV show"
      : routePath.startsWith("/franchises/")
        ? slug || (chinese ? "片單宇宙" : "Franchise")
        : slug || (chinese ? "探索清單" : "Discovery list");
  return {
    title: `${label} · Episodera`,
    description: chinese
      ? "在 Episodera 探索電影與影集、追蹤集數並保存觀看紀錄。"
      : "Discover movies and TV, track episodes, and keep your watch history with Episodera.",
    image: `${siteOrigin}/og.jpg`,
  };
};

const metadataForPath = async (locale: UrlLocale, routePath: string): Promise<PageMetadata> => {
  const match = routePath.match(/^\/(movie|tv)\/(\d+)(?:\/season\/\d+)?$/);
  if (!match) return genericWebMetadata(locale, routePath);
  const id = Number(match[2]);
  const detail = match[1] === "movie"
    ? await tmdbService.movieDetail(id, locales[locale].language)
    : await tmdbService.tvDetail(id, locales[locale].language);
  return {
    title: `${detail.title} · Episodera`,
    description: detail.overview || genericWebMetadata(locale, routePath).description,
    image: detail.images.backdrop ?? detail.images.poster ?? `${siteOrigin}/og.jpg`,
  };
};

export const renderWebHtml = (
  template: string,
  locale: UrlLocale,
  pathname: string,
  metadata: PageMetadata,
  noindex = false,
) => {
  const routePath = pathname.replace(new RegExp(`^/${locale}`), "") || "/";
  const alternatePath = routePath === "/" ? "" : routePath;
  const canonical = `${siteOrigin}${pathname}`;
  const tags = [
    `<link rel="canonical" href="${canonical}" />`,
    ...(!noindex ? [
      `<link rel="alternate" hreflang="en-US" href="${siteOrigin}/en-us${alternatePath}" />`,
      `<link rel="alternate" hreflang="zh-TW" href="${siteOrigin}/zh-tw${alternatePath}" />`,
      `<link rel="alternate" hreflang="x-default" href="${siteOrigin}/en-us${alternatePath}" />`,
    ] : []),
    `<meta property="og:url" content="${canonical}" />`,
  ].join("\n    ");
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const image = escapeHtml(metadata.image);
  return template
    .replace(/<html lang="[^"]*"/, `<html lang="${locales[locale].htmlLanguage}"`)
    .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
    .replace(/<meta name="robots" content="[^"]*" \/>/, `<meta name="robots" content="${noindex ? "noindex,follow" : "index,follow"}" />`)
    .replace(/<meta name="description"\s+content="[^"]*"\s*\/>/s, `<meta name="description" content="${description}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description"\s+content="[^"]*"\s*\/>/s, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${image}" />`)
    .replace(/<meta property="og:locale" content="[^"]*" \/>/, `<meta property="og:locale" content="${locales[locale].ogLocale}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta name="twitter:description"\s+content="[^"]*"\s*\/>/s, `<meta name="twitter:description" content="${description}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${image}" />`)
    .replace("</head>", `    ${tags}\n  </head>`);
};

export const web = onRequest(
  {region: "us-central1", secrets: ["TMDB_API_KEY"], timeoutSeconds: 30},
  async (req, res) => {
    const match = req.path.match(/^\/(en-us|zh-tw)(\/.*)?$/);
    if (req.method !== "GET" || !match) {
      res.status(404).send("Not found");
      return;
    }
    const locale = match[1] as UrlLocale;
    const pathname = req.path.replace(/\/+$/, "") || `/${locale}`;
    const routePath = match[2]?.replace(/\/+$/, "") || "/";
    const template = await readFile(join(__dirname, "..", "generated", "web", "index.html"), "utf8");
    try {
      const metadata = await metadataForPath(locale, routePath);
      res.set("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
      res.status(200).type("html").send(renderWebHtml(template, locale, pathname, metadata));
    } catch (error) {
      const notFound = error instanceof HttpError && error.status === 404;
      const metadata = genericWebMetadata(locale, routePath);
      res.set("Cache-Control", notFound ? "private, no-store" : "public, max-age=60, s-maxage=300");
      res.status(notFound ? 404 : 200).type("html").send(renderWebHtml(template, locale, pathname, metadata, notFound));
    }
  },
);
