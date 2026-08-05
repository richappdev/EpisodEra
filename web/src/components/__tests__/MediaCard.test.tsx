import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router-dom";
import {describe, expect, it, vi} from "vitest";
import {movieDetail, tvDetail} from "../../test/fixtures";
import {MediaCard} from "../MediaCard";
import {MediaSection} from "../MediaSection";

describe("MediaCard", () => {
  it("renders movie metadata and invokes onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const item = {
      ...movieDetail,
      images: {...movieDetail.images, poster: "https://example.com/poster.jpg"},
    };

    render(<MediaCard item={item} onSelect={onSelect} />);

    expect(screen.getByText("Movie")).toBeVisible();
    expect(screen.getByText("2024")).toBeVisible();
    await user.click(screen.getByTestId("media-card-movie-2001"));
    expect(onSelect).toHaveBeenCalledWith(item);
  });

  it("falls back when poster, release date, or title are missing", () => {
    render(
      <MediaCard
        item={{
          ...tvDetail,
          title: "",
          releaseDate: null,
          images: {poster: null, backdrop: null},
        }}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Untitled")).toBeVisible();
    expect(screen.getByText("TBA")).toBeVisible();
    expect(screen.getAllByText("TV").length).toBeGreaterThanOrEqual(2);
  });
});

describe("MediaSection", () => {
  it("renders a grid by default", () => {
    render(<MediaSection title="Trending" items={[tvDetail]} onSelect={vi.fn()} />);
    expect(screen.getByRole("heading", {name: "Trending"})).toBeVisible();
    expect(screen.getByTestId("media-card-tv-1001")).toBeVisible();
    expect(screen.queryByTestId("list-more-trending")).not.toBeInTheDocument();
  });

  it("shows a More link for rail sections with a list id", () => {
    render(
      <MemoryRouter>
        <MediaSection
          title="Relaxing"
          layout="rail"
          listId="relaxing"
          items={[tvDetail, movieDetail]}
          onSelect={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("list-more-relaxing")).toHaveAttribute("href", "/en-us/list/relaxing");
  });

  it("hides the More link when a rail has no items", () => {
    render(
      <MemoryRouter>
        <MediaSection title="Empty" layout="rail" listId="empty" items={[]} onSelect={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId("list-more-empty")).not.toBeInTheDocument();
  });
});
