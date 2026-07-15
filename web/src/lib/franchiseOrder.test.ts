import {describe, expect, it} from "vitest";
import {sortFranchiseTitles} from "./franchiseOrder";
import {FranchiseTitle} from "../types/franchise";

const titles: FranchiseTitle[] = [
  {
    tmdbId: 1,
    mediaType: "movie",
    title: "Release First",
    phaseId: "a",
    releaseOrder: 1,
    chronologicalOrder: 2,
    runtimeMinutes: 100,
  },
  {
    tmdbId: 2,
    mediaType: "movie",
    title: "Chrono First",
    phaseId: "a",
    releaseOrder: 2,
    chronologicalOrder: 1,
    runtimeMinutes: 110,
  },
];

describe("franchiseOrder", () => {
  it("sorts by release and chronological order", () => {
    expect(sortFranchiseTitles(titles, "release").map((title) => title.tmdbId)).toEqual([1, 2]);
    expect(sortFranchiseTitles(titles, "chronological").map((title) => title.tmdbId)).toEqual([2, 1]);
  });
});
