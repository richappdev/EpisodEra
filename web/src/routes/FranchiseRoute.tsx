import {useCallback, useEffect, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {api} from "../api/client";
import {useAuth} from "../auth/AuthContext";
import {FranchiseListPage} from "../pages/FranchiseListPage";
import {FranchiseDetailPage} from "../pages/FranchiseDetailPage";
import {FranchiseOrder, FranchiseProgress, FranchiseSummary} from "../types/franchise";
import {mediaPath} from "./paths";

export const FranchiseListRoute = () => {
  const [items, setItems] = useState<FranchiseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.listFranchises();
      setItems(response.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load franchises.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return <FranchiseListPage error={error} items={items} loading={loading} onRetry={() => void load()} />;
};

export const FranchiseDetailRoute = () => {
  const {slug = ""} = useParams();
  const {user} = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<FranchiseOrder>("release");
  const [progress, setProgress] = useState<FranchiseProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (user) {
        setProgress(await api.meFranchiseProgress(slug, order));
      } else {
        const catalog = await api.getFranchise(slug);
        setProgress({
          slug: catalog.slug,
          name: catalog.name,
          description: catalog.description,
          order,
          totalTitles: catalog.titles.length,
          watchedTitles: 0,
          inProgressTitles: 0,
          progressPercent: 0,
          phases: catalog.phases.map((phase) => {
            const phaseTitles = catalog.titles.filter((title) => title.phaseId === phase.id);
            return {
              id: phase.id,
              name: phase.name,
              totalTitles: phaseTitles.length,
              watchedTitles: 0,
              progressPercent: 0,
            };
          }),
          titles: [...catalog.titles]
            .sort((left, right) => {
              const leftOrder = order === "release" ? left.releaseOrder : left.chronologicalOrder;
              const rightOrder = order === "release" ? right.releaseOrder : right.chronologicalOrder;
              return leftOrder - rightOrder;
            })
            .map((title) => ({
              tmdbId: title.tmdbId,
              mediaType: title.mediaType,
              title: title.title,
              phaseId: title.phaseId,
              phaseName: catalog.phases.find((phase) => phase.id === title.phaseId)?.name ?? title.phaseId,
              releaseOrder: title.releaseOrder,
              chronologicalOrder: title.chronologicalOrder,
              runtimeMinutes: title.runtimeMinutes,
              status: "unwatched" as const,
              progressPercent: 0,
            })),
          recommendedNext: null,
        });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load franchise.");
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }, [order, slug, user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <FranchiseDetailPage
      error={error}
      loading={loading}
      order={order}
      progress={progress}
      signedIn={Boolean(user)}
      onOrderChange={setOrder}
      onRetry={() => void load()}
      onSelectTitle={(item) =>
        navigate(mediaPath({mediaType: item.mediaType, id: item.id}), {state: {nav: "franchises"}})
      }
    />
  );
};
