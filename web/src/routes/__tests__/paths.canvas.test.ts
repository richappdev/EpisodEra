import {describe, expect, it} from "vitest";
import {canvasFromPath, paths} from "../paths";

describe("canvasFromPath", () => {
  it("uses cinema canvas for discovery, auth, and detail routes", () => {
    expect(canvasFromPath(paths.home)).toBe("cinema");
    expect(canvasFromPath(paths.search)).toBe("cinema");
    expect(canvasFromPath(paths.login)).toBe("cinema");
    expect(canvasFromPath(paths.signup)).toBe("cinema");
    expect(canvasFromPath(paths.franchises)).toBe("cinema");
    expect(canvasFromPath(paths.movie(1))).toBe("cinema");
    expect(canvasFromPath(paths.tv(2))).toBe("cinema");
  });

  it("uses memory canvas for library and personal surfaces", () => {
    expect(canvasFromPath(paths.watchlist)).toBe("memory");
    expect(canvasFromPath(paths.timeline)).toBe("memory");
    expect(canvasFromPath(paths.profile)).toBe("memory");
    expect(canvasFromPath(paths.settings)).toBe("memory");
    expect(canvasFromPath(paths.privacy)).toBe("memory");
    expect(canvasFromPath(paths.social)).toBe("memory");
  });
});
