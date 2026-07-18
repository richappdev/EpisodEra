import {describe, expect, it} from "vitest";
import {canvasFromPath, paths} from "../paths";

describe("canvasFromPath", () => {
  it("uses cinema canvas for every product route", () => {
    expect(canvasFromPath(paths.home)).toBe("cinema");
    expect(canvasFromPath(paths.search)).toBe("cinema");
    expect(canvasFromPath(paths.login)).toBe("cinema");
    expect(canvasFromPath(paths.signup)).toBe("cinema");
    expect(canvasFromPath(paths.franchises)).toBe("cinema");
    expect(canvasFromPath(paths.movie(1))).toBe("cinema");
    expect(canvasFromPath(paths.tv(2))).toBe("cinema");
    expect(canvasFromPath(paths.watchlist)).toBe("cinema");
    expect(canvasFromPath(paths.timeline)).toBe("cinema");
    expect(canvasFromPath(paths.profile)).toBe("cinema");
    expect(canvasFromPath(paths.settings)).toBe("cinema");
    expect(canvasFromPath(paths.privacy)).toBe("cinema");
    expect(canvasFromPath(paths.social)).toBe("cinema");
  });
});
