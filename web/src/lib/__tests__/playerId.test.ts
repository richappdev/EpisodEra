import {beforeEach, describe, expect, it, vi} from "vitest";
import {getOrCreatePlayerId} from "../playerId";

describe("getOrCreatePlayerId", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates and reuses a stable localStorage player id", () => {
    const first = getOrCreatePlayerId();
    const second = getOrCreatePlayerId();
    expect(first).toMatch(/^[0-9a-f-]{36}$|^anon-/);
    expect(second).toBe(first);
    expect(window.localStorage.getItem("episodera.dailyPuzzle.playerId")).toBe(first);
  });

  it("falls back when localStorage throws", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const id = getOrCreatePlayerId();
    expect(id.length).toBeGreaterThan(4);
    getItem.mockRestore();
  });
});
