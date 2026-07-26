import {ImportReport, ImportReportRow} from "../types/import";

const csvEscape = (value: string | number | null | undefined): string => {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const rowToCsv = (row: ImportReportRow): string =>
  [
    row.kind,
    row.title,
    row.tmdbId,
    row.seasonNumber,
    row.episodeNumber,
    row.reason,
    row.sourceShowId,
  ]
    .map(csvEscape)
    .join(",");

export const importReportHasDownloadableRows = (report: ImportReport | null | undefined): boolean => {
  if (!report) {
    return false;
  }
  return (
    report.rows.length > 0 ||
    report.failedEpisodeCount > 0 ||
    report.skippedEpisodeCount > 0 ||
    report.skippedShowCount > 0
  );
};

export const buildImportReportCsv = (report: ImportReport): string => {
  const header = "kind,title,tmdbId,seasonNumber,episodeNumber,reason,sourceShowId";
  return `${[header, ...report.rows.map(rowToCsv)].join("\n")}\n`;
};

export const buildImportReportFilename = (importId: string, generatedAt?: string | null): string => {
  const stamp = generatedAt && !Number.isNaN(Date.parse(generatedAt))
    ? new Date(generatedAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const shortId = importId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 8) || "import";
  return `episodera-import-report-${shortId}-${stamp}.csv`;
};

export const downloadImportReportCsv = (report: ImportReport, importId: string) => {
  const csv = buildImportReportCsv(report);
  const blob = new Blob([csv], {type: "text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildImportReportFilename(importId, report.generatedAt);
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
