import {zipSync, strToU8} from "fflate";
import {describe, expect, it} from "vitest";
import {extractTvTimeCsvsFromZip, findZipMemberByBasename} from "./tvTimeZip";

const trackingCsv = `ep_id,s_id,series_name,season_number,episode_number,created_at,is_followed
e1,100,Silo,1,1,2024-01-01 00:00:00,
`;

const showsCsv = `tv_show_id,tv_show_name,is_followed,is_favorited,nb_episodes_seen
100,Silo,1,0,1
`;

describe("tvTimeZip", () => {
  it("finds zip members by basename, preferring the shallowest path", () => {
    expect(
      findZipMemberByBasename(
        ["nested/deep/tracking-prod-records-v2.csv", "tracking-prod-records-v2.csv"],
        "tracking-prod-records-v2.csv",
      ),
    ).toBe("tracking-prod-records-v2.csv");
  });

  it("extracts required CSVs from a nested GDPR zip", () => {
    const bytes = zipSync({
      "export/tracking-prod-records-v2.csv": strToU8(trackingCsv),
      "export/user_tv_show_data.csv": strToU8(`\uFEFF${showsCsv}`),
      "export/tokens.csv": strToU8("token\nabc\n"),
    });

    const extracted = extractTvTimeCsvsFromZip(bytes);
    expect(extracted.tracking).toContain("ep_id");
    expect(extracted.shows).toContain("tv_show_id");
    expect(extracted.shows.startsWith("\uFEFF")).toBe(false);
  });

  it("rejects archives missing required members", () => {
    const bytes = zipSync({
      "tracking-prod-records-v2.csv": strToU8(trackingCsv),
    });
    expect(() => extractTvTimeCsvsFromZip(bytes)).toThrow(/user_tv_show_data\.csv/);
  });
});
