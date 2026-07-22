import {useCallback, useEffect, useState} from "react";
import type {User} from "firebase/auth";
import {api} from "../api/client";
import {HistoryEntry} from "../types/history";
import {UserStats, YearRecap} from "../types/stats";
import {toErrorMessage} from "./errorMessage";

const defaultHistoryPageSize = 25;

export const useProfileStats = (user: User | null) => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [recap, setRecap] = useState<YearRecap | null>(null);
  const [recapYear, setRecapYear] = useState(() => new Date().getUTCFullYear());
  const [recapLoading, setRecapLoading] = useState(false);
  const [recapError, setRecapError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyNextPageToken, setHistoryNextPageToken] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);

  const reset = useCallback(() => {
    setStats(null);
    setStatsLoading(false);
    setStatsError(null);
    setRecap(null);
    setRecapLoading(false);
    setRecapError(null);
    setHistoryItems([]);
    setHistoryLoading(false);
    setHistoryLoadingMore(false);
    setHistoryError(null);
    setHistoryNextPageToken(null);
    setHistoryHasMore(false);
    setHistoryTotalCount(0);
  }, []);

  const reloadStats = useCallback(async () => {
    if (!user) {
      return;
    }

    setStatsLoading(true);
    setStatsError(null);

    try {
      setStats(await api.meStats());
    } catch (reason) {
      setStatsError(toErrorMessage(reason, "Could not load profile stats."));
    } finally {
      setStatsLoading(false);
    }
  }, [user]);

  const loadRecap = useCallback(
    async (year: number) => {
      if (!user) {
        return;
      }

      setRecapYear(year);
      setRecapLoading(true);
      setRecapError(null);

      try {
        setRecap(await api.meRecap(year));
      } catch (reason) {
        setRecapError(toErrorMessage(reason, "Could not load year recap."));
      } finally {
        setRecapLoading(false);
      }
    },
    [user],
  );

  const loadHistoryPage = useCallback(
    async (pageToken: string | undefined, append: boolean) => {
      if (!user) {
        return;
      }

      if (append) {
        setHistoryLoadingMore(true);
      } else {
        setHistoryLoading(true);
        setHistoryError(null);
      }

      try {
        const response = await api.meHistory({pageSize: defaultHistoryPageSize, pageToken});
        setHistoryItems((current) => {
          const next = append ? [...current, ...response.items] : response.items;
          setHistoryTotalCount(next.length);
          return next;
        });
        setHistoryNextPageToken(response.nextPageToken);
        setHistoryHasMore(response.hasMore);
      } catch (reason) {
        setHistoryError(toErrorMessage(reason, "Could not load history."));
      } finally {
        if (append) {
          setHistoryLoadingMore(false);
        } else {
          setHistoryLoading(false);
        }
      }
    },
    [user],
  );

  const reloadHistory = useCallback(() => loadHistoryPage(undefined, false), [loadHistoryPage]);

  const loadMoreHistory = useCallback(() => {
    if (!historyHasMore || !historyNextPageToken || historyLoading || historyLoadingMore) {
      return;
    }

    void loadHistoryPage(historyNextPageToken, true);
  }, [historyHasMore, historyLoading, historyLoadingMore, historyNextPageToken, loadHistoryPage]);

  const refresh = useCallback(async () => {
    if (!user) {
      reset();
      return;
    }

    await Promise.allSettled([reloadStats(), reloadHistory(), loadRecap(recapYear)]);
  }, [loadRecap, recapYear, reloadHistory, reloadStats, reset, user]);

  useEffect(() => {
    if (!user) {
      reset();
      return;
    }

    void refresh();
  }, [refresh, reset, user]);

  const upsertHistoryItem = useCallback((item: HistoryEntry) => {
    setHistoryItems((current) => {
      const existing = current.findIndex((candidate) => candidate.historyId === item.historyId);
      if (existing === -1) {
        return [item, ...current].sort((left, right) => {
          const leftTime = Date.parse(left.watchedAt ?? "") || 0;
          const rightTime = Date.parse(right.watchedAt ?? "") || 0;
          return rightTime - leftTime;
        });
      }

      return current
        .map((candidate) => (candidate.historyId === item.historyId ? item : candidate))
        .sort((left, right) => {
          const leftTime = Date.parse(left.watchedAt ?? "") || 0;
          const rightTime = Date.parse(right.watchedAt ?? "") || 0;
          return rightTime - leftTime;
        });
    });
  }, []);

  const removeHistoryItem = useCallback((historyId: string) => {
    setHistoryItems((current) => current.filter((candidate) => candidate.historyId !== historyId));
    setHistoryTotalCount((current) => Math.max(0, current - 1));
  }, []);

  const updateHistoryWatchedAt = useCallback(
    async (historyId: string, watchedAt: string) => {
      setHistoryError(null);
      try {
        const updated = await api.updateHistoryEntry(historyId, {watchedAt});
        upsertHistoryItem(updated);
        return updated;
      } catch (reason) {
        const message = toErrorMessage(reason, "Could not update history.");
        setHistoryError(message);
        throw reason;
      }
    },
    [upsertHistoryItem],
  );

  const deleteHistoryEntry = useCallback(
    async (historyId: string) => {
      setHistoryError(null);
      try {
        await api.deleteHistoryEntry(historyId);
        removeHistoryItem(historyId);
        await Promise.allSettled([reloadStats(), loadRecap(recapYear)]);
      } catch (reason) {
        const message = toErrorMessage(reason, "Could not remove history entry.");
        setHistoryError(message);
        throw reason;
      }
    },
    [loadRecap, recapYear, removeHistoryItem, reloadStats],
  );

  return {
    stats,
    statsLoading,
    statsError,
    recap,
    recapYear,
    recapLoading,
    recapError,
    historyItems,
    historyLoading,
    historyLoadingMore,
    historyError,
    historyHasMore,
    historyTotalCount,
    reloadStats,
    reloadHistory,
    loadMoreHistory,
    loadRecap,
    refresh,
    upsertHistoryItem,
    removeHistoryItem,
    updateHistoryWatchedAt,
    deleteHistoryEntry,
  };
};
