import {useCallback, useEffect, useState} from "react";
import type {User} from "firebase/auth";
import {api} from "../api/client";
import {trackEvent} from "../firebase";
import {PaginationParams} from "../types/pagination";
import {WatchlistItem, WatchlistStatus} from "../types/watchlist";
import {toErrorMessage} from "./errorMessage";

const defaultWatchlistPageSize = 25;

export const useWatchlist = (user: User | null, onLibraryChange?: () => void) => {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const reset = useCallback(() => {
    setItems([]);
    setLoading(false);
    setLoadingMore(false);
    setError(null);
    setPage(1);
    setHasMore(false);
    setTotalCount(0);
  }, []);

  const applyPage = useCallback((append: boolean, response: Awaited<ReturnType<typeof api.listWatchlist>>) => {
    setItems((current) => (append ? [...current, ...response.items] : response.items));
    setPage(response.page);
    setHasMore(response.hasMore);
    setTotalCount(response.totalCount);
  }, []);

  const loadPage = useCallback(
    async (nextPage: number, append: boolean, pagination?: PaginationParams) => {
      if (!user) {
        reset();
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const response = await api.listWatchlist({
          page: nextPage,
          pageSize: pagination?.pageSize ?? defaultWatchlistPageSize,
        });
        applyPage(append, response);
      } catch (reason) {
        setError(toErrorMessage(reason, "Could not load watchlist."));
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [applyPage, reset, user],
  );

  const reload = useCallback(() => loadPage(1, false), [loadPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore) {
      return;
    }

    void loadPage(page + 1, true);
  }, [hasMore, loadPage, loading, loadingMore, page]);

  useEffect(() => {
    if (!user) {
      reset();
      return;
    }

    void loadPage(1, false);
  }, [loadPage, reset, user]);

  const upsertWatchlistItem = useCallback((item: WatchlistItem) => {
    setItems((current) => {
      const existing = current.findIndex((candidate) => candidate.itemId === item.itemId);
      if (existing === -1) {
        return [item, ...current];
      }

      return current.map((candidate) => (candidate.itemId === item.itemId ? item : candidate));
    });
  }, []);

  const addToWatchlist = useCallback(
    (input: Parameters<typeof api.addWatchlistItem>[0]) => {
      setError(null);
      return api
        .addWatchlistItem(input)
        .then((item) => {
          trackEvent("add_to_wishlist", {
            content_type: input.mediaType,
            item_id: String(input.tmdbId),
          });
          upsertWatchlistItem(item);
          onLibraryChange?.();
          return item;
        })
        .catch((reason: unknown) => {
          const message = toErrorMessage(reason, "Could not add to watchlist.");
          setError(message);
          throw reason;
        });
    },
    [onLibraryChange, upsertWatchlistItem],
  );

  const updateWatchlistStatus = useCallback(
    (item: WatchlistItem, status: WatchlistStatus) => {
      if (item.status === status) {
        return Promise.resolve(item);
      }

      setError(null);
      return api
        .updateWatchlistStatus(item.itemId, status)
        .then((updatedItem) => {
          trackEvent("select_content", {
            content_type: "watchlist_status",
            item_id: status,
          });
          upsertWatchlistItem(updatedItem);
          onLibraryChange?.();
          return updatedItem;
        })
        .catch((reason: unknown) => {
          const message = toErrorMessage(reason, "Could not update watchlist status.");
          setError(message);
          throw reason;
        });
    },
    [onLibraryChange, upsertWatchlistItem],
  );

  const removeWatchlistItem = useCallback(
    (item: WatchlistItem) => {
      setError(null);
      return api
        .removeWatchlistItem(item.itemId)
        .then(() => {
          trackEvent("remove_from_wishlist", {
            content_type: item.mediaType,
            item_id: String(item.tmdbId),
          });
          setItems((current) => current.filter((candidate) => candidate.itemId !== item.itemId));
          setTotalCount((current) => Math.max(0, current - 1));
          onLibraryChange?.();
        })
        .catch((reason: unknown) => {
          const message = toErrorMessage(reason, "Could not remove watchlist item.");
          setError(message);
          throw reason;
        });
    },
    [onLibraryChange],
  );

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    totalCount,
    reload,
    loadMore,
    upsertWatchlistItem,
    addToWatchlist,
    updateWatchlistStatus,
    removeWatchlistItem,
    setError,
  };
};
