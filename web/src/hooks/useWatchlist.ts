import {useCallback, useEffect, useState} from "react";
import type {User} from "firebase/auth";
import {api} from "../api/client";
import {trackEvent} from "../firebase";
import {maxPageSize} from "../types/pagination";
import {WatchlistItem, WatchlistStatus} from "../types/watchlist";
import {toErrorMessage} from "./errorMessage";

const loadAllWatchlist = async () => {
  let page = 1;
  const items: WatchlistItem[] = [];
  let hasMore = true;
  let totalCount = 0;

  while (hasMore) {
    const response = await api.listWatchlist({page, pageSize: maxPageSize});
    items.push(...response.items);
    totalCount = response.totalCount;
    hasMore = response.hasMore;
    page += 1;
  }

  return {items, totalCount};
};

export const useWatchlist = (user: User | null, onLibraryChange?: () => void) => {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const reset = useCallback(() => {
    setItems([]);
    setLoading(false);
    setLoadingMore(false);
    setError(null);
    setHasMore(false);
    setTotalCount(0);
  }, []);

  const reload = useCallback(async () => {
    if (!user) {
      reset();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await loadAllWatchlist();
      setItems(response.items);
      setTotalCount(response.totalCount);
      setHasMore(false);
    } catch (reason) {
      setError(toErrorMessage(reason, "Could not load watchlist."));
    } finally {
      setLoading(false);
    }
  }, [reset, user]);

  useEffect(() => {
    if (!user) {
      reset();
      return;
    }

    void reload();
  }, [reload, reset, user]);

  const loadMore = useCallback(() => {
    // Full list is loaded up front so continue-watching and poster backfill stay complete.
  }, []);

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
