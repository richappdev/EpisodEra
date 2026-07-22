const PLAYER_ID_KEY = "episodera.dailyPuzzle.playerId";

const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

/** Stable anonymous player id for guess submissions when signed out. */
export const getOrCreatePlayerId = (): string => {
  try {
    const existing = window.localStorage.getItem(PLAYER_ID_KEY);
    if (existing) {
      return existing;
    }
    const created = createId();
    window.localStorage.setItem(PLAYER_ID_KEY, created);
    return created;
  } catch {
    return createId();
  }
};
