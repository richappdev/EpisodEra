/** Treat null, undefined, and blank strings as missing image URLs. */
export const needsImageUrl = (value: string | null | undefined): boolean =>
  typeof value !== "string" || value.trim().length === 0;

export const normalizeImageUrl = (value: string | null | undefined): string | null =>
  needsImageUrl(value) ? null : value!.trim();

/** Prefer an existing non-empty URL; otherwise take the incoming one. */
export const preferImageUrl = (
  existing: string | null | undefined,
  incoming: string | null | undefined,
): string | null => normalizeImageUrl(existing) ?? normalizeImageUrl(incoming);

export interface WatchlistImageFields {
  poster: string | null;
  backdrop: string | null;
}

export const itemNeedsImageBackfill = (item: WatchlistImageFields): boolean =>
  needsImageUrl(item.poster) || needsImageUrl(item.backdrop);

/** Merge TMDb images into a watchlist row, filling only missing fields. */
export const mergeWatchlistImages = (
  item: WatchlistImageFields,
  images: WatchlistImageFields,
): WatchlistImageFields => ({
  poster: preferImageUrl(item.poster, images.poster),
  backdrop: preferImageUrl(item.backdrop, images.backdrop),
});

export const mapInChunks = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += concurrency) {
    const chunk = items.slice(index, index + concurrency);
    const mapped = await Promise.all(chunk.map((item) => mapper(item)));
    results.push(...mapped);
  }
  return results;
};
