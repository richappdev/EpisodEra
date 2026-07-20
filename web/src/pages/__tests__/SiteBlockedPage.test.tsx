import {render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import {useAppContext} from "../../AppContext";
import {SiteBlockedPage} from "../SiteBlockedPage";

vi.mock("../../AppContext", () => ({
  useAppContext: vi.fn(),
}));

describe("SiteBlockedPage", () => {
  it("renders English optimization copy with the brand", () => {
    vi.mocked(useAppContext).mockReturnValue({language: "en-US"} as ReturnType<typeof useAppContext>);

    render(<SiteBlockedPage />);

    expect(screen.getByText("Episodera")).toBeInTheDocument();
    expect(screen.getByRole("heading", {level: 1, name: "This website is under optimization"})).toBeInTheDocument();
    expect(screen.getByText("We'll be back soon. Thank you for your patience.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("renders Traditional Chinese copy", () => {
    vi.mocked(useAppContext).mockReturnValue({language: "zh-TW"} as ReturnType<typeof useAppContext>);

    render(<SiteBlockedPage />);

    expect(screen.getByRole("heading", {level: 1, name: "網站優化中"})).toBeInTheDocument();
    expect(screen.getByText("我們很快就會回來，感謝您的耐心等候。")).toBeInTheDocument();
  });
});
