import {afterEach, describe, expect, it} from "vitest";
import {
  applyDocumentSeo,
  defaultSeoCopy,
  htmlLangFor,
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
