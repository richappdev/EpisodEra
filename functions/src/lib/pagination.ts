import {FieldPath, Timestamp, type Query, type QueryDocumentSnapshot} from "firebase-admin/firestore";
import {HttpError} from "./httpError";

export interface PaginationQuery {
  pageSize: number;
  pageToken?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  pageSize: number;
  nextPageToken: string | null;
  hasMore: boolean;
}

export interface CursorPayload {
  values: unknown[];
  id: string;
}

export const defaultPageSize = 25;
export const maxPageSize = 100;

const positiveInteger = (value: unknown, fallback: number, max: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
};

const serializeCursorValue = (value: unknown): unknown => {
  if (value instanceof Timestamp) {
    return {__ts: true, seconds: value.seconds, nanoseconds: value.nanoseconds};
  }
  return value;
};

const deserializeCursorValue = (value: unknown): unknown => {
  if (
    value &&
    typeof value === "object" &&
    (value as {__ts?: boolean}).__ts === true &&
    typeof (value as {seconds?: unknown}).seconds === "number" &&
    typeof (value as {nanoseconds?: unknown}).nanoseconds === "number"
  ) {
    return new Timestamp(
      (value as {seconds: number}).seconds,
      (value as {nanoseconds: number}).nanoseconds,
    );
  }
  return value;
};

export const encodePageToken = (payload: CursorPayload): string =>
  Buffer.from(
    JSON.stringify({
      id: payload.id,
      values: payload.values.map(serializeCursorValue),
    }),
    "utf8",
  ).toString("base64url");

export const decodePageToken = (token: string): CursorPayload => {
  try {
    const parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as CursorPayload;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.values) ||
      typeof parsed.id !== "string" ||
      !parsed.id
    ) {
      throw new Error("invalid token shape");
    }
    return {
      id: parsed.id,
      values: parsed.values.map(deserializeCursorValue),
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(400, "pageToken is invalid.", "invalid_page_token");
  }
};

export const parsePaginationQuery = (query: Record<string, unknown>): PaginationQuery => {
  const pageTokenRaw = query.pageToken;
  const pageToken =
    typeof pageTokenRaw === "string" && pageTokenRaw.trim().length > 0 ? pageTokenRaw.trim() : undefined;

  return {
    pageSize: positiveInteger(query.pageSize, defaultPageSize, maxPageSize),
    pageToken,
  };
};

export const listPaginated = async <T>(
  baseQuery: Query,
  pagination: PaginationQuery,
  mapDocument: (doc: QueryDocumentSnapshot) => T,
  orderField = "updatedAt",
): Promise<PaginatedResult<T>> => {
  // Tie-break on document id so cursors remain stable when order-field values collide.
  let query: Query = baseQuery.orderBy(FieldPath.documentId()).limit(pagination.pageSize + 1);

  if (pagination.pageToken) {
    const cursor = decodePageToken(pagination.pageToken);
    query = query.startAfter(...cursor.values);
  }

  const pageSnapshot = await query.get();
  const hasMore = pageSnapshot.size > pagination.pageSize;
  const pageDocs = hasMore ? pageSnapshot.docs.slice(0, pagination.pageSize) : pageSnapshot.docs;
  const lastDoc = pageDocs[pageDocs.length - 1];

  return {
    items: pageDocs.map(mapDocument),
    pageSize: pagination.pageSize,
    nextPageToken:
      hasMore && lastDoc
        ? encodePageToken({
            id: lastDoc.id,
            values: [lastDoc.get(orderField), lastDoc.id],
          })
        : null,
    hasMore,
  };
};

export const listAllDocuments = async <T>(
  fetchPage: (pagination: PaginationQuery) => Promise<PaginatedResult<T>>,
): Promise<T[]> => {
  const items: T[] = [];
  let pageToken: string | undefined;

  do {
    const result = await fetchPage({pageSize: maxPageSize, pageToken});
    items.push(...result.items);
    pageToken = result.nextPageToken ?? undefined;
  } while (pageToken);

  return items;
};

/** @deprecated Use listAllDocuments */
export const fetchAllPages = listAllDocuments;
