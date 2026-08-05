import assert from "node:assert/strict";
import test from "node:test";
import {genericWebMetadata, renderWebHtml} from "./webRenderer";

const template = `<!doctype html><html lang="en"><head>
<title>Default</title>
<meta name="robots" content="noindex,follow" />
<meta name="description" content="Default" />
<meta property="og:title" content="Default" />
<meta property="og:description" content="Default" />
<meta property="og:image" content="https://example.com/default.jpg" />
<meta property="og:locale" content="en_US" />
<meta name="twitter:title" content="Default" />
<meta name="twitter:description" content="Default" />
<meta name="twitter:image" content="https://example.com/default.jpg" />
</head><body></body></html>`;

test("renders localized canonical and reciprocal alternates", () => {
  const html = renderWebHtml(template, "zh-tw", "/zh-tw/movie/550", {
    title: "測試電影 · Episodera",
    description: "描述",
    image: "https://image.example/movie.jpg",
  });
  assert.match(html, /<html lang="zh-Hant-TW"/);
  assert.match(html, /rel="canonical" href="https:\/\/episodera\.web\.app\/zh-tw\/movie\/550"/);
  assert.match(html, /hreflang="en-US" href="https:\/\/episodera\.web\.app\/en-us\/movie\/550"/);
  assert.match(html, /content="index,follow"/);
});

test("renders 404 shells as noindex without language alternates", () => {
  const html = renderWebHtml(template, "en-us", "/en-us/tv/999", genericWebMetadata("en-us", "/tv/999"), true);
  assert.match(html, /content="noindex,follow"/);
  assert.doesNotMatch(html, /hreflang=/);
});
