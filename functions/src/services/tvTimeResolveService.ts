import {HttpError} from "../lib/httpError";
import {MediaSummary} from "../models/media";
import {mediaMappingService} from "./mediaMappingService";
import {tmdbService} from "./tmdbService";
import {
  DEFAULT_SHOW_OVERRIDES,
  MatchResult,
  MIN_CONFIDENCE,
  ResolveShowInput,
  TmdbTvCandidate,
  chooseMatch,
  extractYearHint,
  isAcceptedMatch,
  parseResolveShowsInput,
  titleVariants,
} from "./tvTimeResolveLogic";

export interface MappingCandidate {
  tmdbId: number;
  title: string;
  poster: string | null;
  backdrop: string | null;
  year: string | null;
}

export interface AcceptedShowMapping {
  sourceShowId: string;
  tmdbId: number;
  title: string;
  poster: string | null;
  backdrop: string | null;
  confidence: number;
  matchMethod: string;
}

export interface SkippedShowMapping {
  sourceShowId: string;
  title: string;
  reason: string;
  confidence?: number;
  notes?: string;
  candidates: MappingCandidate[];
}

export interface ResolveShowsResult {
  accepted: AcceptedShowMapping[];
  skipped: SkippedShowMapping[];
}

interface CacheEntry {
  expiresAt: number;
  candidates: TmdbTvCandidate[];
}

const searchCacheTtlMs = 60 * 60 * 1000;
const searchCache = new Map<string, CacheEntry>();

const toCandidate = (item: MediaSummary): TmdbTvCandidate => ({
  id: item.id,
  title: item.title,
  originalTitle: item.title,
  releaseDate: item.releaseDate,
  popularity: item.popularity,
  poster: item.images.poster,
  backdrop: item.images.backdrop,
});

const cacheKey = (query: string, year: number | null) =>
  `${query.toLowerCase()}|${year ?? ""}`;

const searchTv = async (query: string, year: number | null): Promise<TmdbTvCandidate[]> => {
  const key = cacheKey(query, year);
  const cached = searchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.candidates;
  }

  const result = await tmdbService.search(query, 1, "en-US");
  let candidates = result.tv.results.map(toCandidate);
  if (year !== null) {
    const yearMatches = candidates.filter((item) => (item.releaseDate ?? "").startsWith(String(year)));
    if (yearMatches.length > 0) {
      candidates = yearMatches;
    }
  }

  searchCache.set(key, {expiresAt: Date.now() + searchCacheTtlMs, candidates});
  return candidates;
};

const findBestMatch = async (showName: string): Promise<MatchResult> => {
  let best: MatchResult = {
    candidate: null,
    confidence: 0,
    method: "unresolved",
    searchQuery: showName,
    candidateCount: 0,
    notes: "No match",
    candidates: [],
  };

  for (const query of titleVariants(showName)) {
    const {year} = extractYearHint(query);
    const candidates = await searchTv(query, year);
    const result = chooseMatch(showName, candidates, query);
    if (result.candidate && result.confidence > best.confidence) {
      best = result;
    }
    if (result.confidence >= 0.98) {
      break;
    }
  }

  return best;
};

const toMappingCandidates = (candidates: TmdbTvCandidate[]): MappingCandidate[] =>
  candidates.slice(0, 5).map((candidate) => ({
    tmdbId: candidate.id,
    title: candidate.title,
    poster: candidate.poster ?? null,
    backdrop: candidate.backdrop ?? null,
    year: candidate.releaseDate ? candidate.releaseDate.slice(0, 4) : null,
  }));

const detailAsCandidate = async (tmdbId: number): Promise<TmdbTvCandidate> => {
  const detail = await tmdbService.tvDetail(tmdbId, "en-US");
  return {
    id: detail.id,
    title: detail.title,
    originalTitle: detail.title,
    releaseDate: detail.releaseDate,
    popularity: detail.popularity,
    poster: detail.images.poster,
    backdrop: detail.images.backdrop,
  };
};

const acceptedFromMatch = (sourceShowId: string, sourceTitle: string, match: MatchResult): AcceptedShowMapping => ({
  sourceShowId,
  tmdbId: match.candidate!.id,
  title: match.candidate!.title || sourceTitle,
  poster: match.candidate!.poster ?? null,
  backdrop: match.candidate!.backdrop ?? null,
  confidence: match.confidence,
  matchMethod: match.method,
});

const skippedFromMatch = (sourceShowId: string, title: string, match: MatchResult): SkippedShowMapping => {
  let reason = "unresolved";
  if (match.method === "ambiguous") {
    reason = "ambiguous";
  } else if (match.candidate && match.confidence < MIN_CONFIDENCE) {
    reason = "low_confidence";
  }
  return {
    sourceShowId,
    title,
    reason,
    confidence: match.confidence || undefined,
    notes: match.notes || undefined,
    candidates: toMappingCandidates(match.candidates ?? (match.candidate ? [match.candidate] : [])),
  };
};

export const parseResolveTvTimeShowsBody = (body: unknown): ResolveShowInput[] => {
  try {
    return parseResolveShowsInput(body);
  } catch (error) {
    throw new HttpError(
      400,
      error instanceof Error ? error.message : "Invalid resolve payload.",
      "invalid_import_payload",
    );
  }
};

class TvTimeResolveService {
  async resolveShows(shows: ResolveShowInput[]): Promise<ResolveShowsResult> {
    const accepted: AcceptedShowMapping[] = [];
    const skipped: SkippedShowMapping[] = [];

    for (const show of shows) {
      const overrideId = DEFAULT_SHOW_OVERRIDES.get(show.sourceShowId);
      if (overrideId !== undefined) {
        const candidate = await detailAsCandidate(overrideId);
        const match: MatchResult = {
          candidate,
          confidence: 1,
          method: "manual",
          searchQuery: `override:${show.sourceShowId}`,
          candidateCount: 1,
          notes: "Manual override",
          candidates: [candidate],
        };
        accepted.push(acceptedFromMatch(show.sourceShowId, show.title, match));
        continue;
      }

      const storedMapping = await mediaMappingService.get("tv_time", "tv", show.sourceShowId);
      if (storedMapping) {
        const candidate = await detailAsCandidate(storedMapping.tmdbId);
        const match: MatchResult = {
          candidate,
          confidence: 1,
          method: "manual",
          searchQuery: `mapping:${show.sourceShowId}`,
          candidateCount: 1,
          notes: "Stored media mapping",
          candidates: [candidate],
        };
        accepted.push(acceptedFromMatch(show.sourceShowId, show.title, match));
        continue;
      }

      const match = await findBestMatch(show.title);
      if (isAcceptedMatch(match)) {
        accepted.push(acceptedFromMatch(show.sourceShowId, show.title, match));
      } else {
        skipped.push(skippedFromMatch(show.sourceShowId, show.title, match));
      }
    }

    return {accepted, skipped};
  }
}

export const tvTimeResolveService = new TvTimeResolveService();

/** Test helper — clears in-memory search cache. */
export const resetTvTimeResolveCacheForTests = () => {
  searchCache.clear();
};
