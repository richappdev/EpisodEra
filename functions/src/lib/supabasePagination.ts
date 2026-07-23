import {HttpError} from "./httpError";
import {PaginatedResult, PaginationQuery} from "./pagination";

/** Offset cursor for Supabase list reads (distinct from Firestore page tokens). */
export const encodeSupabaseOffsetToken = (offset: number): string =>
  Buffer.from(JSON.stringify({sb: true, o: offset}), "utf8").toString("base64url");

export const decodeSupabaseOffsetToken = (token: string | undefined): number => {
  if (!token) {
    return 0;
  }
  try {
    const parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as {
      sb?: boolean;
      o?: unknown;
    };
    if (parsed?.sb === true && Number.isInteger(parsed.o) && Number(parsed.o) >= 0) {
      return Number(parsed.o);
    }
  } catch {
    // fall through
  }
  throw new HttpError(400, "pageToken is invalid.", "invalid_page_token");
};

export const paginateRows = <T>(
  rows: T[],
  pagination: PaginationQuery,
  offset: number,
): PaginatedResult<T> => {
  const hasMore = rows.length > pagination.pageSize;
  const items = hasMore ? rows.slice(0, pagination.pageSize) : rows;
  return {
    items,
    pageSize: pagination.pageSize,
    nextPageToken: hasMore ? encodeSupabaseOffsetToken(offset + items.length) : null,
    hasMore,
  };
};
