import {HistoryEntry} from "../models/history";
import {MediaType} from "../models/media";
import {StatsGenreCount, StatsTitleCount, YearRecap} from "../models/stats";

export const DEFAULT_EPISODE_RUNTIME_MINUTES = 42;
export const DEFAULT_MOVIE_RUNTIME_MINUTES = 110;

export const utcDayKey = (isoDate: string | null | undefined) => {
  if (!isoDate) {
    return null;
  }

  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString().slice(0, 10);
};

export const utcMonthKey = (isoDate: string | null | undefined) => {
  const day = utcDayKey(isoDate);
  return day ? day.slice(0, 7) : null;
};

export const eventWeight = (entry: Pick<HistoryEntry, "rewatchCount">) =>
  1 + Math.max(0, entry.rewatchCount ?? 0);

export const estimateEntryWatchMinutes = (entry: HistoryEntry) => {
  if (typeof entry.runtimeMinutes === "number" && entry.runtimeMinutes > 0) {
    return entry.runtimeMinutes * eventWeight(entry);
  }

  const perEvent =
    entry.mediaType === "movie" ? DEFAULT_MOVIE_RUNTIME_MINUTES : DEFAULT_EPISODE_RUNTIME_MINUTES;
  return perEvent * eventWeight(entry);
};

export const formatWatchTime = (totalMinutes: number) => {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) {
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }

  return `${hours}h ${remainder}m`;
};

export const computeStreaks = (entries: HistoryEntry[], today = new Date()) => {
  const dayKeys = [
    ...new Set(entries.map((entry) => utcDayKey(entry.watchedAt)).filter((value): value is string => Boolean(value))),
  ].sort();

  if (dayKeys.length === 0) {
    return {longestStreakDays: 0, currentStreakDays: 0};
  }

  let longest = 1;
  let run = 1;
  for (let index = 1; index < dayKeys.length; index += 1) {
    const previous = Date.parse(`${dayKeys[index - 1]}T00:00:00.000Z`);
    const current = Date.parse(`${dayKeys[index]}T00:00:00.000Z`);
    const dayDelta = Math.round((current - previous) / (24 * 60 * 60 * 1000));
    run = dayDelta === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const todayKey = today.toISOString().slice(0, 10);
  const yesterday = new Date(Date.parse(`${todayKey}T00:00:00.000Z`) - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const latest = dayKeys[dayKeys.length - 1];

  if (latest !== todayKey && latest !== yesterday) {
    return {longestStreakDays: longest, currentStreakDays: 0};
  }

  let current = 1;
  for (let index = dayKeys.length - 1; index > 0; index -= 1) {
    const previous = Date.parse(`${dayKeys[index - 1]}T00:00:00.000Z`);
    const currentDay = Date.parse(`${dayKeys[index]}T00:00:00.000Z`);
    const dayDelta = Math.round((currentDay - previous) / (24 * 60 * 60 * 1000));
    if (dayDelta !== 1) {
      break;
    }
    current += 1;
  }

  return {longestStreakDays: longest, currentStreakDays: current};
};

export const rankTitles = (
  entries: HistoryEntry[],
  mediaType: MediaType,
  limit = 5,
): StatsTitleCount[] => {
  const counts = new Map<string, StatsTitleCount>();

  for (const entry of entries) {
    if (entry.mediaType !== mediaType) {
      continue;
    }

    const key = `${entry.mediaType}:${entry.tmdbId}`;
    const existing = counts.get(key);
    const weight = eventWeight(entry);
    if (existing) {
      existing.count += weight;
    } else {
      counts.set(key, {
        tmdbId: entry.tmdbId,
        mediaType: entry.mediaType,
        title: entry.title,
        count: weight,
      });
    }
  }

  return [...counts.values()].sort((left, right) => right.count - left.count || left.title.localeCompare(right.title)).slice(0, limit);
};

export const rankGenres = (entries: HistoryEntry[], limit = 5): StatsGenreCount[] => {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    const weight = eventWeight(entry);
    for (const genre of entry.genreNames ?? []) {
      const name = genre.trim();
      if (!name) {
        continue;
      }
      counts.set(name, (counts.get(name) ?? 0) + weight);
    }
  }

  return [...counts.entries()]
    .map(([name, count]) => ({name, count}))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, limit);
};

export const mostActiveMonth = (entries: HistoryEntry[], year?: number) => {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    const month = utcMonthKey(entry.watchedAt);
    if (!month) {
      continue;
    }
    if (year != null && !month.startsWith(`${year}-`)) {
      continue;
    }
    counts.set(month, (counts.get(month) ?? 0) + eventWeight(entry));
  }

  let winner: string | null = null;
  let max = 0;
  for (const [month, count] of counts) {
    if (count > max) {
      winner = month;
      max = count;
    }
  }

  return winner;
};

export const totalWatchTimeMinutes = (entries: HistoryEntry[]) =>
  entries.reduce((total, entry) => total + estimateEntryWatchMinutes(entry), 0);

export const filterHistoryByYear = (entries: HistoryEntry[], year: number) =>
  entries.filter((entry) => {
    const day = utcDayKey(entry.watchedAt);
    return Boolean(day && day.startsWith(`${year}-`));
  });

export const newlyDiscoveredTitles = (entries: HistoryEntry[], year: number, limit = 5): StatsTitleCount[] => {
  const firstSeen = new Map<string, {entry: HistoryEntry; firstDay: string}>();

  for (const entry of entries) {
    const day = utcDayKey(entry.watchedAt);
    if (!day) {
      continue;
    }
    const key = `${entry.mediaType}:${entry.tmdbId}`;
    const existing = firstSeen.get(key);
    if (!existing || day < existing.firstDay) {
      firstSeen.set(key, {entry, firstDay: day});
    }
  }

  return [...firstSeen.values()]
    .filter(({firstDay}) => firstDay.startsWith(`${year}-`))
    .map(({entry}) => ({
      tmdbId: entry.tmdbId,
      mediaType: entry.mediaType,
      title: entry.title,
      count: eventWeight(entry),
    }))
    .sort((left, right) => right.count - left.count || left.title.localeCompare(right.title))
    .slice(0, limit);
};

export const buildYearRecap = (entries: HistoryEntry[], year: number): YearRecap => {
  const yearEntries = filterHistoryByYear(entries, year);
  const topShows = rankTitles(yearEntries, "tv", 1);
  const topMovies = rankTitles(yearEntries, "movie", 1);
  const topGenres = rankGenres(yearEntries, 1);
  const streaks = computeStreaks(yearEntries, new Date(`${year}-12-31T23:59:59.000Z`));

  return {
    year,
    totalWatchedMovies: yearEntries.filter((entry) => entry.mediaType === "movie").length,
    totalWatchedEpisodes: yearEntries.filter((entry) => entry.mediaType === "tv").length,
    totalWatchTimeMinutes: totalWatchTimeMinutes(yearEntries),
    longestStreakDays: streaks.longestStreakDays,
    mostActiveMonth: mostActiveMonth(yearEntries, year),
    topShow: topShows[0] ?? null,
    topMovie: topMovies[0] ?? null,
    topGenre: topGenres[0] ?? null,
    newlyDiscovered: newlyDiscoveredTitles(entries, year),
  };
};
