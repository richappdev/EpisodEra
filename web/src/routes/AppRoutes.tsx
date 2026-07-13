import {useEffect, useState} from "react";
import {Navigate, Route, Routes, useLocation, useNavigate} from "react-router-dom";
import {useAuth} from "../auth/AuthContext";
import {useAppContext} from "../AppContext";
import {api} from "../api/client";
import {setAnalyticsUserId, trackEvent} from "../firebase";
import {PrivacyPage} from "../pages/PrivacyPage";
import {ProfilePage} from "../pages/ProfilePage";
import {SettingsPage} from "../pages/SettingsPage";
import {WatchlistPage} from "../pages/WatchlistPage";
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
    markNextWatchlistEpisodeWatched,
    openMediaDetail,
    progressItems,
    removeWatchlistItem,
    updateWatchlistStatus,
    watchlistError,
    watchlistItems,
    watchlistLoading,
  } = useAppContext();

  useEffect(() => {
    if (window.location.hash === "#continue-watching") {
      document.getElementById("continue-watching")?.scrollIntoView({behavior: "smooth", block: "start"});
    }
  }, []);

  return (
    <WatchlistPage
      error={watchlistError}
      items={watchlistItems}
      loading={watchlistLoading}
      progressItems={progressItems}
      signedIn={Boolean(user)}
      onNextEpisodeWatched={markNextWatchlistEpisodeWatched}
      onRemove={removeWatchlistItem}
      onSelect={(item) => openMediaDetail(item, "watchlist")}
      onStatusChange={updateWatchlistStatus}
    />
  );
};

const ProfileRoute = () => {
  const {user} = useAuth();
  const {historyItems, profile, stats, statsError, statsLoading} = useAppContext();

  return (
    <ProfilePage
      error={statsError}
      history={historyItems}
      loading={statsLoading}
      profile={profile}
      signedIn={Boolean(user)}
      stats={stats}
      userEmail={user?.email ?? null}
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
      <Route element={<ProfileRoute />} path={paths.profile} />
      <Route element={<SettingsRoute />} path={paths.settings} />
      <Route element={<PrivacyRoute />} path={paths.privacy} />
      <Route element={<AuthRoute mode="signin" />} path={paths.login} />
      <Route element={<AuthRoute mode="signup" />} path={paths.signup} />
      <Route element={<Navigate replace to={paths.home} />} path="*" />
    </Routes>
  </>
);
