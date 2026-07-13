import {describe, expect, it} from "vitest";
import {toErrorMessage} from "../errorMessage";

describe("toErrorMessage", () => {
  it("returns the error message when reason is an Error", () => {
    expect(toErrorMessage(new Error("Network down"), "Fallback")).toBe("Network down");
  });

  it("returns the fallback for non-Error values", () => {
    expect(toErrorMessage("timeout", "Could not load.")).toBe("Could not load.");
    expect(toErrorMessage(null, "Could not load.")).toBe("Could not load.");
  });
});
