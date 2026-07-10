import {DiscoveryResponse, MediaDetail, MediaType} from "../types/media";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:5001/tv-show-time-dev/us-central1/api";

const request = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`);
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
