import {useEffect, useState} from "react";
import {Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams} from "react-router-dom";
import {useAuth} from "../auth/AuthContext";
import {useAppContext} from "../AppContext";
import {api} from "../api/client";
import {setAnalyticsUserId, trackEvent} from "../firebase";
import {LandingPage} from "../pages/LandingPage";
import {PrivacyPage} from "../pages/PrivacyPage";
import {ProfilePage} from "../pages/ProfilePage";
import {SettingsPage} from "../pages/SettingsPage";
import {SocialPage} from "../pages/SocialPage";
import {TimelinePage} from "../pages/TimelinePage";
import {WatchlistPage} from "../pages/WatchlistPage";
import {LikesPage} from "../pages/LikesPage";
import {HistoryEntry} from "../types/history";
import {AuthRoute, ContinueWatchingRoute} from "./AuthRoute";
import {MediaDetailRoute} from "./DetailRoute";
import {DiscoveryRoute} from "./DiscoveryRoute";
import {FranchiseDetailRoute, FranchiseListRoute} from "./FranchiseRoute";
import {ListRoute} from "./ListRoute";
import {isDetailPath, isLandingPath, navFromPath, paths, routePaths} from "./paths";
import {isUrlLocale, urlLocaleForLanguage} from "../types/settings";
import {localizePath, stripLocalePrefix} from "./locale";
import {useLocale} from "./LocaleContext";
import {DailyPuzzlePage} from "../pages/DailyPuzzlePage";
import {AdminPuzzleStudioPage} from "../pages/AdminPuzzleStudioPage";

const ScreenAnalytics = () => {
  const location = useLocation();

  useEffect(() => {
    if (isDetailPath(location.pathname)) {
      return;
    }

    const routePath = stripLocalePrefix(location.pathname);
    const screen = routePath.startsWith(routePaths.login)
      ? "auth"
      : routePath.startsWith(routePaths.signup)
        ? "auth"
        : routePath.startsWith(routePaths.privacy)
          ? "privacy"
          : isLandingPath(location.pathname)
            ? "landing"
            : navFromPath(location.pathname);

    trackEvent("screen_view", {
      firebase_screen: screen,
      firebase_screen_class: "App",
    });
  }, [location.pathname]);

  return null;
};

const RootRoute = () => {
  const {user} = useAuth();
  const {urlLocale} = useLocale();
  if (user) {
    return <Navigate replace to={paths.home(urlLocale)} />;
  }
  return <LandingPage />;
};

const LocaleBoundary = () => {
  const {locale} = useParams();
  if (!isUrlLocale(locale)) {
    return <LegacyEntryRoute />;
  }
  return <Outlet />;
};

const LegacyEntryRoute = () => {
  const location = useLocation();
  const {preferredLanguage, settingsInitialized} = useAppContext();
  if (!settingsInitialized) {
    return <div className="state-panel">Loading settings...</div>;
  }
  const target = `${localizePath(location.pathname, urlLocaleForLanguage(preferredLanguage))}${location.search}${location.hash}`;
  return <Navigate replace to={target} />;
};

const LocalizedRedirect = ({to}: {to: (locale: "en-us" | "zh-tw") => string}) => {
  const {urlLocale} = useLocale();
  return <Navigate replace to={to(urlLocale)} />;
};

const LikesRoute = () => {
  const {user} = useAuth();
  const {
    likedError,
    likedItems,
    likedLoading,
    likedTotalCount,
    openMediaDetail,
    reloadLikes,
    removeLikedItem,
  } = useAppContext();

  return (
    <LikesPage
      error={likedError}
      items={likedItems}
      loading={likedLoading}
      signedIn={Boolean(user)}
      totalCount={likedTotalCount}
      onRemove={removeLikedItem}
      onRetry={reloadLikes}
      onSelect={(item) => openMediaDetail(item, "likes")}
    />
  );
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
    if (window.location.hash !== "#continue-watching") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById("continue-watching")?.scrollIntoView({behavior: "smooth", block: "start"});
    });
    return () => window.cancelAnimationFrame(frame);
  }, [progressItems, watchlistItems]);

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
      onNextEpisodeWatched={(entry) => {
        void markContinuationEpisodeWatched(entry);
      }}
      onRemove={removeWatchlistItem}
      onRetry={reloadWatchlist}
      onSelect={(item) => openMediaDetail(item, "watchlist")}
      onSelectContinuation={(entry) => openContinuationDetail(entry, "watchlist")}
      onSelectLibrary={(entry) => {
        if (entry.watchlistItem) {
          openMediaDetail(entry.watchlistItem, "watchlist");
          return;
        }
        if (!entry.progress) {
          return;
        }
        openContinuationDetail(
          {
            key: entry.key,
            tmdbId: entry.tmdbId,
            title: entry.title,
            poster: entry.poster,
            watchlistItem: null,
            progress: entry.progress,
            bucket: "dormant",
          },
          "watchlist",
        );
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

const SocialRoute = () => {
  const {user} = useAuth();
  return <SocialPage signedIn={Boolean(user)} />;
};

const SettingsRoute = () => {
  const navigate = useNavigate();
  const {urlLocale} = useLocale();
  const {signOutUser, user} = useAuth();
  const {
    achievementsEnabled,
    allowFriendRequests,
    autoMarkPreviousEpisodesWatched,
    changeAchievementsEnabled,
    changeAllowFriendRequests,
    changeAutoMarkPreviousEpisodesWatched,
    changeHideSpoilersUntilWatched,
    changeLanguage,
    changePreferredProviderIds,
    changeShareActivityWithFriends,
    changeShowAchievementsOnProfile,
    changeWatchRegion,
    hideSpoilersUntilWatched,
    language,
    preferredProviderIds,
    settingsError,
    settingsLoading,
    shareActivityWithFriends,
    showAchievementsOnProfile,
    watchRegion,
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
      navigate(paths.landing(urlLocale));
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
      achievementsEnabled={achievementsEnabled}
      allowFriendRequests={allowFriendRequests}
      autoMarkPreviousEpisodesWatched={autoMarkPreviousEpisodesWatched}
      error={settingsError}
      hideSpoilersUntilWatched={hideSpoilersUntilWatched}
      language={language}
      loading={settingsLoading}
      preferredProviderIds={preferredProviderIds}
      shareActivityWithFriends={shareActivityWithFriends}
      showAchievementsOnProfile={showAchievementsOnProfile}
      signedIn={Boolean(user)}
      watchRegion={watchRegion}
      onAchievementsEnabledChange={changeAchievementsEnabled}
      onAllowFriendRequestsChange={changeAllowFriendRequests}
      onAutoMarkPreviousEpisodesWatchedChange={changeAutoMarkPreviousEpisodesWatched}
      onDeleteAccount={handleDeleteAccount}
      onHideSpoilersUntilWatchedChange={changeHideSpoilersUntilWatched}
      onLanguageChange={changeLanguage}
      onPreferredProviderIdsChange={changePreferredProviderIds}
      onShareActivityWithFriendsChange={changeShareActivityWithFriends}
      onShowAchievementsOnProfileChange={changeShowAchievementsOnProfile}
      onWatchRegionChange={changeWatchRegion}
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
      <Route element={<LegacyEntryRoute />} path="/" />
      <Route element={<LocaleBoundary />} path="/:locale">
        <Route element={<RootRoute />} index />
        <Route element={<LocalizedRedirect to={paths.landing} />} path="landing" />
        <Route element={<DiscoveryRoute view="trending" />} path="home" />
        <Route element={<DiscoveryRoute view="search" />} path="search" />
        <Route element={<MediaDetailRoute mediaType="movie" />} path="movie/:id" />
        <Route element={<MediaDetailRoute mediaType="tv" />} path="tv/:id" />
        <Route element={<MediaDetailRoute mediaType="tv" />} path="tv/:id/season/:seasonNumber" />
        <Route element={<WatchlistRoute />} path="watchlist" />
        <Route element={<LikesRoute />} path="likes" />
        <Route element={<ContinueWatchingRoute />} path="continue-watching" />
        <Route element={<TimelineRoute />} path="timeline" />
        <Route element={<FranchiseListRoute />} path="franchises" />
        <Route element={<FranchiseDetailRoute />} path="franchises/:slug" />
        <Route element={<ListRoute />} path="list/:listId" />
        <Route element={<LocalizedRedirect to={paths.dailyPuzzle} />} path="play" />
        <Route element={<DailyPuzzlePage />} path="play/daily-puzzle" />
        <Route element={<AdminPuzzleStudioPage />} path="admin/puzzles" />
        <Route element={<ProfileRoute />} path="profile" />
        <Route element={<SocialRoute />} path="social" />
        <Route element={<SettingsRoute />} path="settings" />
        <Route element={<PrivacyRoute />} path="privacy" />
        <Route element={<AuthRoute mode="signin" />} path="login" />
        <Route element={<AuthRoute mode="signup" />} path="signup" />
        <Route element={<LocalizedRedirect to={paths.landing} />} path="*" />
      </Route>
      <Route element={<LegacyEntryRoute />} path="*" />
    </Routes>
  </>
);
