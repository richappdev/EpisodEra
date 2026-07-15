import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {describe, expect, it, vi} from "vitest";
import {yearRecap} from "../../test/fixtures";
import {buildRecapShareText, YearRecapCard} from "../YearRecapCard";

describe("YearRecapCard", () => {
  it("renders recap highlights and builds share text", () => {
    render(<YearRecapCard recap={yearRecap} onYearChange={vi.fn()} />);

    expect(screen.getByTestId("year-recap-card")).toBeVisible();
    expect(screen.getByTestId("recap-top-show")).toHaveTextContent("Critical Flow Show");
    expect(screen.getByTestId("recap-top-genre")).toHaveTextContent("Drama");
    expect(screen.getByTestId("recap-streak")).toHaveTextContent("1 day");
    expect(buildRecapShareText(yearRecap)).toContain("Episodera 2026 Year in Review");
    expect(buildRecapShareText(yearRecap)).toContain("Top show: Critical Flow Show");
  });

  it("changes year and copies the shareable recap", async () => {
    const user = userEvent.setup();
    const onYearChange = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {writeText},
    });

    render(<YearRecapCard recap={yearRecap} onYearChange={onYearChange} />);

    await user.selectOptions(screen.getByTestId("recap-year"), "2025");
    expect(onYearChange).toHaveBeenCalledWith(2025);

    fireEvent.click(screen.getByTestId("recap-copy"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(buildRecapShareText(yearRecap)));
    expect(screen.getByTestId("recap-share-status")).toHaveTextContent("Recap copied");
  });
});
