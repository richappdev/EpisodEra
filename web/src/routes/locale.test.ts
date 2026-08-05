import {describe, expect, it} from "vitest";
import {
  browserPreferredLanguage,
  localizePath,
  parseLocalizedPath,
  replaceLocationLanguage,
  stripLocalePrefix,
} from "./locale";
import {languageForUrlLocale, urlLocaleForLanguage} from "../types/settings";

describe("localized routing", () => {
  it("maps URL locales to supported API languages", () => {
    expect(languageForUrlLocale("en-us")).toBe("en-US");
    expect(languageForUrlLocale("zh-tw")).toBe("zh-TW");
    expect(urlLocaleForLanguage("zh-TW")).toBe("zh-tw");
  });

  it("parses and strips supported prefixes", () => {
    expect(parseLocalizedPath("/zh-tw/tv/100/season/2")).toEqual({
      language: "zh-TW",
      pathname: "/tv/100/season/2",
      urlLocale: "zh-tw",
    });
    expect(parseLocalizedPath("/fr/home")).toBeNull();
    expect(stripLocalePrefix("/en-us/home")).toBe("/home");
  });

  it("localizes legacy and already-localized paths", () => {
    expect(localizePath("/movie/550", "en-us")).toBe("/en-us/movie/550");
    expect(localizePath("/en-us/movie/550", "zh-tw")).toBe("/zh-tw/movie/550");
    expect(localizePath("/", "zh-tw")).toBe("/zh-tw");
  });

  it("preserves query and hash while switching language", () => {
    expect(
      replaceLocationLanguage(
        {pathname: "/en-us/search", search: "?q=severance", hash: "#results"},
        "zh-TW",
      ),
    ).toBe("/zh-tw/search?q=severance#results");
  });

  it("resolves supported browser language families", () => {
    expect(browserPreferredLanguage(["zh-Hant-HK", "en-US"])).toBe("zh-TW");
    expect(browserPreferredLanguage(["fr-FR", "en-GB"])).toBe("en-US");
    expect(browserPreferredLanguage(["fr-FR"])).toBe("en-US");
  });
});
