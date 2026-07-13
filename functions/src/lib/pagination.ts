import type {Query, QueryDocumentSnapshot} from "firebase-admin/firestore";

export interface PaginationQuery {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
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

export const parsePaginationQuery = (query: Record<string, unknown>): PaginationQuery => ({
  page: positiveInteger(query.page, 1, Number.MAX_SAFE_INTEGER),
  pageSize: positiveInteger(query.pageSize, defaultPageSize, maxPageSize),
});

export const listPaginated = async <T>(
  baseQuery: Query,
  pagination: PaginationQuery,
  mapDocument: (doc: QueryDocumentSnapshot) => T,
): Promise<PaginatedResult<T>> => {
  const offset = (pagination.page - 1) * pagination.pageSize;
  const [countSnapshot, pageSnapshot] = await Promise.all([
    baseQuery.count().get(),
    baseQuery.offset(offset).limit(pagination.pageSize).get(),
  ]);

  const totalCount = countSnapshot.data().count;

  return {
    items: pageSnapshot.docs.map(mapDocument),
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalCount,
    hasMore: offset + pageSnapshot.size < totalCount,
  };
};

export const fetchAllPages = async <T>(
  fetchPage: (pagination: PaginationQuery) => Promise<PaginatedResult<T>>,
): Promise<T[]> => {
  let page = 1;
  const items: T[] = [];
  let hasMore = true;

  while (hasMore) {
    const result = await fetchPage({page, pageSize: maxPageSize});
    items.push(...result.items);
    hasMore = result.hasMore;
    page += 1;
  }

  return items;
};
