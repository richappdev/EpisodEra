import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router-dom";
import {describe, expect, it, vi} from "vitest";
import {FranchiseDetailPage} from "../FranchiseDetailPage";
import {FranchiseListPage} from "../FranchiseListPage";
import {FranchiseProgress} from "../../types/franchise";

const progress: FranchiseProgress = {
  slug: "demo",
  name: "Demo Franchise",
  description: "A test franchise",
  order: "release",
  totalTitles: 2,
  watchedTitles: 1,
  inProgressTitles: 0,
  progressPercent: 50,
  phases: [{id: "early", name: "Early", totalTitles: 2, watchedTitles: 1, progressPercent: 50}],
  titles: [
    {
      tmdbId: 1,
      mediaType: "movie",
      title: "First",
      phaseId: "early",
      phaseName: "Early",
      releaseOrder: 1,
      chronologicalOrder: 2,
      runtimeMinutes: 100,
      status: "watched",
      progressPercent: 100,
    },
    {
      tmdbId: 2,
      mediaType: "movie",
      title: "Second",
      phaseId: "early",
      phaseName: "Early",
      releaseOrder: 2,
      chronologicalOrder: 1,
      runtimeMinutes: 110,
      status: "unwatched",
      progressPercent: 0,
    },
  ],
  recommendedNext: {
    tmdbId: 2,
    mediaType: "movie",
    title: "Second",
    phaseId: "early",
    phaseName: "Early",
    releaseOrder: 2,
    chronologicalOrder: 1,
    runtimeMinutes: 110,
    status: "unwatched",
    progressPercent: 0,
  },
};

describe("Franchise pages", () => {
  it("lists franchises", () => {
    render(
      <MemoryRouter>
        <FranchiseListPage
          error={null}
          loading={false}
          items={[
            {
              slug: "star-wars",
              name: "Star Wars",
              description: "Saga",
              titleCount: 11,
              phaseCount: 4,
            },
          ]}
          onRetry={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("franchise-card-star-wars")).toHaveAttribute("href", "/franchises/star-wars");
    expect(screen.getByTestId("franchise-card-star-wars")).toHaveTextContent("11 titles");
  });

  it("renders progress, recommended next, and order toggles", async () => {
    const user = userEvent.setup();
    const onOrderChange = vi.fn();
    const onSelectTitle = vi.fn();

    render(
      <MemoryRouter>
        <FranchiseDetailPage
          error={null}
          loading={false}
          order="release"
          progress={progress}
          signedIn
          onOrderChange={onOrderChange}
          onRetry={vi.fn()}
          onSelectTitle={onSelectTitle}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("franchise-progress-percent")).toHaveTextContent("50%");
    expect(screen.getByTestId("franchise-recommended-next")).toHaveTextContent("Second");
    await user.click(screen.getByTestId("order-chronological"));
    expect(onOrderChange).toHaveBeenCalledWith("chronological");
    await user.click(screen.getByTestId("franchise-title-2"));
    expect(onSelectTitle).toHaveBeenCalledWith({id: 2, mediaType: "movie", title: "Second"});
  });
});
