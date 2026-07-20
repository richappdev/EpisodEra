import {describe, expect, it} from "vitest";
import {sha256Hex} from "../sha256";

describe("sha256Hex", () => {
  it("hashes UTF-8 strings to a stable 64-char hex digest", async () => {
    const digest = await sha256Hex("episodera-import");
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(await sha256Hex("episodera-import")).toBe(digest);
    expect(await sha256Hex("other")).not.toBe(digest);
  });
});
