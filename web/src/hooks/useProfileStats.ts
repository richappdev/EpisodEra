import {useCallback, useEffect, useState} from "react";
import type {User} from "firebase/auth";
import {api} from "../api/client";
import {HistoryEntry} from "../types/history";
import {UserStats} from "../types/stats";
import {toErrorMessage} from "./errorMessage";

const defaultHistoryPageSize = 25;

export const useProfileStats = (user: User | null) => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);

  const reset = useCallback(() => {
    setStats(null);
    setStatsLoading(false);
    setStatsError(null);
    setHistoryItems([]);
    setHistoryLoading(false);
    setHistoryLoadingMore(false);
    setHistoryError(null);
    setHistoryPage(1);
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

  const loadHistoryPage = useCallback(
    async (nextPage: number, append: boolean) => {
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
        const response = await api.meHistory({page: nextPage, pageSize: defaultHistoryPageSize});
        setHistoryItems((current) => (append ? [...current, ...response.items] : response.items));
        setHistoryPage(response.page);
        setHistoryHasMore(response.hasMore);
        setHistoryTotalCount(response.totalCount);
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

  const reloadHistory = useCallback(() => loadHistoryPage(1, false), [loadHistoryPage]);

  const loadMoreHistory = useCallback(() => {
    if (!historyHasMore || historyLoading || historyLoadingMore) {
      return;
    }

    void loadHistoryPage(historyPage + 1, true);
  }, [historyHasMore, historyLoading, historyLoadingMore, historyPage, loadHistoryPage]);

  const refresh = useCallback(async () => {
    if (!user) {
      reset();
      return;
    }

    await Promise.allSettled([reloadStats(), reloadHistory()]);
  }, [reloadHistory, reloadStats, reset, user]);

  useEffect(() => {
    if (!user) {
      reset();
      return;
    }

    void refresh();
  }, [refresh, reset, user]);

  return {
    stats,
    statsLoading,
    statsError,
    historyItems,
    historyLoading,
    historyLoadingMore,
    historyError,
    historyHasMore,
    historyTotalCount,
    reloadStats,
    reloadHistory,
    loadMoreHistory,
    refresh,
  };
};
