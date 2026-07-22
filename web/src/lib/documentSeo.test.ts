import {afterEach, describe, expect, it} from "vitest";
import {
  applyBrandedDocumentTitle,
  applyDocumentSeo,
  brandedPageTitle,
  defaultSeoCopy,
  htmlLangFor,
  mediaDetailPageLabel,
  titleForPath,
} from "./documentSeo";
import {paths} from "../routes/paths";

describe("documentSeo", () => {
  afterEach(() => {
    document.title = "";
    document.documentElement.lang = "en";
  });

  it("maps language to html lang", () => {
    expect(htmlLangFor("en-US")).toBe("en");
    expect(htmlLangFor("zh-TW")).toBe("zh-Hant");
  });

  it("uses landing SEO title on landing paths", () => {
    expect(titleForPath(paths.landing, "en-US")).toBe(defaultSeoCopy["en-US"].title);
    expect(titleForPath(paths.landingLegacy, "zh-TW")).toBe(defaultSeoCopy["zh-TW"].title);
  });

  it("prefixes in-app pages with brand", () => {
    expect(titleForPath(paths.home, "en-US")).toBe("Home · Episodera");
    expect(titleForPath(paths.settings, "zh-TW")).toBe("設定 · Episodera");
  });

  it("uses typed fallbacks for dynamic routes", () => {
    expect(titleForPath("/list/for-you", "en-US")).toBe("List · Episodera");
    expect(titleForPath("/list/relaxing", "zh-TW")).toBe("清單 · Episodera");
    expect(titleForPath("/movie/550", "en-US")).toBe("Movie · Episodera");
    expect(titleForPath("/movie/550", "zh-TW")).toBe("電影 · Episodera");
    expect(titleForPath("/tv/95396", "en-US")).toBe("TV show · Episodera");
    expect(titleForPath("/tv/95396/season/1", "zh-TW")).toBe("影集 · Episodera");
    expect(titleForPath("/franchises/star-wars", "en-US")).toBe("Franchise · Episodera");
    expect(titleForPath("/play/other-game", "zh-TW")).toBe("遊戲 · Episodera");
  });

  it("builds media detail labels with optional season", () => {
    expect(mediaDetailPageLabel("Severance")).toBe("Severance");
    expect(mediaDetailPageLabel("Severance", {language: "en-US", seasonNumber: 2})).toBe(
      "Severance · Season 2",
    );
    expect(mediaDetailPageLabel("人生切割術", {language: "zh-TW", seasonNumber: 1})).toBe(
      "人生切割術 · 第 1 季",
    );
  });

  it("applies branded title overrides", () => {
    document.head.innerHTML = `
      <meta property="og:title" content="" />
      <meta name="twitter:title" content="" />
    `;

    applyBrandedDocumentTitle("Something relaxing");
    expect(document.title).toBe(brandedPageTitle("Something relaxing"));
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(
      "Something relaxing · Episodera",
    );
  });

  it("applies site-blocked title", () => {
    applyDocumentSeo(paths.settings, "en-US", {siteBlocked: true});
    expect(document.title).toBe("Under optimization · Episodera");

    applyDocumentSeo(paths.settings, "zh-TW", {siteBlocked: true});
    expect(document.title).toBe("網站優化中 · Episodera");
  });

  it("applies title, lang, and meta description", () => {
    document.head.innerHTML = `
      <meta name="description" content="" />
      <meta property="og:title" content="" />
      <meta property="og:description" content="" />
      <meta property="og:locale" content="" />
      <meta name="twitter:title" content="" />
      <meta name="twitter:description" content="" />
    `;

    applyDocumentSeo(paths.landing, "zh-TW");

    expect(document.documentElement.lang).toBe("zh-Hant");
    expect(document.title).toBe(defaultSeoCopy["zh-TW"].title);
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      defaultSeoCopy["zh-TW"].description,
    );
    expect(document.querySelector('meta[property="og:locale"]')?.getAttribute("content")).toBe(
      "zh_TW",
    );
  });
});
