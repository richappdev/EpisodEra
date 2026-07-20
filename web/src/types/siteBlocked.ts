import {SupportedLanguage} from "./settings";

export const siteBlockedCopy: Record<
  SupportedLanguage,
  {
    brand: string;
    title: string;
    support: string;
  }
> = {
  "en-US": {
    brand: "Episodera",
    title: "This website is under optimization",
    support: "We'll be back soon. Thank you for your patience.",
  },
  "zh-TW": {
    brand: "Episodera",
    title: "網站優化中",
    support: "我們很快就會回來，感謝您的耐心等候。",
  },
};
