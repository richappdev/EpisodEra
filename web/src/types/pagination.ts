export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export const defaultPageSize = 25;
export const maxPageSize = 100;

export const withPagination = (path: string, pagination?: PaginationParams) => {
  const params = new URLSearchParams();
  if (pagination?.page) {
    params.set("page", String(pagination.page));
  }
  if (pagination?.pageSize) {
    params.set("pageSize", String(pagination.pageSize));
  }

  const query = params.toString();
  if (!query) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${query}`;
};
