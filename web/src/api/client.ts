import {DiscoveryResponse, MediaDetail, MediaType} from "../types/media";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5001/episodera/us-central1/api";

let tokenProvider: (() => Promise<string | null>) | null = null;

export const setApiTokenProvider = (provider: () => Promise<string | null>) => {
  tokenProvider = provider;
};

const request = async <T>(path: string): Promise<T> => {
  const token = tokenProvider ? await tokenProvider() : null;
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: token ? {Authorization: `Bearer ${token}`} : undefined,
  });
  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error?.message ?? "Request failed.";
    throw new Error(message);
  }

  return payload as T;
};

export const api = {
  trending: () => request<DiscoveryResponse>("/trending"),
  search: (query: string) => request<DiscoveryResponse>(`/search?q=${encodeURIComponent(query)}`),
  detail: (mediaType: MediaType, id: number) => request<MediaDetail>(`/${mediaType}/${id}`),
};
