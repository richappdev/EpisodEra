import {describe, expect, it} from "vitest";
import {canvasFromPath, isLandingPath, navFromPath, paths} from "../paths";

describe("canvasFromPath", () => {
  it("uses cinema canvas for every product route", () => {
    expect(canvasFromPath(paths.landing("en-us"))).toBe("cinema");
    expect(canvasFromPath(paths.home("en-us"))).toBe("cinema");
    expect(canvasFromPath(paths.search("en-us"))).toBe("cinema");
    expect(canvasFromPath(paths.login("en-us"))).toBe("cinema");
    expect(canvasFromPath(paths.signup("en-us"))).toBe("cinema");
    expect(canvasFromPath(paths.franchises("en-us"))).toBe("cinema");
    expect(canvasFromPath(paths.movie("en-us", 1))).toBe("cinema");
    expect(canvasFromPath(paths.tv("en-us", 2))).toBe("cinema");
    expect(canvasFromPath(paths.watchlist("en-us"))).toBe("cinema");
    expect(canvasFromPath(paths.likes("en-us"))).toBe("cinema");
    expect(canvasFromPath(paths.timeline("en-us"))).toBe("cinema");
    expect(canvasFromPath(paths.profile("en-us"))).toBe("cinema");
    expect(canvasFromPath(paths.settings("en-us"))).toBe("cinema");
    expect(canvasFromPath(paths.privacy("en-us"))).toBe("cinema");
    expect(canvasFromPath(paths.social("en-us"))).toBe("cinema");
  });
});

describe("landing and home paths", () => {
  it("treats / and /landing as landing chrome paths", () => {
    expect(isLandingPath("/")).toBe(true);
    expect(isLandingPath("/landing")).toBe(true);
    expect(isLandingPath("/home")).toBe(false);
  });

  it("maps /home to trending nav and /continue-watching to watchlist", () => {
    expect(navFromPath("/home")).toBe("trending");
    expect(navFromPath("/continue-watching")).toBe("watchlist");
    expect(navFromPath("/likes")).toBe("likes");
    expect(paths.landing("en-us")).toBe("/en-us");
    expect(paths.home("zh-tw")).toBe("/zh-tw/home");
  });
});
