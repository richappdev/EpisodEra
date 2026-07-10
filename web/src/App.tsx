import {useEffect, useState} from "react";
import {api, setApiTokenProvider} from "./api/client";
import {useAuth} from "./auth/AuthContext";
import {TopBar} from "./components/TopBar";
import {AuthPage} from "./pages/AuthPage";
import {DetailPage} from "./pages/DetailPage";
import {DiscoveryPage} from "./pages/DiscoveryPage";
import {MediaDetail, MediaSummary} from "./types/media";

type View = "trending" | "search" | "auth";

export const App = () => {
  const {getIdToken, loading, signOutUser, user} = useAuth();
  const [view, setView] = useState<View>("trending");
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    setApiTokenProvider(getIdToken);
  }, [getIdToken]);

  const selectItem = (item: MediaSummary) => {
    setDetailError(null);
    api.detail(item.mediaType, item.id)
      .then(setDetail)
      .catch((err: Error) => setDetailError(err.message));
  };

  if (detail) {
    return <DetailPage detail={detail} onBack={() => setDetail(null)} />;
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
      ) : (
        <DiscoveryPage view={view} onSelect={selectItem} />
      )}
    </>
  );
};
