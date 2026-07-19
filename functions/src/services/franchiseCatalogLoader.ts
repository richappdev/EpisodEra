import {Timestamp, getFirestore} from "firebase-admin/firestore";
import {franchiseCatalogs, getFranchiseCatalog as getBundledFranchiseCatalog} from "../data/franchises";
import {FranchiseCatalog, FranchisePhase, FranchiseTitle} from "../models/franchise";
import {MediaType} from "../models/media";

export type FranchiseCatalogSource = "remote" | "cache" | "bundled";

export interface FranchiseCatalogLoadResult {
  catalogs: FranchiseCatalog[];
  source: FranchiseCatalogSource;
}

interface CacheState {
  catalogs: FranchiseCatalog[];
  expiresAt: number;
}

type PublishedFranchiseQuery = () => Promise<Array<{id: string; data: Record<string, unknown>}>>;

const CACHE_TTL_MS = 5 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isMediaType = (value: unknown): value is MediaType => value === "movie" || value === "tv";

const parsePhase = (value: unknown): FranchisePhase | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.id !== "string" || !value.id.trim()) {
    return null;
  }
  if (typeof value.name !== "string" || !value.name.trim()) {
    return null;
  }
  return {id: value.id.trim(), name: value.name.trim()};
};

const parseTitle = (value: unknown): FranchiseTitle | null => {
  if (!isRecord(value)) {
    return null;
  }
  const tmdbId = Number(value.tmdbId);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !isMediaType(value.mediaType)) {
    return null;
  }
  if (typeof value.title !== "string" || !value.title.trim()) {
    return null;
  }
  if (typeof value.phaseId !== "string" || !value.phaseId.trim()) {
    return null;
  }
  const releaseOrder = Number(value.releaseOrder);
  const chronologicalOrder = Number(value.chronologicalOrder);
  if (!Number.isFinite(releaseOrder) || !Number.isFinite(chronologicalOrder)) {
    return null;
  }
  const runtimeMinutes =
    value.runtimeMinutes == null
      ? null
      : Number.isInteger(Number(value.runtimeMinutes)) && Number(value.runtimeMinutes) > 0
        ? Number(value.runtimeMinutes)
        : null;
  const providerIds = Array.isArray(value.providerIds)
    ? value.providerIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
    : undefined;

  return {
    tmdbId,
    mediaType: value.mediaType,
    title: value.title.trim(),
    phaseId: value.phaseId.trim(),
    releaseOrder,
    chronologicalOrder,
    runtimeMinutes,
    ...(providerIds && providerIds.length > 0 ? {providerIds} : {}),
  };
};

const parseCatalogDocument = (
  slug: string,
  data: Record<string, unknown>,
): {catalog: FranchiseCatalog; sortOrder: number} | null => {
  if (data.published !== true) {
    return null;
  }
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const description = typeof data.description === "string" ? data.description.trim() : "";
  if (!name || !description) {
    return null;
  }
  if (!Array.isArray(data.phases) || !Array.isArray(data.titles)) {
    return null;
  }
  const phases = data.phases.map(parsePhase).filter((phase): phase is FranchisePhase => phase != null);
  const titles = data.titles.map(parseTitle).filter((title): title is FranchiseTitle => title != null);
  if (phases.length === 0 || titles.length === 0) {
    return null;
  }
  const sortOrder = Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : Number.MAX_SAFE_INTEGER;
  return {
    catalog: {
      slug: typeof data.slug === "string" && data.slug.trim() ? data.slug.trim() : slug,
      name,
      description,
      phases,
      titles,
    },
    sortOrder,
  };
};

const sortCatalogs = (
  entries: Array<{catalog: FranchiseCatalog; sortOrder: number}>,
): FranchiseCatalog[] =>
  [...entries]
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }
      return left.catalog.name.localeCompare(right.catalog.name);
    })
    .map((entry) => entry.catalog);

const defaultPublishedQuery: PublishedFranchiseQuery = async () => {
  const snapshot = await getFirestore().collection("franchises").where("published", "==", true).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as Record<string, unknown>,
  }));
};

class FranchiseCatalogLoader {
  private cache: CacheState | null = null;
  private queryPublished: PublishedFranchiseQuery = defaultPublishedQuery;

  /** Test helper: override Firestore query. Pass null to restore default. */
  setQueryForTests(query: PublishedFranchiseQuery | null): void {
    this.queryPublished = query ?? defaultPublishedQuery;
  }

  /** Test helper: clear in-memory cache between cases. */
  clearCache(): void {
    this.cache = null;
  }

  /** Test helper: inject a warm cache snapshot. */
  setCacheForTests(catalogs: FranchiseCatalog[], ttlMs = CACHE_TTL_MS): void {
    this.cache = {
      catalogs,
      expiresAt: Date.now() + ttlMs,
    };
  }

  async listPublished(): Promise<FranchiseCatalogLoadResult> {
    const fresh = this.readFreshCache();
    if (fresh) {
      return {catalogs: fresh, source: "cache"};
    }

    try {
      const catalogs = await this.fetchFromFirestore();
      this.cache = {
        catalogs,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      return {catalogs, source: "remote"};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.cache) {
        console.warn(`[franchises] Firestore read failed; serving stale cache. ${message}`);
        return {catalogs: this.cache.catalogs, source: "cache"};
      }
      console.warn(`[franchises] Firestore read failed; serving bundled catalogs. ${message}`);
      return {catalogs: franchiseCatalogs, source: "bundled"};
    }
  }

  async getBySlug(slug: string): Promise<{catalog: FranchiseCatalog; source: FranchiseCatalogSource} | null> {
    const {catalogs, source} = await this.listPublished();
    const catalog = catalogs.find((entry) => entry.slug === slug);
    if (catalog) {
      return {catalog, source};
    }
    if (source === "bundled") {
      const bundled = getBundledFranchiseCatalog(slug);
      return bundled ? {catalog: bundled, source: "bundled"} : null;
    }
    return null;
  }

  private readFreshCache(): FranchiseCatalog[] | null {
    if (!this.cache) {
      return null;
    }
    if (this.cache.expiresAt <= Date.now()) {
      return null;
    }
    return this.cache.catalogs;
  }

  private async fetchFromFirestore(): Promise<FranchiseCatalog[]> {
    const docs = await this.queryPublished();
    const parsed = docs
      .map((doc) => parseCatalogDocument(doc.id, doc.data))
      .filter((entry): entry is {catalog: FranchiseCatalog; sortOrder: number} => entry != null);
    return sortCatalogs(parsed);
  }
}

export const franchiseCatalogLoader = new FranchiseCatalogLoader();

/** Build a Firestore document payload from a bundled catalog (seed / upsert). */
export const franchiseDocumentFromCatalog = (
  catalog: FranchiseCatalog,
  sortOrder: number,
): Record<string, unknown> => ({
  slug: catalog.slug,
  name: catalog.name,
  description: catalog.description,
  phases: catalog.phases,
  titles: catalog.titles,
  published: true,
  sortOrder,
  updatedAt: Timestamp.now(),
});
