import {getFirestore} from "firebase-admin/firestore";
import {MediaDetail, MediaSummary} from "../models/media";
import {PuzzleChoice, PuzzleHint, UpsertPuzzleInput} from "../models/puzzle";
import {
  buildOpaqueImageUrls,
  calendarDateInTimeZone,
  DistractorCandidate,
  rankDistractors,
} from "./puzzleLogic";
import {puzzleService} from "./puzzleService";
import {tmdbService} from "./tmdbService";

export const AUTO_PUZZLE_TIME_ZONE = "Asia/Taipei";
const MAX_SHOW_ATTEMPTS = 8;
const CHOICE_IDS = ["a", "b", "c", "d"] as const;

export type EnsureTodayPuzzleResult =
  | {created: true; puzzleDate: string; puzzleId: string}
  | {created: false; puzzleDate: string; reason: "exists" | "exhausted"};

const shuffle = <T>(items: T[]): T[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const pickOne = <T>(items: T[]): T | null => {
  if (items.length === 0) {
    return null;
  }
  return items[Math.floor(Math.random() * items.length)] ?? null;
};

export const buildAutoPuzzleHints = (detail: MediaDetail): PuzzleHint[] => {
  const hints: PuzzleHint[] = [];
  const year = detail.releaseDate?.slice(0, 4);
  if (year) {
    hints.push({revealAfterAttempt: 1, type: "year", value: year});
  }
  const genres = (detail.genres ?? []).map((genre) => genre.name).filter(Boolean);
  if (genres.length > 0) {
    hints.push({revealAfterAttempt: 2, type: "genre", value: genres.join(", ")});
  }
  return hints;
};

export const buildChoicesFromTitles = (correctTitle: string, distractorTitles: string[]): PuzzleChoice[] => {
  const titles = [correctTitle, ...distractorTitles].slice(0, 4);
  while (titles.length < 4) {
    titles.push(`Option ${titles.length + 1}`);
  }
  return CHOICE_IDS.map((choiceId, index) => ({
    choiceId,
    title: titles[index] ?? `Option ${index + 1}`,
  }));
};

export const suggestDistractorsForShow = async (
  showId: number,
  language: "en-US" = "en-US",
): Promise<{answer: {id: number; title: string}; distractors: Array<{id: number; title: string}>}> => {
  const detail = await tmdbService.tvDetail(showId, language);
  const year = detail.releaseDate ? Number(detail.releaseDate.slice(0, 4)) : null;
  const search = await tmdbService.search(detail.title.split(":")[0] ?? detail.title, 1, language);
  const trending = await tmdbService.trendingTv(1, language);
  const candidates: DistractorCandidate[] = [...search.tv.results, ...trending.results]
    .filter((item, index, arr) => arr.findIndex((entry) => entry.id === item.id) === index)
    .map((item) => ({
      id: item.id,
      title: item.title,
      genreIds: [],
      releaseYear: item.releaseDate ? Number(item.releaseDate.slice(0, 4)) : null,
      popularity: item.popularity,
      originCountry: null,
      networkOrProvider: null,
    }));

  const ranked = rankDistractors(
    {
      id: detail.id,
      title: detail.title,
      genreIds: detail.genres?.map((genre) => genre.id) ?? [],
      releaseYear: year,
      popularity: detail.popularity,
      originCountry: null,
    },
    candidates,
    3,
  );

  return {
    answer: {id: detail.id, title: detail.title},
    distractors: ranked.map((item) => ({id: item.id, title: item.title})),
  };
};

const loadTrendingPool = async (): Promise<MediaSummary[]> => {
  const [page1, page2] = await Promise.all([
    tmdbService.trendingTv(1, "en-US"),
    tmdbService.trendingTv(2, "en-US"),
  ]);
  const seen = new Set<number>();
  const pool: MediaSummary[] = [];
  for (const item of [...page1.results, ...page2.results]) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    pool.push(item);
  }
  return pool;
};

const tryBuildPuzzleFromShow = async (
  show: MediaSummary,
  puzzleDate: string,
): Promise<UpsertPuzzleInput | null> => {
  const detail = await tmdbService.tvDetail(show.id, "en-US");
  const seasons = (detail.seasons ?? []).filter((season) => season.seasonNumber > 0 && season.episodeCount > 0);
  if (seasons.length === 0) {
    return null;
  }

  for (const season of shuffle(seasons).slice(0, 3)) {
    const seasonDetail = await tmdbService.tvSeasonDetail(show.id, season.seasonNumber, "en-US");
    const episodes = seasonDetail.episodes.filter((episode) => episode.episodeNumber > 0);
    if (episodes.length === 0) {
      continue;
    }

    for (const episode of shuffle(episodes).slice(0, 4)) {
      const stills = await tmdbService.tvEpisodeImages(show.id, episode.seasonNumber, episode.episodeNumber);
      if (stills.length === 0) {
        continue;
      }
      const still = pickOne(stills);
      if (!still) {
        continue;
      }

      const urls = buildOpaqueImageUrls(still.filePath);
      const suggested = await suggestDistractorsForShow(show.id);
      const choices = buildChoicesFromTitles(
        detail.title,
        suggested.distractors.map((item) => item.title),
      );

      return {
        puzzleDate,
        correctShowId: detail.id,
        correctTitle: detail.title,
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
        imageUrl: urls.desktopUrl,
        mobileImageUrl: urls.mobileUrl,
        choices,
        correctChoiceId: "a",
        hints: buildAutoPuzzleHints(detail),
        difficulty: "medium",
        status: "published",
        locale: "en-US",
        imageAsset: {
          sourceProvider: "tmdb",
          tmdbSeriesId: detail.id,
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          sourceFilePath: still.filePath,
          storagePath: urls.storagePath,
          desktopUrl: urls.desktopUrl,
          mobileUrl: urls.mobileUrl,
          width: still.width,
          height: still.height,
          aspectRatio: still.aspectRatio,
          difficulty: "medium",
          containsLeadCharacter: false,
          containsSubtitle: false,
          spoilerRisk: "medium",
          editorialApproved: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
    }
  }

  return null;
};

class AutoPuzzleService {
  async ensureTodayPuzzle(now = new Date()): Promise<EnsureTodayPuzzleResult> {
    const puzzleDate = calendarDateInTimeZone(now, AUTO_PUZZLE_TIME_ZONE);
    const existing = await getFirestore().collection("puzzlePrivate").doc(puzzleDate).get();
    if (existing.exists) {
      return {created: false, puzzleDate, reason: "exists"};
    }

    const pool = shuffle(await loadTrendingPool());
    const attempts = pool.slice(0, MAX_SHOW_ATTEMPTS);

    for (const show of attempts) {
      try {
        const payload = await tryBuildPuzzleFromShow(show, puzzleDate);
        if (!payload) {
          continue;
        }
        const result = await puzzleService.upsertPuzzle(payload);
        console.info(
          JSON.stringify({
            event: "auto_puzzle_created",
            puzzleDate,
            showId: payload.correctShowId,
            seasonNumber: payload.seasonNumber,
            episodeNumber: payload.episodeNumber,
          }),
        );
        return {created: true, puzzleDate, puzzleId: result.puzzleId};
      } catch (error) {
        console.warn(
          JSON.stringify({
            event: "auto_puzzle_show_attempt_failed",
            puzzleDate,
            showId: show.id,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }

    console.warn(JSON.stringify({event: "auto_puzzle_exhausted", puzzleDate, attempts: attempts.length}));
    return {created: false, puzzleDate, reason: "exhausted"};
  }
}

export const autoPuzzleService = new AutoPuzzleService();
