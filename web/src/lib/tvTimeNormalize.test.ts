import {describe, expect, it} from "vitest";
import {normalizeTvTimeExport} from "./tvTimeNormalize";

describe("tvTimeNormalize", () => {
  it("dedupes episodes by ep_id and skips season/episode zero", () => {
    const normalized = normalizeTvTimeExport({
      tracking: `ep_id,s_id,series_name,season_number,episode_number,created_at,updated_at,bulk_type,is_followed
e1,100,Silo,1,1,2024-01-02 00:00:00,2024-01-03 00:00:00,,
e1,100,Silo,1,1,2024-01-01 00:00:00,2024-01-04 00:00:00,,
e2,100,Silo,0,1,2024-01-01 00:00:00,,,
e3,100,Silo,1,0,2024-01-01 00:00:00,,,
,200,Orphan,,1,,,,,1
`,
      shows: `tv_show_id,tv_show_name,is_followed,is_favorited,nb_episodes_seen
100,Silo,1,0,3
`,
    });

    expect(normalized.episodes).toHaveLength(1);
    expect(normalized.episodes[0]).toMatchObject({
      tvTimeShowId: "100",
      tvTimeEpisodeId: "e1",
      seasonNumber: 1,
      episodeNumber: 1,
      firstRecordedAt: "2024-01-01 00:00:00",
    });
    expect(normalized.skippedSeasonZero).toBe(1);
    expect(normalized.skippedEpisodeZero).toBe(1);
    expect(normalized.shows).toEqual([
      {
        tvTimeShowId: "100",
        tvShowName: "Silo",
        isFollowed: true,
        isFavorited: false,
        derivedUniqueEpisodeCount: 3,
      },
    ]);
  });

  it("adds followed shows from tracker rows when show table omits them", () => {
    const normalized = normalizeTvTimeExport({
      tracking: `ep_id,s_id,series_name,season_number,episode_number,created_at,is_followed,ep_watch_count
,300,Fallback Show,,, ,1,0
e9,300,Fallback Show,1,1,2024-05-01 12:00:00,,
`,
      shows: `tv_show_id,tv_show_name,is_followed,is_favorited,nb_episodes_seen
`,
    });

    expect(normalized.shows).toEqual([
      expect.objectContaining({
        tvTimeShowId: "300",
        tvShowName: "Fallback Show",
        isFollowed: true,
        derivedUniqueEpisodeCount: 1,
      }),
    ]);
    expect(normalized.episodes).toHaveLength(1);
  });
});
