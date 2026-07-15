import {useEffect, useState} from "react";
import {Navigate, Route, Routes, useLocation, useNavigate} from "react-router-dom";
import {useAuth} from "../auth/AuthContext";
import {useAppContext} from "../AppContext";
import {api} from "../api/client";
import {setAnalyticsUserId, trackEvent} from "../firebase";
import {PrivacyPage} from "../pages/PrivacyPage";
import {ProfilePage} from "../pages/ProfilePage";
import {SettingsPage} from "../pages/SettingsPage";
import {TimelinePage} from "../pages/TimelinePage";
import {WatchlistPage} from "../pages/WatchlistPage";
import {HistoryEntry} from "../types/history";
import {AuthRoute, ContinueWatchingRoute} from "./AuthRoute";
import {MediaDetailRoute} from "./DetailRoute";
import {DiscoveryRoute} from "./DiscoveryRoute";
import {isDetailPath, navFromPath, paths} from "./paths";

const ScreenAnalytics = () => {
  const location = useLocation();

  useEffect(() => {
    if (isDetailPath(location.pathname)) {
      return;
    }

    const screen = location.pathname.startsWith(paths.login)
      ? "auth"
      : location.pathname.startsWith(paths.signup)
        ? "auth"
        : location.pathname.startsWith(paths.privacy)
          ? "privacy"
          : navFromPath(location.pathname);

    trackEvent("screen_view", {
      firebase_screen: screen,
      firebase_screen_class: "App",
    });
  }, [location.pathname]);

  return null;
};

const WatchlistRoute = () => {
  const {user} = useAuth();
  const {
    markContinuationEpisodeWatched,
    openContinuationDetail,
    openMediaDetail,
    pendingShowIds,
    progressItems,
    removeWatchlistItem,
    updateWatchlistStatus,
    watchlistError,
    watchlistHasMore,
    watchlistItems,
    watchlistLoading,
    watchlistLoadingMore,
    watchlistTotalCount,
    loadMoreWatchlist,
    reloadWatchlist,
  } = useAppContext();

  useEffect(() => {
    if (window.location.hash === "#continue-watching") {
      document.getElementById("continue-watching")?.scrollIntoView({behavior: "smooth", block: "start"});
    }
  }, []);

  return (
    <WatchlistPage
      error={watchlistError}
      hasMore={watchlistHasMore}
      items={watchlistItems}
      loading={watchlistLoading}
      loadingMore={watchlistLoadingMore}
      pendingShowIds={pendingShowIds}
      progressItems={progressItems}
      signedIn={Boolean(user)}
      totalCount={watchlistTotalCount}
      onLoadMore={loadMoreWatchlist}
      onRemove={removeWatchlistItem}
      onRetry={reloadWatchlist}
      onSelect={(item) => openMediaDetail(item, "watchlist")}
      onSelectContinuation={(entry) => openContinuationDetail(entry, "watchlist")}
      onNextEpisodeWatched={(entry) => {
        void markContinuationEpisodeWatched(entry);
      }}
      onStatusChange={updateWatchlistStatus}
    />
  );
};

const TimelineRoute = () => {
  const {user} = useAuth();
  const {
    deleteHistoryEntry,
    historyError,
    historyHasMore,
    historyItems,
    historyLoading,
    historyLoadingMore,
    historyTotalCount,
    loadMoreHistory,
    openMediaDetail,
    reloadHistory,
    removeProgressItem,
    updateHistoryWatchedAt,
    upsertProgressItem,
  } = useAppContext();

  const openHistoryEntry = (entry: HistoryEntry) => {
    openMediaDetail(
      {
        mediaType: entry.mediaType,
        tmdbId: entry.tmdbId,
        itemId: entry.historyId,
        title: entry.title,
        poster: null,
        backdrop: null,
        status: entry.mediaType === "movie" ? "watched" : "watching",
        addedAt: entry.watchedAt,
        updatedAt: entry.updatedAt,
      },
      "timeline",
    );
  };

  return (
    <TimelinePage
      error={historyError}
      hasMore={historyHasMore}
      items={historyItems}
      loading={historyLoading}
      loadingMore={historyLoadingMore}
      signedIn={Boolean(user)}
      totalCount={historyTotalCount}
      onDeleteEntry={async (entry) => {
        await deleteHistoryEntry(entry.historyId);
        if (entry.mediaType === "tv") {
          try {
            const {progress} = await api.getProgress(entry.tmdbId);
            if (progress) {
              upsertProgressItem(progress);
            } else {
              removeProgressItem(entry.tmdbId);
            }
          } catch {
            removeProgressItem(entry.tmdbId);
          }
        }
      }}
      onLoadMore={loadMoreHistory}
      onRetry={reloadHistory}
      onSelectEntry={openHistoryEntry}
      onUpdateWatchedAt={async (entry, watchedAt) => {
        await updateHistoryWatchedAt(entry.historyId, watchedAt);
      }}
    />
  );
};

const ProfileRoute = () => {
  const {user} = useAuth();
  const {
    historyError,
    historyHasMore,
    historyItems,
    historyLoading,
    historyLoadingMore,
    historyTotalCount,
    loadMoreHistory,
    loadRecap,
    profile,
    recap,
    recapError,
    recapLoading,
    recapYear,
    reloadHistory,
    reloadStats,
    stats,
    statsError,
    statsLoading,
  } = useAppContext();

  return (
    <ProfilePage
      history={historyItems}
      historyError={historyError}
      historyHasMore={historyHasMore}
      historyLoading={historyLoading}
      historyLoadingMore={historyLoadingMore}
      historyTotalCount={historyTotalCount}
      profile={profile}
      recap={recap}
      recapError={recapError}
      recapLoading={recapLoading}
      signedIn={Boolean(user)}
      stats={stats}
      statsError={statsError}
      statsLoading={statsLoading}
      userEmail={user?.email ?? null}
      onLoadMoreHistory={loadMoreHistory}
      onRecapYearChange={(year) => {
        void loadRecap(year);
      }}
      onRetryHistory={reloadHistory}
      onRetryRecap={() => {
        void loadRecap(recapYear);
      }}
      onRetryStats={reloadStats}
    />
  );
};

const SettingsRoute = () => {
  const navigate = useNavigate();
  const {signOutUser, user} = useAuth();
  const {
    autoMarkPreviousEpisodesWatched,
    changeAutoMarkPreviousEpisodesWatched,
    changeLanguage,
    language,
    settingsError,
    settingsLoading,
  } = useAppContext();
  const [accountDeleting, setAccountDeleting] = useState(false);
  const [accountDeletionError, setAccountDeletionError] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    setAccountDeleting(true);
    setAccountDeletionError(null);

    try {
      await api.deleteAccount();
      setAnalyticsUserId(null);
      await signOutUser();
      navigate(paths.home);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete account.";
      setAccountDeletionError(message);
      throw err;
    } finally {
      setAccountDeleting(false);
    }
  };

  return (
    <SettingsPage
      accountDeletionError={accountDeletionError}
      accountDeleting={accountDeleting}
      autoMarkPreviousEpisodesWatched={autoMarkPreviousEpisodesWatched}
      error={settingsError}
      language={language}
      loading={settingsLoading}
      signedIn={Boolean(user)}
      onAutoMarkPreviousEpisodesWatchedChange={changeAutoMarkPreviousEpisodesWatched}
      onDeleteAccount={handleDeleteAccount}
      onLanguageChange={changeLanguage}
    />
  );
};

const PrivacyRoute = () => {
  const {language} = useAppContext();
  return <PrivacyPage language={language} />;
};

export const AppRoutes = () => (
  <>
    <ScreenAnalytics />
    <Routes>
      <Route element={<DiscoveryRoute view="trending" />} path={paths.home} />
      <Route element={<DiscoveryRoute view="search" />} path={paths.search} />
      <Route element={<MediaDetailRoute mediaType="movie" />} path="/movie/:id" />
      <Route element={<MediaDetailRoute mediaType="tv" />} path="/tv/:id" />
      <Route element={<MediaDetailRoute mediaType="tv" />} path="/tv/:id/season/:seasonNumber" />
      <Route element={<WatchlistRoute />} path={paths.watchlist} />
      <Route element={<ContinueWatchingRoute />} path={paths.continueWatching} />
      <Route element={<TimelineRoute />} path={paths.timeline} />
      <Route element={<ProfileRoute />} path={paths.profile} />
      <Route element={<SettingsRoute />} path={paths.settings} />
      <Route element={<PrivacyRoute />} path={paths.privacy} />
      <Route element={<AuthRoute mode="signin" />} path={paths.login} />
      <Route element={<AuthRoute mode="signup" />} path={paths.signup} />
      <Route element={<Navigate replace to={paths.home} />} path="*" />
    </Routes>
  </>
);
