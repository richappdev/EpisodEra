/** Pure TV Time title → TMDb match scoring (ported from tv_time_tool/resolve_tv_time_tmdb.py). */

export const MIN_CONFIDENCE = 0.82;
export const MAX_RESOLVE_SHOWS = 25;

export interface ResolveShowInput {
  sourceShowId: string;
  title: string;
}

export interface TmdbTvCandidate {
  id: number;
  title: string;
  originalTitle?: string;
  releaseDate?: string | null;
  popularity?: number;
  poster?: string | null;
  backdrop?: string | null;
}

export type MatchMethod = "exact" | "search" | "ambiguous" | "manual" | "unresolved";

export interface MatchResult {
  candidate: TmdbTvCandidate | null;
  confidence: number;
  method: MatchMethod;
  searchQuery: string;
  candidateCount: number;
  notes: string;
}

/** Known remake / spinoff overrides from the offline tool. */
export const DEFAULT_SHOW_OVERRIDES: ReadonlyMap<string, number> = new Map([
  ["296654", 64481], // Criminal Minds: Beyond Borders
  ["168151", 32200], // Criminal Minds: Suspect Behavior
  ["383837", 104699], // Shaman King (2021)
  ["339203", 77240], // Captain Tsubasa (2018)
  ["252322", 46298], // Hunter x Hunter (2011)
  ["72454", 30983], // Detective Conan
  ["415311", 210955], // First Love (2022)
  ["367146", 88329], // Hawkeye (2021)
  ["421649", 240667], // One Day (2024)
  ["321462", 69857], // Quartet (2017)
  ["440481", 236532], // The Strongest Tank's Labyrinth Raids
  ["281714", 62517], // Ballers
]);

export const normalizeTitle = (title: string): string =>
  title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const extractYearHint = (title: string): {base: string; year: number | null} => {
  const match = title.trim().match(/\((\d{4})\)\s*$/);
  if (!match) {
    return {base: title.trim(), year: null};
  }
  return {
    base: title.slice(0, match.index).trim(),
    year: Number(match[1]),
  };
};

export const titleVariants = (title: string): string[] => {
  const {base, year} = extractYearHint(title);
  const variants = [title.trim(), base];
  if (base.includes(":")) {
    variants.push(base.split(":", 1)[0].trim());
  }
  if (year !== null) {
    variants.push(`${base} ${year}`);
  }
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const variant of variants) {
    const normalized = variant.trim();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      deduped.push(normalized);
    }
  }
  return deduped;
};

/** Ratcliff/Obershelp similarity used by Python difflib.SequenceMatcher.ratio(). */
export const sequenceMatcherRatio = (left: string, right: string): number => {
  if (!left && !right) {
    return 1;
  }
  if (!left || !right) {
    return 0;
  }

  const longestMatch = (a: string, aStart: number, aEnd: number, b: string, bStart: number, bEnd: number) => {
    let bestI = aStart;
    let bestJ = bStart;
    let bestSize = 0;
    const bIndex = new Map<string, number[]>();
    for (let j = bStart; j < bEnd; j += 1) {
      const ch = b[j];
      const list = bIndex.get(ch) ?? [];
      list.push(j);
      bIndex.set(ch, list);
    }
    let j2len = new Map<number, number>();
    for (let i = aStart; i < aEnd; i += 1) {
      const newJ2len = new Map<number, number>();
      for (const j of bIndex.get(a[i]) ?? []) {
        if (j < bStart) {
          continue;
        }
        if (j >= bEnd) {
          break;
        }
        const size = (j2len.get(j - 1) ?? 0) + 1;
        newJ2len.set(j, size);
        if (size > bestSize) {
          bestI = i - size + 1;
          bestJ = j - size + 1;
          bestSize = size;
        }
      }
      j2len = newJ2len;
    }
    return {i: bestI, j: bestJ, size: bestSize};
  };

  const countMatches = (a: string, aStart: number, aEnd: number, b: string, bStart: number, bEnd: number): number => {
    const match = longestMatch(a, aStart, aEnd, b, bStart, bEnd);
    if (match.size === 0) {
      return 0;
    }
    let total = match.size;
    if (aStart < match.i && bStart < match.j) {
      total += countMatches(a, aStart, match.i, b, bStart, match.j);
    }
    const aNext = match.i + match.size;
    const bNext = match.j + match.size;
    if (aNext < aEnd && bNext < bEnd) {
      total += countMatches(a, aNext, aEnd, b, bNext, bEnd);
    }
    return total;
  };

  const matches = countMatches(left, 0, left.length, right, 0, right.length);
  return (2 * matches) / (left.length + right.length);
};

export const scoreCandidate = (
  sourceTitle: string,
  candidate: TmdbTvCandidate,
  yearHint: number | null,
): number => {
  const sourceNorm = normalizeTitle(sourceTitle);
  const names = [candidate.title, candidate.originalTitle ?? ""].filter(Boolean);
  let best = 0;
  for (const name of names) {
    const targetNorm = normalizeTitle(name);
    if (sourceNorm === targetNorm) {
      return 1;
    }
    best = Math.max(best, sequenceMatcherRatio(sourceNorm, targetNorm));
    if (sourceNorm.length >= 5 && (targetNorm.includes(sourceNorm) || sourceNorm.includes(targetNorm))) {
      best = Math.max(best, 0.92);
    }
  }

  const airDate = candidate.releaseDate ?? "";
  if (yearHint !== null && airDate.startsWith(String(yearHint))) {
    best = Math.min(1, best + 0.08);
  } else if (yearHint !== null && airDate && !airDate.startsWith(String(yearHint))) {
    best *= 0.85;
  }

  return Math.round(best * 10000) / 10000;
};

export const chooseMatch = (
  showName: string,
  candidates: TmdbTvCandidate[],
  searchQuery: string,
): MatchResult => {
  if (candidates.length === 0) {
    return {
      candidate: null,
      confidence: 0,
      method: "unresolved",
      searchQuery,
      candidateCount: 0,
      notes: "No TMDb search results",
    };
  }

  const {year} = extractYearHint(showName);
  const scored = candidates
    .map((candidate) => ({
      score: scoreCandidate(showName, candidate, year),
      candidate,
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return (right.candidate.popularity ?? 0) - (left.candidate.popularity ?? 0);
    });

  const best = scored[0];
  const secondScore = scored[1]?.score ?? 0;
  let method: MatchMethod = "search";
  let notes = "";
  if (best.score >= 0.98) {
    method = "exact";
  } else if (best.score - secondScore < 0.04 && secondScore >= 0.75) {
    method = "ambiguous";
    notes = `Close runner-up: ${scored[1].candidate.title} (${secondScore.toFixed(2)})`;
  }

  return {
    candidate: best.candidate,
    confidence: best.score,
    method,
    searchQuery,
    candidateCount: candidates.length,
    notes,
  };
};

export const isAcceptedMatch = (match: MatchResult, minConfidence = MIN_CONFIDENCE): boolean =>
  Boolean(match.candidate) &&
  match.confidence >= minConfidence &&
  match.method !== "ambiguous" &&
  match.method !== "unresolved";

export const parseResolveShowsInput = (body: unknown): ResolveShowInput[] => {
  if (typeof body !== "object" || body === null || !Array.isArray((body as {shows?: unknown}).shows)) {
    throw new Error("shows must be an array.");
  }

  const shows = (body as {shows: unknown[]}).shows;
  if (shows.length === 0 || shows.length > MAX_RESOLVE_SHOWS) {
    throw new Error(`shows must contain 1–${MAX_RESOLVE_SHOWS} entries.`);
  }

  return shows.map((row, index) => {
    if (typeof row !== "object" || row === null) {
      throw new Error(`shows[${index}] must be an object.`);
    }
    const sourceShowId = String((row as {sourceShowId?: unknown}).sourceShowId ?? "").trim();
    const title = String((row as {title?: unknown}).title ?? "").trim();
    if (!sourceShowId || !title) {
      throw new Error(`shows[${index}] requires sourceShowId and title.`);
    }
    return {sourceShowId, title};
  });
};
