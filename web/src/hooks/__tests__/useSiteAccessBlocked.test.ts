import {act, renderHook, waitFor} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {SITE_ACCESS_BLOCKED_DEFAULT, subscribeSiteAccessBlocked} from "../../firebase";
import {useSiteAccessBlocked} from "../useSiteAccessBlocked";

vi.mock("../../firebase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../firebase")>();
  return {
    ...actual,
    subscribeSiteAccessBlocked: vi.fn(),
  };
});

describe("useSiteAccessBlocked", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to open and updates when Remote Config reports blocked", async () => {
    let emitBlocked: ((blocked: boolean) => void) | undefined;
    vi.mocked(subscribeSiteAccessBlocked).mockImplementation((onChange) => {
      emitBlocked = onChange;
      onChange(SITE_ACCESS_BLOCKED_DEFAULT);
      return () => undefined;
    });

    const {result} = renderHook(() => useSiteAccessBlocked());

    expect(result.current).toBe(false);

    act(() => {
      emitBlocked?.(true);
    });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("stays open when the subscription never reports blocked", () => {
    vi.mocked(subscribeSiteAccessBlocked).mockImplementation((onChange) => {
      onChange(false);
      return () => undefined;
    });

    const {result} = renderHook(() => useSiteAccessBlocked());

    expect(result.current).toBe(false);
  });
});
