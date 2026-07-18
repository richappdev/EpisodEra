import {useCallback, useEffect, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {api} from "../api/client";
import {useAppContext} from "../AppContext";
import {ListPage} from "../pages/ListPage";
import {MediaSummary} from "../types/media";
import {mediaPath} from "./paths";

export const ListRoute = () => {
  const {listId = ""} = useParams();
  const navigate = useNavigate();
  const {language, preferredProviderIds, watchRegion} = useAppContext();
  const [title, setTitle] = useState("List");
  const [reason, setReason] = useState<string | null>(null);
  const [items, setItems] = useState<MediaSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!listId) {
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const response = await api.discoverList(listId, language, {
          page: nextPage,
          providers: preferredProviderIds,
          region: watchRegion,
          maxMinutes: listId === "quick-watch" ? 30 : undefined,
        });
        setTitle(response.title);
        setReason(response.reason);
        setPage(response.page);
        setTotalPages(response.totalPages);
        setItems((current) => (append ? [...current, ...response.results] : response.results));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not load this list.");
        if (!append) {
          setItems([]);
        }
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [language, listId, preferredProviderIds, watchRegion],
  );

  useEffect(() => {
    void load(1, false);
  }, [load]);

  return (
    <ListPage
      error={error}
      hasMore={page < totalPages}
      items={items}
      loading={loading}
      loadingMore={loadingMore}
      reason={reason}
      title={title}
      onLoadMore={() => void load(page + 1, true)}
      onRetry={() => void load(1, false)}
      onSelect={(item) => navigate(mediaPath(item), {state: {nav: "trending"}})}
    />
  );
};
