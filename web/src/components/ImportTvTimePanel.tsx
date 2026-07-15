import {ChangeEvent, useState} from "react";
import {Upload} from "lucide-react";
import {api} from "../api/client";
import {buildImportFromNormalized} from "../lib/tvTimeBuildImport";
import {chunkArray, parseEpisodesImportCsv, parseWatchlistImportCsv} from "../lib/tvTimeImportCsv";
import {NormalizedTvTimeExport, normalizeTvTimeExport} from "../lib/tvTimeNormalize";
import {extractTvTimeCsvsFromZip} from "../lib/tvTimeZip";
import {
  AcceptedTvTimeShowMapping,
  ImportEpisodeInput,
  ImportJobSummary,
  ImportWatchlistItemInput,
  SkippedTvTimeShowMapping,
  TvTimeMappingCandidate,
} from "../types/import";
import {SupportedLanguage} from "../types/settings";

interface ImportTvTimePanelProps {
  language: SupportedLanguage;
  signedIn: boolean;
}

type ImportPhase =
  | "idle"
  | "parsing"
  | "matching"
  | "review"
  | "uploading"
  | "importing"
  | "done";

interface ImportProgress {
  phase: ImportPhase;
  watchlistTotal: number;
  episodesTotal: number;
  skippedShows: number;
  remainingEpisodes: number | null;
  job: ImportJobSummary | null;
}

interface ReviewRow {
  sourceShowId: string;
  title: string;
  reason: string;
  notes?: string;
  candidates: TvTimeMappingCandidate[];
  /** null = skip this show */
  selectedTmdbId: number | null;
  manualDraft: string;
}

interface PendingZipImport {
  normalized: NormalizedTvTimeExport;
  accepted: AcceptedTvTimeShowMapping[];
  reviewRows: ReviewRow[];
}

const RESOLVE_CHUNK = 25;

const idleProgress = (): ImportProgress => ({
  phase: "idle",
  watchlistTotal: 0,
  episodesTotal: 0,
  skippedShows: 0,
  remainingEpisodes: null,
  job: null,
});

const copyByLanguage = {
  "en-US": {
    title: "Import from TV Time",
    note: "Upload your TV Time GDPR export .zip. It stays on your device while shows are matched to TMDb. Review unmatched shows before import. Existing watch progress is never downgraded.",
    zipLabel: "TV Time export (.zip)",
    advanced: "Advanced: upload prepared CSVs instead",
    watchlistLabel: "watchlist_import.csv",
    episodesLabel: "episodes_import.csv",
    start: "Start import",
    continueImport: "Continue import",
    cancelReview: "Cancel",
    running: "Importing…",
    signedOut: "Sign in to import your TV Time history.",
    parsing: "Reading ZIP…",
    matching: (done: number, total: number) => `Matching shows ${done}/${total}…`,
    reviewTitle: "Review unmatched shows",
    reviewNote:
      "These shows need a TMDb match. Pick a candidate, enter a TMDb TV id, or skip. Choices are saved for future imports.",
    skipShow: "Skip",
    manualId: "TMDb TV id",
    applyManual: "Use id",
    reasonLabel: (reason: string) => {
      if (reason === "ambiguous") {
        return "Ambiguous match";
      }
      if (reason === "low_confidence") {
        return "Low confidence";
      }
      return "Unresolved";
    },
    uploading: (watchlist: number, episodes: number) =>
      `Uploading import data… ${watchlist} watchlist rows · ${episodes} episodes`,
    importing: (progress: ImportProgress) => {
      const job = progress.job;
      const imported = job?.episodesImported ?? 0;
      const skipped = job?.episodesSkipped ?? 0;
      const failed = job?.episodesFailed ?? 0;
      const watchlist = job?.watchlistImported ?? 0;
      const total = progress.episodesTotal;
      const remaining =
        progress.remainingEpisodes ?? Math.max(total - imported - skipped - failed, 0);
      return `Still processing… Imported ${imported} / ${total} episodes (${skipped} already present, ${failed} failed) · ${remaining} remaining · ${watchlist} watchlist merges`;
    },
    done: (progress: ImportProgress) => {
      const job = progress.job;
      const imported = job?.episodesImported ?? 0;
      const skipped = job?.episodesSkipped ?? 0;
      const failed = job?.episodesFailed ?? 0;
      const watchlist = job?.watchlistImported ?? 0;
      return (
        `Import completed. ${imported} / ${progress.episodesTotal} episodes imported (${skipped} already present, ${failed} failed) · ${watchlist} watchlist merges` +
        (progress.skippedShows > 0 ? ` · ${progress.skippedShows} shows skipped` : "")
      );
    },
    skippedList: (titles: string[]) =>
      titles.length === 0
        ? null
        : `Skipped shows: ${titles.slice(0, 12).join(", ")}${titles.length > 12 ? ` (+${titles.length - 12} more)` : ""}`,
  },
  "zh-TW": {
    title: "從 TV Time 匯入",
    note: "上傳 TV Time GDPR 匯出的 .zip。檔案只在本機解析；無法自動對應的節目可在匯入前手動選擇 TMDb。不會降級既有片單／進度。",
    zipLabel: "TV Time 匯出檔（.zip）",
    advanced: "進階：改上傳已產生的 CSV",
    watchlistLabel: "watchlist_import.csv",
    episodesLabel: "episodes_import.csv",
    start: "開始匯入",
    continueImport: "繼續匯入",
    cancelReview: "取消",
    running: "匯入中…",
    signedOut: "請先登入以匯入 TV Time 紀錄。",
    parsing: "正在讀取 ZIP…",
    matching: (done: number, total: number) => `比對節目中 ${done}/${total}…`,
    reviewTitle: "檢視無法自動對應的節目",
    reviewNote: "請選擇候選、輸入 TMDb 影集 ID，或略過。你的選擇會保存供之後匯入使用。",
    skipShow: "略過",
    manualId: "TMDb 影集 ID",
    applyManual: "使用此 ID",
    reasonLabel: (reason: string) => {
      if (reason === "ambiguous") {
        return "候選接近，需確認";
      }
      if (reason === "low_confidence") {
        return "信心不足";
      }
      return "找不到對應";
    },
    uploading: (watchlist: number, episodes: number) =>
      `正在上傳匯入資料… ${watchlist} 筆片單 · ${episodes} 集`,
    importing: (progress: ImportProgress) => {
      const job = progress.job;
      const imported = job?.episodesImported ?? 0;
      const skipped = job?.episodesSkipped ?? 0;
      const failed = job?.episodesFailed ?? 0;
      const watchlist = job?.watchlistImported ?? 0;
      const total = progress.episodesTotal;
      const remaining =
        progress.remainingEpisodes ?? Math.max(total - imported - skipped - failed, 0);
      return `仍在處理中… 已匯入 ${imported} / ${total} 集（略過 ${skipped}、失敗 ${failed}）· 剩餘 ${remaining} · 片單合併 ${watchlist}`;
    },
    done: (progress: ImportProgress) => {
      const job = progress.job;
      const imported = job?.episodesImported ?? 0;
      const skipped = job?.episodesSkipped ?? 0;
      const failed = job?.episodesFailed ?? 0;
      const watchlist = job?.watchlistImported ?? 0;
      return (
        `匯入完成。已匯入 ${imported} / ${progress.episodesTotal} 集（略過 ${skipped}、失敗 ${failed}）· 片單合併 ${watchlist}` +
        (progress.skippedShows > 0 ? ` · 略過 ${progress.skippedShows} 個節目` : "")
      );
    },
    skippedList: (titles: string[]) =>
      titles.length === 0
        ? null
        : `略過節目：${titles.slice(0, 12).join("、")}${titles.length > 12 ? `（另有 ${titles.length - 12} 個）` : ""}`,
  },
} as const;

const statusText = (
  copy: (typeof copyByLanguage)[SupportedLanguage],
  progress: ImportProgress,
  matchingLabel: string | null,
): string | null => {
  switch (progress.phase) {
    case "parsing":
      return copy.parsing;
    case "matching":
      return matchingLabel;
    case "uploading":
      return copy.uploading(progress.watchlistTotal, progress.episodesTotal);
    case "importing":
      return copy.importing(progress);
    case "done":
      return copy.done(progress);
    default:
      return null;
  }
};

const toReviewRows = (skipped: SkippedTvTimeShowMapping[]): ReviewRow[] =>
  skipped.map((row) => ({
    sourceShowId: row.sourceShowId,
    title: row.title,
    reason: row.reason,
    notes: row.notes,
    candidates: row.candidates ?? [],
    selectedTmdbId: row.candidates?.[0]?.tmdbId ?? null,
    manualDraft: "",
  }));

const runStagedImport = async (
  watchlist: ImportWatchlistItemInput[],
  episodes: ImportEpisodeInput[],
  onProgress: (update: Partial<ImportProgress> & {job?: ImportJobSummary}) => void,
) => {
  const fingerprint = `${watchlist.length}:${episodes.length}:${watchlist[0]?.tmdbId ?? 0}:${episodes[0]?.tmdbId ?? 0}`;
  onProgress({
    phase: "uploading",
    watchlistTotal: watchlist.length,
    episodesTotal: episodes.length,
    remainingEpisodes: episodes.length,
  });

  const created = await api.createImport({
    provider: "tv_time",
    sourceHash: fingerprint,
  });
  let current = created.import;
  onProgress({job: current});

  for (const chunk of chunkArray(watchlist, 200)) {
    current = (await api.stageImportWatchlist(current.importId, chunk)).import;
    onProgress({job: current});
  }
  for (const chunk of chunkArray(episodes, 200)) {
    current = (await api.stageImportEpisodes(current.importId, chunk)).import;
    onProgress({job: current});
  }

  current = (await api.commitImport(current.importId)).import;
  onProgress({
    phase: "importing",
    job: current,
    remainingEpisodes: current.episodesStaged,
  });

  let done = false;
  while (!done) {
    const result = await api.runImport(current.importId, 100);
    current = result.import;
    onProgress({
      phase: result.done ? "done" : "importing",
      job: current,
      remainingEpisodes: result.remainingEpisodes,
    });
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
  const [progress, setProgress] = useState<ImportProgress>(idleProgress);
  const [matchingLabel, setMatchingLabel] = useState<string | null>(null);
  const [skippedTitles, setSkippedTitles] = useState<string[]>([]);
  const [pendingZip, setPendingZip] = useState<PendingZipImport | null>(null);
  const [manualErrorByShow, setManualErrorByShow] = useState<Record<string, string>>({});

  const canStart = Boolean(zipFile) || Boolean(watchlistText) || Boolean(episodesText);
  const inReview = progress.phase === "review" && pendingZip !== null;

  const patchProgress = (update: Partial<ImportProgress>) => {
    setProgress((previous) => ({...previous, ...update}));
  };

  const resetTransient = () => {
    setError(null);
    setProgress(idleProgress());
    setMatchingLabel(null);
    setSkippedTitles([]);
    setPendingZip(null);
    setManualErrorByShow({});
  };

  const onZip = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setZipFile(file);
    resetTransient();
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
    resetTransient();
  };

  const finishWithMappings = async (
    normalized: NormalizedTvTimeExport,
    accepted: AcceptedTvTimeShowMapping[],
    finalSkippedTitles: string[],
  ) => {
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
        finalSkippedTitles.length > 0
          ? "No shows could be matched to TMDb. Review mappings or use prepared CSVs."
          : "No valid rows found in the ZIP.",
      );
    }

    setSkippedTitles(finalSkippedTitles);
    patchProgress({skippedShows: finalSkippedTitles.length});
    await runStagedImport(built.watchlist, built.episodes, patchProgress);
    patchProgress({phase: "done"});
  };

  const importFromZip = async () => {
    if (!zipFile) {
      throw new Error("Choose a TV Time export .zip file.");
    }

    patchProgress({phase: "parsing"});
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

    patchProgress({phase: "matching"});
    let resolved = 0;
    for (const chunk of chunkArray(showInputs, RESOLVE_CHUNK)) {
      const result = await api.resolveTvTimeShows(chunk);
      accepted.push(...result.accepted);
      skipped.push(...result.skipped);
      resolved += chunk.length;
      setMatchingLabel(copy.matching(resolved, showInputs.length));
    }

    if (skipped.length > 0) {
      setPendingZip({
        normalized,
        accepted,
        reviewRows: toReviewRows(skipped),
      });
      patchProgress({phase: "review", skippedShows: skipped.length});
      return;
    }

    await finishWithMappings(normalized, accepted, []);
  };

  const applyManualId = async (sourceShowId: string) => {
    if (!pendingZip) {
      return;
    }
    const row = pendingZip.reviewRows.find((item) => item.sourceShowId === sourceShowId);
    if (!row) {
      return;
    }
    const tmdbId = Number(row.manualDraft.trim());
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      setManualErrorByShow((previous) => ({...previous, [sourceShowId]: "Enter a positive TMDb id."}));
      return;
    }

    try {
      const detail = await api.detail("tv", tmdbId, language);
      setManualErrorByShow((previous) => {
        const next = {...previous};
        delete next[sourceShowId];
        return next;
      });
      setPendingZip((previous) => {
        if (!previous) {
          return previous;
        }
        return {
          ...previous,
          reviewRows: previous.reviewRows.map((item) => {
            if (item.sourceShowId !== sourceShowId) {
              return item;
            }
            const candidate: TvTimeMappingCandidate = {
              tmdbId: detail.id,
              title: detail.title,
              poster: detail.images.poster,
              backdrop: detail.images.backdrop,
              year: detail.releaseDate ? detail.releaseDate.slice(0, 4) : null,
            };
            const others = item.candidates.filter((entry) => entry.tmdbId !== candidate.tmdbId);
            return {
              ...item,
              candidates: [candidate, ...others],
              selectedTmdbId: candidate.tmdbId,
            };
          }),
        };
      });
    } catch {
      setManualErrorByShow((previous) => ({
        ...previous,
        [sourceShowId]: "Could not load that TMDb TV id.",
      }));
    }
  };

  const continueAfterReview = async () => {
    if (!pendingZip) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const accepted = [...pendingZip.accepted];
      const stillSkipped: string[] = [];

      for (const row of pendingZip.reviewRows) {
        if (row.selectedTmdbId == null) {
          stillSkipped.push(row.title);
          continue;
        }
        const candidate =
          row.candidates.find((entry) => entry.tmdbId === row.selectedTmdbId) ??
          ({
            tmdbId: row.selectedTmdbId,
            title: row.title,
            poster: null,
            backdrop: null,
            year: null,
          } satisfies TvTimeMappingCandidate);

        accepted.push({
          sourceShowId: row.sourceShowId,
          tmdbId: candidate.tmdbId,
          title: candidate.title || row.title,
          poster: candidate.poster,
          backdrop: candidate.backdrop,
          confidence: 1,
          matchMethod: "manual",
        });

        try {
          await api.upsertMediaMapping({
            provider: "tv_time",
            mediaType: "tv",
            externalId: row.sourceShowId,
            tmdbId: candidate.tmdbId,
            title: candidate.title || row.title,
          });
        } catch {
          // Mapping persistence is best-effort; import can continue.
        }
      }

      setPendingZip(null);
      await finishWithMappings(pendingZip.normalized, accepted, stillSkipped);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed.");
    } finally {
      setBusy(false);
    }
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
    patchProgress({skippedShows: 0});
    await runStagedImport(watchlist, episodes, patchProgress);
    patchProgress({phase: "done"});
  };

  const startImport = async () => {
    setBusy(true);
    setError(null);
    setProgress(idleProgress());
    setMatchingLabel(null);
    setPendingZip(null);
    setSkippedTitles([]);

    try {
      if (zipFile) {
        await importFromZip();
      } else {
        await importFromCsv();
      }
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  const status = statusText(copy, progress, matchingLabel);
  const skippedNote = copy.skippedList(skippedTitles);
  const showLiveStatus = progress.phase === "uploading" || progress.phase === "importing";

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
          {!inReview ? (
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
            </>
          ) : null}

          {inReview && pendingZip ? (
            <div className="settings-import-review" data-testid="tv-time-import-review">
              <h4>{copy.reviewTitle}</h4>
              <p className="settings-note">{copy.reviewNote}</p>
              <ul className="settings-import-review-list">
                {pendingZip.reviewRows.map((row) => (
                  <li key={row.sourceShowId} className="settings-import-review-item">
                    <div className="settings-import-review-header">
                      <strong>{row.title}</strong>
                      <span className="settings-note">{copy.reasonLabel(row.reason)}</span>
                    </div>
                    {row.notes ? <p className="settings-note">{row.notes}</p> : null}
                    <div className="settings-import-candidate-list" role="radiogroup" aria-label={row.title}>
                      <label className="settings-check">
                        <input
                          type="radio"
                          name={`map-${row.sourceShowId}`}
                          checked={row.selectedTmdbId === null}
                          disabled={busy}
                          onChange={() =>
                            setPendingZip((previous) =>
                              previous
                                ? {
                                    ...previous,
                                    reviewRows: previous.reviewRows.map((item) =>
                                      item.sourceShowId === row.sourceShowId
                                        ? {...item, selectedTmdbId: null}
                                        : item,
                                    ),
                                  }
                                : previous,
                            )
                          }
                        />
                        <span>{copy.skipShow}</span>
                      </label>
                      {row.candidates.map((candidate) => (
                        <label key={candidate.tmdbId} className="settings-check">
                          <input
                            type="radio"
                            name={`map-${row.sourceShowId}`}
                            checked={row.selectedTmdbId === candidate.tmdbId}
                            disabled={busy}
                            onChange={() =>
                              setPendingZip((previous) =>
                                previous
                                  ? {
                                      ...previous,
                                      reviewRows: previous.reviewRows.map((item) =>
                                        item.sourceShowId === row.sourceShowId
                                          ? {...item, selectedTmdbId: candidate.tmdbId}
                                          : item,
                                      ),
                                    }
                                  : previous,
                              )
                            }
                          />
                          <span>
                            {candidate.title}
                            {candidate.year ? ` (${candidate.year})` : ""} · #{candidate.tmdbId}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="settings-import-manual">
                      <label className="settings-field">
                        <span>{copy.manualId}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row.manualDraft}
                          disabled={busy}
                          data-testid={`tv-time-manual-id-${row.sourceShowId}`}
                          onChange={(event) =>
                            setPendingZip((previous) =>
                              previous
                                ? {
                                    ...previous,
                                    reviewRows: previous.reviewRows.map((item) =>
                                      item.sourceShowId === row.sourceShowId
                                        ? {...item, manualDraft: event.target.value}
                                        : item,
                                    ),
                                  }
                                : previous,
                            )
                          }
                        />
                      </label>
                      <button
                        className="text-button"
                        type="button"
                        disabled={busy}
                        onClick={() => void applyManualId(row.sourceShowId)}
                      >
                        {copy.applyManual}
                      </button>
                    </div>
                    {manualErrorByShow[row.sourceShowId] ? (
                      <p className="form-error" role="alert">
                        {manualErrorByShow[row.sourceShowId]}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="settings-import-review-actions">
                <button
                  className="primary-button"
                  type="button"
                  disabled={busy}
                  data-testid="tv-time-import-continue"
                  onClick={() => void continueAfterReview()}
                >
                  {busy ? copy.running : copy.continueImport}
                </button>
                <button
                  className="text-button"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setPendingZip(null);
                    resetTransient();
                  }}
                >
                  {copy.cancelReview}
                </button>
              </div>
            </div>
          ) : null}

          {status && !inReview ? (
            <div
              className={`settings-import-status${showLiveStatus ? " is-live" : ""}`}
              data-testid="tv-time-import-status"
              aria-live="polite"
            >
              <p className="settings-note" data-testid="tv-time-import-message">
                {status}
              </p>
              {progress.phase === "importing" && progress.episodesTotal > 0 ? (
                <div
                  className="settings-import-progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={progress.episodesTotal}
                  aria-valuenow={progress.job?.episodesImported ?? 0}
                >
                  <span
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (((progress.job?.episodesImported ?? 0) +
                            (progress.job?.episodesSkipped ?? 0) +
                            (progress.job?.episodesFailed ?? 0)) /
                            progress.episodesTotal) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {skippedNote && progress.phase === "done" ? (
            <p className="settings-note" data-testid="tv-time-import-skipped">
              {skippedNote}
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
