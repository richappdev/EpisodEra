import {useCallback, useEffect, useState} from "react";
import type {User} from "firebase/auth";
import {api} from "../api/client";
import {trackEvent} from "../firebase";
import {maxPageSize} from "../types/pagination";
import {AddLikedItemInput, LikedItem} from "../types/likes";
import {toErrorMessage} from "./errorMessage";

const loadAllLikes = async () => {
  const items: LikedItem[] = [];
  let pageToken: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await api.listLikedItems({pageSize: maxPageSize, pageToken});
    items.push(...response.items);
    pageToken = response.nextPageToken ?? undefined;
    hasMore = Boolean(response.nextPageToken);
  }

  return {items, totalCount: items.length};
};

export const useLikes = (user: User | null, onLibraryChange?: () => void) => {
  const [items, setItems] = useState<LikedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const reset = useCallback(() => {
    setItems([]);
    setLoading(false);
    setError(null);
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
      const response = await loadAllLikes();
      setItems(response.items);
      setTotalCount(response.totalCount);
    } catch (reason) {
      setError(toErrorMessage(reason, "Could not load likes."));
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

  const upsertLikedItem = useCallback((item: LikedItem) => {
    setItems((current) => {
      const existing = current.findIndex((candidate) => candidate.itemId === item.itemId);
      if (existing === -1) {
        return [item, ...current];
      }

      return current.map((candidate) => (candidate.itemId === item.itemId ? item : candidate));
    });
  }, []);

  const addLikedItem = useCallback(
    (input: AddLikedItemInput) => {
      setError(null);
      return api
        .addLikedItem(input)
        .then((item) => {
          trackEvent("like_content", {
            content_type: input.mediaType,
            item_id: String(input.tmdbId),
          });
          upsertLikedItem(item);
          onLibraryChange?.();
          return item;
        })
        .catch((reason: unknown) => {
          const message = toErrorMessage(reason, "Could not like title.");
          setError(message);
          throw reason;
        });
    },
    [onLibraryChange, upsertLikedItem],
  );

  const removeLikedItem = useCallback(
    (item: LikedItem) => {
      setError(null);
      return api
        .removeLikedItem(item.itemId)
        .then(() => {
          trackEvent("unlike_content", {
            content_type: item.mediaType,
            item_id: String(item.tmdbId),
          });
          setItems((current) => current.filter((candidate) => candidate.itemId !== item.itemId));
          setTotalCount((current) => Math.max(0, current - 1));
          onLibraryChange?.();
        })
        .catch((reason: unknown) => {
          const message = toErrorMessage(reason, "Could not unlike title.");
          setError(message);
          throw reason;
        });
    },
    [onLibraryChange],
  );

  return {
    items,
    loading,
    error,
    totalCount,
    reload,
    upsertLikedItem,
    addLikedItem,
    removeLikedItem,
    setError,
  };
};
