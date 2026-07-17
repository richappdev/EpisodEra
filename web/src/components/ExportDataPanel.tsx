import {Download} from "lucide-react";
import {useState} from "react";
import {api} from "../api/client";
import {
  buildExportZipBytes,
  buildExportZipFilename,
  triggerBrowserDownload,
} from "../lib/exportZip";
import {SupportedLanguage} from "../types/settings";

interface ExportDataPanelProps {
  language: SupportedLanguage;
  signedIn: boolean;
}

const copyByLanguage = {
  "en-US": {
    title: "Export your data",
    note: "Download a ZIP of your watching history, show progress, and watchlist. Files use EpisodEra’s TMDb-based JSON format (schema version 1).",
    signedOut: "Sign in to export your watching history.",
    start: "Download export",
    running: "Preparing export…",
    success: (counts: {history: number; progressShows: number; watchlist: number}) =>
      `Exported ${counts.history} history entries, ${counts.progressShows} shows, and ${counts.watchlist} watchlist items.`,
    failed: "Could not export your data. Try again.",
  },
  "zh-TW": {
    title: "匯出你的資料",
    note: "下載包含觀看紀錄、劇集進度與待看清單的 ZIP。檔案採用 EpisodEra 以 TMDb 為主的 JSON 格式（schema 版本 1）。",
    signedOut: "請登入後才能匯出觀看紀錄。",
    start: "下載匯出檔",
    running: "正在準備匯出…",
    success: (counts: {history: number; progressShows: number; watchlist: number}) =>
      `已匯出 ${counts.history} 筆觀看紀錄、${counts.progressShows} 部劇集進度，以及 ${counts.watchlist} 個待看項目。`,
    failed: "無法匯出資料，請再試一次。",
  },
} as const;

export const ExportDataPanel = ({language, signedIn}: ExportDataPanelProps) => {
  const copy = copyByLanguage[language] ?? copyByLanguage["en-US"];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startExport = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const payload = await api.meExport();
      const bytes = buildExportZipBytes(payload);
      triggerBrowserDownload(bytes, buildExportZipFilename(payload.manifest.exportedAt));
      setMessage(
        copy.success({
          history: payload.manifest.counts.history,
          progressShows: payload.manifest.counts.progressShows,
          watchlist: payload.manifest.counts.watchlist,
        }),
      );
    } catch {
      setError(copy.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="settings-group" aria-labelledby="export-data-title">
      <div className="settings-group-heading">
        <Download size={18} aria-hidden="true" />
        <h3 id="export-data-title">{copy.title}</h3>
      </div>
      <p className="settings-note">{copy.note}</p>
      {!signedIn ? (
        <p className="settings-note">{copy.signedOut}</p>
      ) : (
        <>
          <button
            className="primary-button"
            type="button"
            disabled={busy}
            data-testid="export-data-start"
            onClick={() => void startExport()}
          >
            {busy ? copy.running : copy.start}
          </button>
          {message ? (
            <p className="settings-note" data-testid="export-data-success">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="form-error" role="alert" data-testid="export-data-error">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
};
