import {useCallback, useEffect, useState} from "react";
import type {User} from "firebase/auth";
import {api} from "../api/client";
import {optimisticMarkNextEpisode} from "../lib/continuation";
import {maxPageSize} from "../types/pagination";
import {ShowProgressSummary} from "../types/progress";
import {toErrorMessage} from "./errorMessage";

const loadAllProgress = async () => {
  const items: ShowProgressSummary[] = [];
  let pageToken: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await api.listProgress({pageSize: maxPageSize, pageToken});
    items.push(...response.items);
    pageToken = response.nextPageToken ?? undefined;
    hasMore = Boolean(response.nextPageToken);
  }

  return items;
};

export const useProgress = (user: User | null, onLibraryChange?: () => void) => {
  const [items, setItems] = useState<ShowProgressSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingShowIds, setPendingShowIds] = useState<Set<number>>(() => new Set());

  const reset = useCallback(() => {
    setItems([]);
    setLoading(false);
    setError(null);
    setPendingShowIds(new Set());
  }, []);

  const reload = useCallback(async () => {
    if (!user) {
      reset();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setItems(await loadAllProgress());
    } catch (reason) {
      setError(toErrorMessage(reason, "Could not load progress."));
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

  const upsertProgressItem = useCallback((item: ShowProgressSummary | null) => {
    if (!item) {
      return;
    }

    setItems((current) => {
      const existing = current.findIndex((candidate) => candidate.showId === item.showId);
      if (existing === -1) {
        return [item, ...current];
      }

      return current.map((candidate) => (candidate.showId === item.showId ? item : candidate));
    });
  }, []);

  const removeProgressItem = useCallback((showId: number) => {
    setItems((current) => current.filter((candidate) => candidate.tmdbId !== showId));
  }, []);

  const setShowPending = useCallback((tmdbId: number, pending: boolean) => {
    setPendingShowIds((current) => {
      const next = new Set(current);
      if (pending) {
        next.add(tmdbId);
      } else {
        next.delete(tmdbId);
      }
      return next;
    });
  }, []);

  const markNextEpisodeWatched = useCallback(
    async (tmdbId: number, nextEpisode: NonNullable<ShowProgressSummary["nextEpisode"]>) => {
      setError(null);

      if (pendingShowIds.has(tmdbId)) {
        return items.find((item) => item.tmdbId === tmdbId) ?? null;
      }

      const previous = items.find((item) => item.tmdbId === tmdbId) ?? null;
      if (previous?.nextEpisode) {
        upsertProgressItem(optimisticMarkNextEpisode(previous));
      }

      setShowPending(tmdbId, true);

      try {
        const updatedProgress = await api.updateEpisodes(tmdbId, {
          watched: true,
          episodes: [
            {
              seasonNumber: nextEpisode.seasonNumber,
              episodeNumber: nextEpisode.episodeNumber,
            },
          ],
        });

        upsertProgressItem(updatedProgress);
        onLibraryChange?.();
        return updatedProgress;
      } catch (reason) {
        if (previous) {
          upsertProgressItem(previous);
        }
        const message = toErrorMessage(reason, "Could not mark next episode watched.");
        setError(message);
        throw reason;
      } finally {
        setShowPending(tmdbId, false);
      }
    },
    [items, onLibraryChange, pendingShowIds, setShowPending, upsertProgressItem],
  );

  return {
    items,
    loading,
    error,
    pendingShowIds,
    reload,
    upsertProgressItem,
    removeProgressItem,
    markNextEpisodeWatched,
    setError,
  };
};
