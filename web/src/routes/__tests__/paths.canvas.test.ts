import {describe, expect, it} from "vitest";
import {canvasFromPath, isLandingPath, navFromPath, paths} from "../paths";

describe("canvasFromPath", () => {
  it("uses cinema canvas for every product route", () => {
    expect(canvasFromPath(paths.landing)).toBe("cinema");
    expect(canvasFromPath(paths.home)).toBe("cinema");
    expect(canvasFromPath(paths.search)).toBe("cinema");
    expect(canvasFromPath(paths.login)).toBe("cinema");
    expect(canvasFromPath(paths.signup)).toBe("cinema");
    expect(canvasFromPath(paths.franchises)).toBe("cinema");
    expect(canvasFromPath(paths.movie(1))).toBe("cinema");
    expect(canvasFromPath(paths.tv(2))).toBe("cinema");
    expect(canvasFromPath(paths.watchlist)).toBe("cinema");
    expect(canvasFromPath(paths.likes)).toBe("cinema");
    expect(canvasFromPath(paths.timeline)).toBe("cinema");
    expect(canvasFromPath(paths.profile)).toBe("cinema");
    expect(canvasFromPath(paths.settings)).toBe("cinema");
    expect(canvasFromPath(paths.privacy)).toBe("cinema");
    expect(canvasFromPath(paths.social)).toBe("cinema");
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
    expect(paths.landing).toBe("/");
    expect(paths.home).toBe("/home");
  });
});
