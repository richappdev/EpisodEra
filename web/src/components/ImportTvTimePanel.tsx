import {ChangeEvent, useState} from "react";
import {Upload} from "lucide-react";
import {api} from "../api/client";
import {chunkArray, parseEpisodesImportCsv, parseWatchlistImportCsv} from "../lib/tvTimeImportCsv";
import {ImportJobSummary} from "../types/import";
import {SupportedLanguage} from "../types/settings";

interface ImportTvTimePanelProps {
  language: SupportedLanguage;
  signedIn: boolean;
}

const copyByLanguage = {
  "en-US": {
    title: "Import from TV Time",
    note: "Upload the CSVs from tv_time_tool (watchlist_import.csv and episodes_import.csv). Historical watched dates are preserved. Existing watch progress is never downgraded.",
    watchlistLabel: "watchlist_import.csv",
    episodesLabel: "episodes_import.csv",
    start: "Start import",
    running: "Importing…",
    signedOut: "Sign in to import your TV Time history.",
    ready: (watchlist: number, episodes: number) =>
      `${watchlist} watchlist rows · ${episodes} episode rows ready`,
    progress: (job: ImportJobSummary) =>
      `Imported ${job.episodesImported} episodes (${job.episodesSkipped} already present, ${job.episodesFailed} failed) · ${job.watchlistImported} watchlist merges`,
    done: "Import completed.",
  },
  "zh-TW": {
    title: "從 TV Time 匯入",
    note: "上傳 tv_time_tool 產生的 CSV（watchlist_import.csv 與 episodes_import.csv）。會保留歷史觀看時間，且不會降級既有片單／進度。",
    watchlistLabel: "watchlist_import.csv",
    episodesLabel: "episodes_import.csv",
    start: "開始匯入",
    running: "匯入中…",
    signedOut: "請先登入以匯入 TV Time 紀錄。",
    ready: (watchlist: number, episodes: number) =>
      `${watchlist} 筆片單 · ${episodes} 筆集數待匯入`,
    progress: (job: ImportJobSummary) =>
      `已匯入 ${job.episodesImported} 集（略過 ${job.episodesSkipped}、失敗 ${job.episodesFailed}）· 片單合併 ${job.watchlistImported}`,
    done: "匯入完成。",
  },
} as const;

export const ImportTvTimePanel = ({language, signedIn}: ImportTvTimePanelProps) => {
  const copy = copyByLanguage[language];
  const [watchlistText, setWatchlistText] = useState<string | null>(null);
  const [episodesText, setEpisodesText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<ImportJobSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onFile = async (event: ChangeEvent<HTMLInputElement>, kind: "watchlist" | "episodes") => {
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
    setError(null);
    setMessage(null);
  };

  const startImport = async () => {
    if (!watchlistText && !episodesText) {
      setError("Choose at least one CSV file.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const watchlist = watchlistText ? parseWatchlistImportCsv(watchlistText) : [];
      const episodes = episodesText ? parseEpisodesImportCsv(episodesText) : [];
      if (watchlist.length === 0 && episodes.length === 0) {
        throw new Error("No valid rows found in the CSV files.");
      }

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
      setJob(current);
      setMessage(copy.ready(watchlist.length, episodes.length));

      let done = false;
      while (!done) {
        const result = await api.runImport(current.importId, 100);
        current = result.import;
        setJob(current);
        setMessage(copy.progress(current));
        done = result.done;
      }

      setMessage(copy.done);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="settings-group" aria-labelledby="tv-time-import-title">
      <div className="settings-group-header">
        <Upload size={18} aria-hidden="true" />
        <h3 id="tv-time-import-title">{copy.title}</h3>
      </div>
      <p className="settings-note">{copy.note}</p>
      {!signedIn ? (
        <p className="settings-note">{copy.signedOut}</p>
      ) : (
        <>
          <label className="settings-field">
            <span>{copy.watchlistLabel}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(event) => void onFile(event, "watchlist")}
            />
          </label>
          <label className="settings-field">
            <span>{copy.episodesLabel}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(event) => void onFile(event, "episodes")}
            />
          </label>
          <button className="primary-button" type="button" disabled={busy || (!watchlistText && !episodesText)} onClick={() => void startImport()}>
            {busy ? copy.running : copy.start}
          </button>
          {message ? <p className="settings-note">{message}</p> : null}
          {job ? (
            <p className="settings-note" data-testid="import-job-status">
              {job.status} · {copy.progress(job)}
            </p>
          ) : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </>
      )}
    </section>
  );
};
