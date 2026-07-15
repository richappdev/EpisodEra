import {ImportEpisodeInput, ImportWatchlistItemInput} from "../types/import";

const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
};

const parseCsv = (text: string): Record<string, string>[] => {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
};

export const parseWatchlistImportCsv = (text: string): ImportWatchlistItemInput[] =>
  parseCsv(text)
    .map((row): ImportWatchlistItemInput => {
      const mediaType: "movie" | "tv" = row.mediaType === "movie" ? "movie" : "tv";
      return {
        tmdbId: Number(row.tmdbId),
        mediaType,
        title: row.title || row.tvShowName || `TMDb ${row.tmdbId}`,
        poster: row.poster || null,
        backdrop: row.backdrop || null,
        status: row.status || (mediaType === "movie" ? "unwatched" : "planned"),
        sourceShowId: row.sourceShowId || null,
      };
    })
    .filter((row) => Number.isInteger(row.tmdbId) && row.tmdbId > 0);

export const parseEpisodesImportCsv = (text: string): ImportEpisodeInput[] =>
  parseCsv(text).map((row) => ({
    tmdbId: Number(row.tmdbId),
    seasonNumber: Number(row.seasonNumber),
    episodeNumber: Number(row.episodeNumber),
    watchedAt: row.watchedAt || null,
    sourceShowId: row.sourceShowId || null,
    sourceEpisodeId: row.sourceEpisodeId || null,
    bulkType: row.bulkType || null,
  })).filter(
    (row) =>
      Number.isInteger(row.tmdbId) &&
      row.tmdbId > 0 &&
      Number.isInteger(row.seasonNumber) &&
      row.seasonNumber > 0 &&
      Number.isInteger(row.episodeNumber) &&
      row.episodeNumber > 0,
  );

export const chunkArray = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};
