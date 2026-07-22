export interface PaginatedResponse<T> {
  items: T[];
  pageSize: number;
  nextPageToken: string | null;
  hasMore: boolean;
}

export interface PaginationParams {
  pageSize?: number;
  pageToken?: string;
}

export const defaultPageSize = 25;
export const maxPageSize = 100;

export const withPagination = (path: string, pagination?: PaginationParams) => {
  const params = new URLSearchParams();
  if (pagination?.pageSize) {
    params.set("pageSize", String(pagination.pageSize));
  }
  if (pagination?.pageToken) {
    params.set("pageToken", pagination.pageToken);
  }

  const query = params.toString();
  if (!query) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${query}`;
};
