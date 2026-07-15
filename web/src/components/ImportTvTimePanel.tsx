import {ChangeEvent, useState} from "react";
import {Upload} from "lucide-react";
import {api} from "../api/client";
import {buildImportFromNormalized} from "../lib/tvTimeBuildImport";
import {chunkArray, parseEpisodesImportCsv, parseWatchlistImportCsv} from "../lib/tvTimeImportCsv";
import {normalizeTvTimeExport} from "../lib/tvTimeNormalize";
import {extractTvTimeCsvsFromZip} from "../lib/tvTimeZip";
import {
  AcceptedTvTimeShowMapping,
  ImportEpisodeInput,
  ImportJobSummary,
  ImportWatchlistItemInput,
  SkippedTvTimeShowMapping,
} from "../types/import";
import {SupportedLanguage} from "../types/settings";

interface ImportTvTimePanelProps {
  language: SupportedLanguage;
  signedIn: boolean;
}

const RESOLVE_CHUNK = 25;

const copyByLanguage = {
  "en-US": {
    title: "Import from TV Time",
    note: "Upload your TV Time GDPR export .zip. It stays on your device while shows are matched to TMDb. Unmatched shows are skipped. Existing watch progress is never downgraded.",
    zipLabel: "TV Time export (.zip)",
    advanced: "Advanced: upload prepared CSVs instead",
    watchlistLabel: "watchlist_import.csv",
    episodesLabel: "episodes_import.csv",
    start: "Start import",
    running: "Importing…",
    signedOut: "Sign in to import your TV Time history.",
    matching: (done: number, total: number) => `Matching shows ${done}/${total}…`,
    prepared: (watchlist: number, episodes: number, skippedShows: number) =>
      `${watchlist} watchlist rows · ${episodes} episode rows ready` +
      (skippedShows > 0 ? ` · ${skippedShows} shows skipped` : ""),
    progress: (job: ImportJobSummary) =>
      `Imported ${job.episodesImported} episodes (${job.episodesSkipped} already present, ${job.episodesFailed} failed) · ${job.watchlistImported} watchlist merges`,
    done: "Import completed.",
    skippedList: (titles: string[]) =>
      titles.length === 0
        ? null
        : `Skipped shows: ${titles.slice(0, 12).join(", ")}${titles.length > 12 ? ` (+${titles.length - 12} more)` : ""}`,
  },
  "zh-TW": {
    title: "從 TV Time 匯入",
    note: "上傳 TV Time GDPR 匯出的 .zip。檔案只在本機解析，節目會對應到 TMDb；無法對應的節目會略過，且不會降級既有片單／進度。",
    zipLabel: "TV Time 匯出檔（.zip）",
    advanced: "進階：改上傳已產生的 CSV",
    watchlistLabel: "watchlist_import.csv",
    episodesLabel: "episodes_import.csv",
    start: "開始匯入",
    running: "匯入中…",
    signedOut: "請先登入以匯入 TV Time 紀錄。",
    matching: (done: number, total: number) => `比對節目中 ${done}/${total}…`,
    prepared: (watchlist: number, episodes: number, skippedShows: number) =>
      `${watchlist} 筆片單 · ${episodes} 筆集數待匯入` +
      (skippedShows > 0 ? ` · 略過 ${skippedShows} 個節目` : ""),
    progress: (job: ImportJobSummary) =>
      `已匯入 ${job.episodesImported} 集（略過 ${job.episodesSkipped}、失敗 ${job.episodesFailed}）· 片單合併 ${job.watchlistImported}`,
    done: "匯入完成。",
    skippedList: (titles: string[]) =>
      titles.length === 0
        ? null
        : `略過節目：${titles.slice(0, 12).join("、")}${titles.length > 12 ? `（另有 ${titles.length - 12} 個）` : ""}`,
  },
} as const;

const runStagedImport = async (
  watchlist: ImportWatchlistItemInput[],
  episodes: ImportEpisodeInput[],
  onJob: (job: ImportJobSummary) => void,
) => {
  const fingerprint = `${watchlist.length}:${episodes.length}:${watchlist[0]?.tmdbId ?? 0}:${episodes[0]?.tmdbId ?? 0}`;
  const created = await api.createImport({
    provider: "tv_time",
    sourceHash: fingerprint,
  });
  let current = created.import;

  for (const chunk of chunkArray(watchlist, 200)) {
    current = (await api.stageImportWatchlist(current.importId, chunk)).import;
  }
  for (const chunk of chunkArray(episodes, 200)) {
    current = (await api.stageImportEpisodes(current.importId, chunk)).import;
  }

  current = (await api.commitImport(current.importId)).import;
  onJob(current);

  let done = false;
  while (!done) {
    const result = await api.runImport(current.importId, 100);
    current = result.import;
    onJob(current);
    done = result.done;
  }

  return current;
};

export const ImportTvTimePanel = ({language, signedIn}: ImportTvTimePanelProps) => {
  const copy = copyByLanguage[language];
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [watchlistText, setWatchlistText] = useState<string | null>(null);
  const [episodesText, setEpisodesText] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<ImportJobSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [skippedTitles, setSkippedTitles] = useState<string[]>([]);

  const canStart = Boolean(zipFile) || Boolean(watchlistText) || Boolean(episodesText);

  const onZip = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setZipFile(file);
    setError(null);
    setMessage(null);
    setSkippedTitles([]);
  };

  const onCsv = async (event: ChangeEvent<HTMLInputElement>, kind: "watchlist" | "episodes") => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    if (kind === "watchlist") {
      setWatchlistText(text);
    } else {
      setEpisodesText(text);
    }
    setZipFile(null);
    setError(null);
    setMessage(null);
    setSkippedTitles([]);
  };

  const importFromZip = async () => {
    if (!zipFile) {
      throw new Error("Choose a TV Time export .zip file.");
    }

    const bytes = await zipFile.arrayBuffer();
    const csvs = extractTvTimeCsvsFromZip(bytes);
    const normalized = normalizeTvTimeExport(csvs);
    if (normalized.shows.length === 0 && normalized.episodes.length === 0) {
      throw new Error("No shows or episodes found in the ZIP.");
    }

    const accepted: AcceptedTvTimeShowMapping[] = [];
    const skipped: SkippedTvTimeShowMapping[] = [];
    const showInputs = normalized.shows.map((show) => ({
      sourceShowId: show.tvTimeShowId,
      title: show.tvShowName || show.tvTimeShowId,
    }));

    let resolved = 0;
    for (const chunk of chunkArray(showInputs, RESOLVE_CHUNK)) {
      const result = await api.resolveTvTimeShows(chunk);
      accepted.push(...result.accepted);
      skipped.push(...result.skipped);
      resolved += chunk.length;
      setMessage(copy.matching(resolved, showInputs.length));
    }

    const built = buildImportFromNormalized(
      normalized,
      accepted.map((row) => ({
        sourceShowId: row.sourceShowId,
        tmdbId: row.tmdbId,
        title: row.title,
        poster: row.poster,
        backdrop: row.backdrop,
      })),
    );

    if (built.watchlist.length === 0 && built.episodes.length === 0) {
      throw new Error(
        skipped.length > 0
          ? "No shows could be matched to TMDb. Try again later or use prepared CSVs."
          : "No valid rows found in the ZIP.",
      );
    }

    setSkippedTitles(skipped.map((row) => row.title).filter(Boolean));
    setMessage(copy.prepared(built.watchlist.length, built.episodes.length, skipped.length));
    await runStagedImport(built.watchlist, built.episodes, setJob);
  };

  const importFromCsv = async () => {
    if (!watchlistText && !episodesText) {
      throw new Error("Choose at least one CSV file.");
    }
    const watchlist = watchlistText ? parseWatchlistImportCsv(watchlistText) : [];
    const episodes = episodesText ? parseEpisodesImportCsv(episodesText) : [];
    if (watchlist.length === 0 && episodes.length === 0) {
      throw new Error("No valid rows found in the CSV files.");
    }
    setSkippedTitles([]);
    setMessage(copy.prepared(watchlist.length, episodes.length, 0));
    await runStagedImport(watchlist, episodes, setJob);
  };

  const startImport = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    setJob(null);

    try {
      if (zipFile) {
        await importFromZip();
      } else {
        await importFromCsv();
      }
      setMessage(copy.done);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  const skippedNote = copy.skippedList(skippedTitles);

  return (
    <section className="settings-group" aria-labelledby="tv-time-import-title">
      <div className="settings-group-heading">
        <Upload size={18} aria-hidden="true" />
        <h3 id="tv-time-import-title">{copy.title}</h3>
      </div>
      <p className="settings-note">{copy.note}</p>
      {!signedIn ? (
        <p className="settings-note">{copy.signedOut}</p>
      ) : (
        <>
          <label className="settings-field">
            <span>{copy.zipLabel}</span>
            <input
              type="file"
              accept=".zip,application/zip"
              disabled={busy}
              data-testid="tv-time-zip-input"
              onChange={onZip}
            />
          </label>

          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => setShowAdvanced((value) => !value)}
          >
            {copy.advanced}
          </button>

          {showAdvanced ? (
            <>
              <label className="settings-field">
                <span>{copy.watchlistLabel}</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  disabled={busy}
                  data-testid="tv-time-watchlist-csv"
                  onChange={(event) => void onCsv(event, "watchlist")}
                />
              </label>
              <label className="settings-field">
                <span>{copy.episodesLabel}</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  disabled={busy}
                  data-testid="tv-time-episodes-csv"
                  onChange={(event) => void onCsv(event, "episodes")}
                />
              </label>
            </>
          ) : null}

          <button
            className="primary-button"
            type="button"
            disabled={busy || !canStart}
            data-testid="tv-time-import-start"
            onClick={() => void startImport()}
          >
            {busy ? copy.running : copy.start}
          </button>
          {message ? <p className="settings-note" data-testid="tv-time-import-message">{message}</p> : null}
          {skippedNote ? <p className="settings-note" data-testid="tv-time-import-skipped">{skippedNote}</p> : null}
          {job ? (
            <p className="settings-note" data-testid="import-job-status">
              {job.status} · {copy.progress(job)}
            </p>
          ) : null}
          {error ? (
            <p className="form-error" role="alert" data-testid="tv-time-import-error">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
};
