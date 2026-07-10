import {useEffect, useState} from "react";
import {api, setApiTokenProvider} from "./api/client";
import {useAuth} from "./auth/AuthContext";
import {TopBar} from "./components/TopBar";
import {AuthPage} from "./pages/AuthPage";
import {DetailPage} from "./pages/DetailPage";
import {DiscoveryPage} from "./pages/DiscoveryPage";
import {WatchlistPage} from "./pages/WatchlistPage";
import {MediaDetail, MediaSummary} from "./types/media";
import {WatchlistItem, WatchlistStatus} from "./types/watchlist";

type View = "trending" | "search" | "watchlist" | "auth";

export const App = () => {
  const {getIdToken, loading, signOutUser, user} = useAuth();
  const [view, setView] = useState<View>("trending");
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  useEffect(() => {
    setApiTokenProvider(getIdToken);
  }, [getIdToken]);

  useEffect(() => {
    if (!user) {
      setWatchlistItems([]);
      setWatchlistError(null);
      setWatchlistLoading(false);
      return;
    }

    setWatchlistLoading(true);
    setWatchlistError(null);
    api.listWatchlist()
      .then(({items}) => setWatchlistItems(items))
      .catch((err: Error) => setWatchlistError(err.message))
      .finally(() => setWatchlistLoading(false));
  }, [user]);

  const upsertWatchlistItem = (item: WatchlistItem) => {
    setWatchlistItems((current) => {
      const existing = current.findIndex((candidate) => candidate.itemId === item.itemId);
      if (existing === -1) {
        return [item, ...current];
      }

      return current.map((candidate) => (candidate.itemId === item.itemId ? item : candidate));
    });
  };

  const selectItem = (item: MediaSummary) => {
    setDetailError(null);
    api.detail(item.mediaType, item.id)
      .then(setDetail)
      .catch((err: Error) => setDetailError(err.message));
  };

  const addToWatchlist = (selectedDetail: MediaDetail) => {
    setWatchlistError(null);
    api.addWatchlistItem({
      tmdbId: selectedDetail.id,
      mediaType: selectedDetail.mediaType,
      title: selectedDetail.title,
      poster: selectedDetail.images.poster,
      backdrop: selectedDetail.images.backdrop,
    })
      .then(upsertWatchlistItem)
      .catch((err: Error) => setWatchlistError(err.message));
  };

  const updateWatchlistStatus = (item: WatchlistItem, status: WatchlistStatus) => {
    if (item.status === status) {
      return;
    }

    setWatchlistError(null);
    api.updateWatchlistStatus(item.itemId, status)
      .then(upsertWatchlistItem)
      .catch((err: Error) => setWatchlistError(err.message));
  };

  const removeWatchlistItem = (item: WatchlistItem) => {
    setWatchlistError(null);
    api.removeWatchlistItem(item.itemId)
      .then(() => {
        setWatchlistItems((current) => current.filter((candidate) => candidate.itemId !== item.itemId));
      })
      .catch((err: Error) => setWatchlistError(err.message));
  };

  const selectWatchlistItem = (item: WatchlistItem) => {
    selectItem({
      id: item.tmdbId,
      mediaType: item.mediaType,
      title: item.title,
      overview: "",
      releaseDate: null,
      voteAverage: 0,
      popularity: 0,
      images: {poster: item.poster, backdrop: item.backdrop},
    });
  };

  const currentWatchlistItem = detail
    ? watchlistItems.find((item) => item.mediaType === detail.mediaType && item.tmdbId === detail.id) ?? null
    : null;

  if (detail) {
    return (
      <>
        {watchlistError && <div className="floating-error">{watchlistError}</div>}
        <DetailPage
          detail={detail}
          onAddToWatchlist={addToWatchlist}
          onBack={() => setDetail(null)}
          onRemoveFromWatchlist={removeWatchlistItem}
          onWatchlistStatusChange={updateWatchlistStatus}
          signedIn={Boolean(user)}
          watchlistItem={currentWatchlistItem}
        />
      </>
    );
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="state-panel">Loading account...</div>
      </main>
    );
  }

  return (
    <>
      <TopBar
        activeView={view === "auth" ? "trending" : view}
        user={user}
        onAuthOpen={() => setView("auth")}
        onSignOut={() => {
          void signOutUser();
          setView("trending");
        }}
        onViewChange={setView}
      />
      {detailError && <div className="floating-error">{detailError}</div>}
      {view === "auth" ? (
        <AuthPage onDone={() => setView("trending")} />
      ) : view === "watchlist" ? (
        <WatchlistPage
          error={watchlistError}
          items={watchlistItems}
          loading={watchlistLoading}
          signedIn={Boolean(user)}
          onRemove={removeWatchlistItem}
          onSelect={selectWatchlistItem}
          onStatusChange={updateWatchlistStatus}
        />
      ) : (
        <DiscoveryPage view={view} onSelect={selectItem} />
      )}
    </>
  );
};
