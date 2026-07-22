import type {User} from "firebase/auth";
import {PaginatedResponse} from "../../types/pagination";

export const mockUser = {uid: "user-1"} as User;

export const paginated = <T>(
  items: T[],
  options: Partial<Pick<PaginatedResponse<T>, "pageSize" | "nextPageToken" | "hasMore">> = {},
): PaginatedResponse<T> => ({
  items,
  pageSize: options.pageSize ?? 25,
  nextPageToken: options.nextPageToken ?? null,
  hasMore: options.hasMore ?? Boolean(options.nextPageToken),
});
