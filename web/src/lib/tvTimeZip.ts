import {unzipSync, strFromU8} from "fflate";

const REQUIRED_MEMBERS = ["tracking-prod-records-v2.csv", "user_tv_show_data.csv"] as const;

export type TvTimeZipMemberName = (typeof REQUIRED_MEMBERS)[number];

export interface TvTimeZipCsvs {
  tracking: string;
  shows: string;
}

const basename = (path: string): string => {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? normalized;
};

export const findZipMemberByBasename = (
  names: string[],
  targetBasename: string,
): string | null => {
  const target = targetBasename.toLowerCase();
  const matches = names.filter((name) => basename(name).toLowerCase() === target && !name.endsWith("/"));
  if (matches.length === 0) {
    return null;
  }
  matches.sort((left, right) => left.length - right.length || left.localeCompare(right));
  return matches[0];
};

export const extractTvTimeCsvsFromZip = (bytes: ArrayBuffer | Uint8Array): TvTimeZipCsvs => {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(input);
  } catch {
    throw new Error("Could not read ZIP archive. Choose a TV Time GDPR export .zip file.");
  }

  const names = Object.keys(archive);
  const trackingPath = findZipMemberByBasename(names, REQUIRED_MEMBERS[0]);
  const showsPath = findZipMemberByBasename(names, REQUIRED_MEMBERS[1]);

  if (!trackingPath || !showsPath) {
    const missing = [
      !trackingPath ? REQUIRED_MEMBERS[0] : null,
      !showsPath ? REQUIRED_MEMBERS[1] : null,
    ].filter(Boolean);
    throw new Error(
      `ZIP is missing required TV Time export files: ${missing.join(", ")}.`,
    );
  }

  const decode = (data: Uint8Array) => strFromU8(data).replace(/^\uFEFF/, "");

  return {
    tracking: decode(archive[trackingPath]),
    shows: decode(archive[showsPath]),
  };
};
