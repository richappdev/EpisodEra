import {strToU8, zipSync} from "fflate";
import {UserDataExport} from "../types/export";

const dateStamp = (iso: string): string => {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return new Date().toISOString().slice(0, 10);
  }
  return new Date(parsed).toISOString().slice(0, 10);
};

export const buildExportZipFilename = (exportedAt: string): string =>
  `episodera-export-${dateStamp(exportedAt)}.zip`;

export const buildExportZipBytes = (payload: UserDataExport): Uint8Array => {
  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

  return zipSync(
    {
      "manifest.json": strToU8(json(payload.manifest)),
      "history.json": strToU8(json(payload.history)),
      "progress.json": strToU8(json(payload.progress)),
      "watchlist.json": strToU8(json(payload.watchlist)),
    },
    {level: 6},
  );
};

export const triggerBrowserDownload = (bytes: Uint8Array, filename: string) => {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([ab], {
    type: "application/zip",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
