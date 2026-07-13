"""Combine TV Time GDPR ZIP exports without losing source provenance.

The generated archive is still private: raw merged CSV files retain credentials,
tokens, IP addresses, and other personal data from the source exports.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import shutil
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inputs", nargs="+", type=Path, help="TV Time GDPR ZIP exports")
    parser.add_argument("--primary", type=Path, required=True, help="Export whose values win conflicts")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--output-zip", type=Path, required=True)
    return parser.parse_args()


def read_csv(archive: zipfile.ZipFile, name: str) -> tuple[list[str], list[dict[str, str]]]:
    text = archive.read(name).decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    return list(reader.fieldnames or []), list(reader)


def write_csv(path: Path, fieldnames: list[str], rows: Iterable[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def truthy(value: str | None) -> bool:
    return str(value).lower() in {"1", "true", "yes"}


def integer(value: str | None) -> int:
    try:
        return int(value or 0)
    except ValueError:
        return 0


def ordered_union(groups: Iterable[Iterable[str]]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for group in groups:
        for value in group:
            if value not in seen:
                seen.add(value)
                result.append(value)
    return result


def episode_key(row: dict[str, str]) -> tuple[str, ...]:
    if row.get("ep_id"):
        return ("id", row["ep_id"])
    return (
        "coordinate",
        row.get("s_id", ""),
        row.get("season_number") or row.get("s_no", ""),
        row.get("episode_number") or row.get("ep_no", ""),
    )


def main() -> None:
    args = parse_args()
    inputs = [path.resolve() for path in args.inputs]
    primary = args.primary.resolve()
    if primary not in inputs:
        raise SystemExit("--primary must also appear in inputs")
    if len(set(inputs)) != len(inputs):
        raise SystemExit("Duplicate input archive")
    for path in inputs:
        if not path.is_file():
            raise SystemExit(f"Input archive not found: {path}")

    output_dir = args.output_dir.resolve()
    output_zip = args.output_zip.resolve()
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True)
    output_zip.unlink(missing_ok=True)

    ordered_inputs = [primary, *(path for path in inputs if path != primary)]
    aliases = {path: ("primary" if path == primary else f"legacy-{index}") for index, path in enumerate(ordered_inputs) if path != primary}
    aliases[primary] = "primary"

    archives = {path: zipfile.ZipFile(path) for path in ordered_inputs}
    try:
        csv_names = sorted({name for archive in archives.values() for name in archive.namelist() if name.lower().endswith(".csv")})
        raw_counts: dict[str, dict[str, int]] = defaultdict(dict)
        all_rows: dict[str, list[dict[str, str]]] = {}

        for name in csv_names:
            headers: list[list[str]] = []
            merged_rows: list[dict[str, str]] = []
            for path in ordered_inputs:
                archive = archives[path]
                if name not in archive.namelist():
                    raw_counts[name][aliases[path]] = 0
                    continue
                header, rows = read_csv(archive, name)
                headers.append(header)
                raw_counts[name][aliases[path]] = len(rows)
                for row in rows:
                    merged_rows.append({**row, "source_account": aliases[path]})
            fields = ["source_account", *ordered_union(headers)]
            write_csv(output_dir / "raw-merged" / name, fields, merged_rows)
            all_rows[name] = merged_rows

        tracking = [row for row in all_rows.get("tracking-prod-records-v2.csv", []) if row.get("ep_id")]
        grouped_episodes: dict[tuple[str, ...], list[dict[str, str]]] = defaultdict(list)
        for row in tracking:
            grouped_episodes[episode_key(row)].append(row)

        normalized_episodes: list[dict[str, object]] = []
        episode_counts_by_show: Counter[str] = Counter()
        duplicate_episode_groups = 0
        for rows in grouped_episodes.values():
            if len(rows) > 1:
                duplicate_episode_groups += 1
            preferred = next((row for row in rows if row["source_account"] == "primary"), rows[0])
            show_id = preferred.get("s_id", "")
            episode_counts_by_show[show_id] += 1
            created = sorted(row["created_at"] for row in rows if row.get("created_at"))
            updated = sorted(row["updated_at"] for row in rows if row.get("updated_at"))
            normalized_episodes.append({
                "tv_time_show_id": show_id,
                "tv_time_episode_id": preferred.get("ep_id", ""),
                "series_name": preferred.get("series_name", ""),
                "season_number": preferred.get("season_number") or preferred.get("s_no", ""),
                "episode_number": preferred.get("episode_number") or preferred.get("ep_no", ""),
                "first_recorded_at": created[0] if created else "",
                "last_updated_at": updated[-1] if updated else "",
                "runtime_seconds": preferred.get("runtime", ""),
                "is_special": "true" if any(truthy(row.get("is_special")) for row in rows) else "false",
                "bulk_type": preferred.get("bulk_type", ""),
                "source_accounts": ";".join(sorted({row["source_account"] for row in rows})),
                "source_record_count": len(rows),
            })
        normalized_episodes.sort(key=lambda row: (
            str(row["series_name"]).casefold(),
            integer(str(row["season_number"])),
            integer(str(row["episode_number"])),
        ))
        episode_fields = [
            "tv_time_show_id", "tv_time_episode_id", "series_name", "season_number", "episode_number",
            "first_recorded_at", "last_updated_at", "runtime_seconds", "is_special", "bulk_type",
            "source_accounts", "source_record_count",
        ]
        write_csv(output_dir / "normalized" / "episodes.csv", episode_fields, normalized_episodes)

        show_rows = all_rows.get("user_tv_show_data.csv", [])
        grouped_shows: dict[str, list[dict[str, str]]] = defaultdict(list)
        for row in show_rows:
            grouped_shows[row.get("tv_show_id", "")].append(row)
        user_show_ids = set(grouped_shows)
        tracker_show_rows: dict[str, list[dict[str, str]]] = defaultdict(list)
        for row in all_rows.get("tracking-prod-records-v2.csv", []):
            if row.get("s_id") and not row.get("ep_id") and row.get("is_followed") != "":
                tracker_show_rows[row["s_id"]].append(row)
        for show_id, rows in tracker_show_rows.items():
            if show_id not in grouped_shows:
                grouped_shows[show_id].extend({
                    "tv_show_id": show_id,
                    "tv_show_name": row.get("series_name", ""),
                    "is_followed": row.get("is_followed", ""),
                    "is_favorited": "0",
                    "nb_episodes_seen": row.get("ep_watch_count", ""),
                    "source_account": row["source_account"],
                } for row in rows)
        normalized_shows: list[dict[str, object]] = []
        for show_id, rows in grouped_shows.items():
            preferred = next((row for row in rows if row["source_account"] == "primary"), rows[0])
            reported_counts = [integer(row.get("nb_episodes_seen")) for row in rows]
            reported_counts.extend(integer(row.get("ep_watch_count")) for row in tracker_show_rows.get(show_id, []))
            source_accounts = {row["source_account"] for row in rows}
            source_accounts.update(row["source_account"] for row in tracker_show_rows.get(show_id, []))
            normalized_shows.append({
                "tv_time_show_id": show_id,
                "tv_show_name": preferred.get("tv_show_name", ""),
                "is_followed": "true" if any(truthy(row.get("is_followed")) for row in rows) else "false",
                "is_favorited": "true" if any(truthy(row.get("is_favorited")) for row in rows) else "false",
                "derived_unique_episode_count": episode_counts_by_show[show_id],
                "maximum_reported_episode_count": max(reported_counts),
                "source_accounts": ";".join(sorted(source_accounts)),
                "source_record_count": (len(rows) if show_id in user_show_ids else 0) + len(tracker_show_rows.get(show_id, [])),
            })
        normalized_shows.sort(key=lambda row: str(row["tv_show_name"]).casefold())
        show_fields = [
            "tv_time_show_id", "tv_show_name", "is_followed", "is_favorited",
            "derived_unique_episode_count", "maximum_reported_episode_count",
            "source_accounts", "source_record_count",
        ]
        write_csv(output_dir / "normalized" / "shows.csv", show_fields, normalized_shows)

        input_manifest = []
        for path in ordered_inputs:
            input_manifest.append({
                "source_account": aliases[path],
                "archive_name": path.name,
                "sha256": sha256(path),
                "size_bytes": path.stat().st_size,
            })
        summary = {
            "format_version": 1,
            "primary_source_account": "primary",
            "inputs": input_manifest,
            "raw_csv_file_count": len(csv_names),
            "raw_row_counts": raw_counts,
            "normalized": {
                "shows": len(normalized_shows),
                "followed_shows": sum(row["is_followed"] == "true" for row in normalized_shows),
                "shows_with_watched_episodes": sum(integer(str(row["derived_unique_episode_count"])) > 0 for row in normalized_shows),
                "unique_episodes": len(normalized_episodes),
                "cross_account_duplicate_episode_groups": duplicate_episode_groups,
                "season_zero_episodes": sum(str(row["season_number"]) == "0" for row in normalized_episodes),
                "episode_zero_episodes": sum(str(row["episode_number"]) == "0" for row in normalized_episodes),
            },
        }
        (output_dir / "manifest.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        readme = """# Combined TV Time GDPR export

This private dataset combines all source CSV rows without discarding account provenance.

## Contents

- `raw-merged/`: every row from every source CSV, with a `source_account` column.
- `normalized/episodes.csv`: deduplicated watched episodes. The primary row supplies metadata, while `first_recorded_at` preserves the earliest timestamp across accounts.
- `normalized/shows.csv`: one row per TV Time show ID, with unioned followed/favorite states and episode counts derived from the deduplicated episode data.
- `manifest.json`: source hashes, row counts, aliases, and validation totals.

## Important

The raw merged files still contain access tokens, refresh tokens, authentication hashes, email addresses, IP/geolocation history, and device identifiers. Keep this directory and its ZIP private. The normalized files omit those fields but still describe personal viewing history.

TV Time IDs are not assumed to be TMDb IDs. Resolve show IDs to canonical TMDb metadata before importing into Episodera. `first_recorded_at` is the earliest time an episode was recorded in TV Time and is not guaranteed to be the actual viewing time.
"""
        (output_dir / "README.md").write_text(readme, encoding="utf-8")

        with zipfile.ZipFile(output_zip, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as combined:
            for path in sorted(output_dir.rglob("*")):
                if path.is_file():
                    combined.write(path, path.relative_to(output_dir.parent).as_posix())
    finally:
        for archive in archives.values():
            archive.close()

    print(json.dumps(summary["normalized"], indent=2))
    print(f"Output directory: {output_dir}")
    print(f"Output archive: {output_zip}")


if __name__ == "__main__":
    main()
