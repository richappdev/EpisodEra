import {useCallback, useEffect, useState} from "react";
import type {User} from "firebase/auth";
import {api} from "../api/client";
import {maxPageSize} from "../types/pagination";
import {ShowProgressSummary} from "../types/progress";
import {toErrorMessage} from "./errorMessage";

const loadAllProgress = async () => {
  let page = 1;
  const items: ShowProgressSummary[] = [];
  let hasMore = true;

  while (hasMore) {
    const response = await api.listProgress({page, pageSize: maxPageSize});
    items.push(...response.items);
    hasMore = response.hasMore;
    page += 1;
  }

  return items;
};

export const useProgress = (user: User | null, onLibraryChange?: () => void) => {
  const [items, setItems] = useState<ShowProgressSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setItems([]);
    setLoading(false);
    setError(null);
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

  const markNextEpisodeWatched = useCallback(
    async (tmdbId: number, nextEpisode: NonNullable<ShowProgressSummary["nextEpisode"]>) => {
      setError(null);

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
        const message = toErrorMessage(reason, "Could not mark next episode watched.");
        setError(message);
        throw reason;
      }
    },
    [onLibraryChange, upsertProgressItem],
  );

  return {
    items,
    loading,
    error,
    reload,
    upsertProgressItem,
    removeProgressItem,
    markNextEpisodeWatched,
    setError,
  };
};
