export interface ImportResumeState {
  importId: string;
  episodesTotal: number;
  watchlistTotal: number;
  skippedShows: number;
  skippedTitles: string[];
}

export const IMPORT_RESUME_STORAGE_KEY = "episodera.tvTimeImport.resume";

export const loadImportResume = (): ImportResumeState | null => {
  try {
    const raw = sessionStorage.getItem(IMPORT_RESUME_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<ImportResumeState>;
    if (typeof parsed.importId !== "string" || !parsed.importId) {
      return null;
    }
    return {
      importId: parsed.importId,
      episodesTotal: Number(parsed.episodesTotal) || 0,
      watchlistTotal: Number(parsed.watchlistTotal) || 0,
      skippedShows: Number(parsed.skippedShows) || 0,
      skippedTitles: Array.isArray(parsed.skippedTitles)
        ? parsed.skippedTitles.filter((title): title is string => typeof title === "string")
        : [],
    };
  } catch {
    return null;
  }
};

export const saveImportResume = (state: ImportResumeState) => {
  sessionStorage.setItem(IMPORT_RESUME_STORAGE_KEY, JSON.stringify(state));
};

export const clearImportResume = () => {
  sessionStorage.removeItem(IMPORT_RESUME_STORAGE_KEY);
};
