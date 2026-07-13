import type {User} from "firebase/auth";
import {PaginatedResponse} from "../../types/pagination";

export const mockUser = {uid: "user-1"} as User;

export const paginated = <T>(
  items: T[],
  options: Partial<Pick<PaginatedResponse<T>, "page" | "pageSize" | "totalCount" | "hasMore">> = {},
): PaginatedResponse<T> => ({
  items,
  page: options.page ?? 1,
  pageSize: options.pageSize ?? 25,
  totalCount: options.totalCount ?? items.length,
  hasMore: options.hasMore ?? false,
});
