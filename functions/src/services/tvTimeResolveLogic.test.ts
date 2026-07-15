import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
  DEFAULT_SHOW_OVERRIDES,
  chooseMatch,
  isAcceptedMatch,
  normalizeTitle,
  parseResolveShowsInput,
  scoreCandidate,
  sequenceMatcherRatio,
  titleVariants,
} from "./tvTimeResolveLogic";

describe("tvTimeResolveLogic", () => {
  it("normalizes titles for comparison", () => {
    assert.equal(normalizeTitle("Hunter x Hunter (2011)"), "hunter x hunter 2011");
    assert.equal(normalizeTitle("The   Office!"), "the office");
  });

  it("builds title search variants", () => {
    assert.deepEqual(titleVariants("Criminal Minds: Beyond Borders"), [
      "Criminal Minds: Beyond Borders",
      "Criminal Minds",
    ]);
    assert.deepEqual(titleVariants("Silo (2023)"), ["Silo (2023)", "Silo", "Silo 2023"]);
  });

  it("scores exact and near matches like SequenceMatcher", () => {
    assert.equal(sequenceMatcherRatio("silo", "silo"), 1);
    assert.ok(sequenceMatcherRatio("breaking bad", "breaking bad") === 1);
    assert.ok(sequenceMatcherRatio("hunter x hunter", "hunter x hunter") === 1);
    assert.ok(scoreCandidate("Silo", {id: 1, title: "Silo"}, null) === 1);
    assert.ok(scoreCandidate("Silo (2023)", {id: 1, title: "Silo", releaseDate: "2023-05-01"}, 2023) === 1);
  });

  it("marks close runners-up as ambiguous", () => {
    const match = chooseMatch(
      "Show Name",
      [
        {id: 1, title: "Show Namee", popularity: 10},
        {id: 2, title: "Show Named", popularity: 9},
      ],
      "Show Name",
    );
    assert.equal(match.method, "ambiguous");
    assert.equal(isAcceptedMatch(match), false);
  });

  it("accepts high-confidence search matches", () => {
    const match = chooseMatch(
      "Breaking Bad",
      [{id: 1396, title: "Breaking Bad", popularity: 100}],
      "Breaking Bad",
    );
    assert.equal(match.method, "exact");
    assert.equal(isAcceptedMatch(match), true);
  });

  it("includes known remake overrides", () => {
    assert.equal(DEFAULT_SHOW_OVERRIDES.get("252322"), 46298);
  });

  it("validates resolve request chunks", () => {
    assert.throws(() => parseResolveShowsInput({shows: []}), /1–25/);
    assert.deepEqual(
      parseResolveShowsInput({shows: [{sourceShowId: "100", title: "Silo"}]}),
      [{sourceShowId: "100", title: "Silo"}],
    );
  });
});
