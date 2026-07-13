import {useCallback, useEffect, useState} from "react";
import type {User} from "firebase/auth";
import {api} from "../api/client";
import {trackEvent} from "../firebase";
import {SupportedLanguage, isSupportedLanguage} from "../types/settings";
import {toErrorMessage} from "./errorMessage";

const languageStorageKey = "episodera.language";
const autoMarkPreviousEpisodesWatchedStorageKey = "episodera.autoMarkPreviousEpisodesWatched";

const initialLanguage = (): SupportedLanguage => {
  const stored = window.localStorage.getItem(languageStorageKey);
  return isSupportedLanguage(stored) ? stored : "en-US";
};

const initialAutoMarkPreviousEpisodesWatched = () =>
  window.localStorage.getItem(autoMarkPreviousEpisodesWatchedStorageKey) === "true";

export const useSettings = (user: User | null) => {
  const [language, setLanguage] = useState<SupportedLanguage>(initialLanguage);
  const [autoMarkPreviousEpisodesWatched, setAutoMarkPreviousEpisodesWatched] = useState(
    initialAutoMarkPreviousEpisodesWatched,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem(languageStorageKey, language);
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem(autoMarkPreviousEpisodesWatchedStorageKey, String(autoMarkPreviousEpisodesWatched));
  }, [autoMarkPreviousEpisodesWatched]);

  const reset = useCallback(() => {
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
      const settings = await api.meSettings();
      setLanguage(settings.language);
      setAutoMarkPreviousEpisodesWatched(settings.autoMarkPreviousEpisodesWatched);
    } catch (reason) {
      setError(toErrorMessage(reason, "Could not load settings."));
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

  const persistSettings = useCallback(
    (patch: Partial<{language: SupportedLanguage; autoMarkPreviousEpisodesWatched: boolean}>) => {
      if (!user) {
        return Promise.resolve();
      }

      setLoading(true);
      setError(null);

      return api
        .updateMeSettings(patch)
        .then((settings) => {
          setLanguage(settings.language);
          setAutoMarkPreviousEpisodesWatched(settings.autoMarkPreviousEpisodesWatched);
        })
        .catch((reason: unknown) => {
          setError(toErrorMessage(reason, "Could not save settings."));
          throw reason;
        })
        .finally(() => setLoading(false));
    },
    [user],
  );

  const changeLanguage = useCallback(
    (nextLanguage: SupportedLanguage) => {
      setLanguage(nextLanguage);
      trackEvent("select_content", {
        content_type: "language",
        item_id: nextLanguage,
      });
      setError(null);

      if (!user) {
        return;
      }

      void persistSettings({language: nextLanguage});
    },
    [persistSettings, user],
  );

  const changeAutoMarkPreviousEpisodesWatched = useCallback(
    (enabled: boolean) => {
      setAutoMarkPreviousEpisodesWatched(enabled);
      trackEvent("select_content", {
        content_type: "auto_mark_previous_episodes_watched",
        item_id: String(enabled),
      });
      setError(null);

      if (!user) {
        return;
      }

      void persistSettings({autoMarkPreviousEpisodesWatched: enabled});
    },
    [persistSettings, user],
  );

  return {
    language,
    autoMarkPreviousEpisodesWatched,
    loading,
    error,
    reload,
    changeLanguage,
    changeAutoMarkPreviousEpisodesWatched,
  };
};
