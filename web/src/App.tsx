import {useState} from "react";
import {api} from "./api/client";
import {TopBar} from "./components/TopBar";
import {DetailPage} from "./pages/DetailPage";
import {DiscoveryPage} from "./pages/DiscoveryPage";
import {MediaDetail, MediaSummary} from "./types/media";

type View = "trending" | "search";

export const App = () => {
  const [view, setView] = useState<View>("trending");
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const selectItem = (item: MediaSummary) => {
    setDetailError(null);
    api.detail(item.mediaType, item.id)
      .then(setDetail)
      .catch((err: Error) => setDetailError(err.message));
  };

  if (detail) {
    return <DetailPage detail={detail} onBack={() => setDetail(null)} />;
  }

  return (
    <>
      <TopBar activeView={view} onViewChange={setView} />
      {detailError && <div className="floating-error">{detailError}</div>}
      <DiscoveryPage view={view} onSelect={selectItem} />
    </>
  );
};
