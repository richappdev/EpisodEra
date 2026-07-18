import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {describe, expect, it, vi} from "vitest";
import {ListPage} from "../ListPage";
import {movieDetail} from "../../test/fixtures";

describe("ListPage", () => {
  it("renders list items, back link, and load more", async () => {
    const onLoadMore = vi.fn();
    const onSelect = vi.fn();

    render(
      <MemoryRouter>
        <ListPage
          title="Something relaxing"
          reason="Popular titles matched to this mood or time budget."
          items={[movieDetail]}
          loading={false}
          loadingMore={false}
          error={null}
          hasMore
          onLoadMore={onLoadMore}
          onRetry={vi.fn()}
          onSelect={onSelect}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("list-back")).toHaveAttribute("href", "/");
    expect(screen.getByRole("heading", {name: "Something relaxing"})).toBeVisible();
    expect(screen.getByText("Popular titles matched to this mood or time budget.")).toBeVisible();
    expect(screen.getByTestId("media-card-movie-2001")).toBeVisible();

    screen.getByTestId("list-load-more").click();
    expect(onLoadMore).toHaveBeenCalled();
  });

  it("shows empty state when there are no titles", () => {
    render(
      <MemoryRouter>
        <ListPage
          title="Suggested for you"
          reason={null}
          items={[]}
          loading={false}
          loadingMore={false}
          error={null}
          hasMore={false}
          onLoadMore={vi.fn()}
          onRetry={vi.fn()}
          onSelect={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("No titles in this list.")).toBeVisible();
  });
});
