"""Generate EpisodEra-compatible import CSVs from TV Time normalized exports.

Outputs:
- episodes_import.csv  -> maps to POST /progress/:showId/episodes/batch
- watchlist_import.csv -> maps to POST /watchlist
- import_report.json -> validation summary
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from tv_time_import_common import (
    episode_key_for,
    integer,
    read_csv,
    truthy,
    write_csv,
)

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_COMBINED = REPO_ROOT / "tv_time" / "combined"
DEFAULT_MAPPING = REPO_ROOT / "tv_time" / "import" / "show_mapping.csv"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "tv_time" / "import"

EPISODE_FIELDS = [
    "tmdbId",
    "mediaType",
    "seasonNumber",
    "episodeNumber",
    "episodeKey",
    "watchedAt",
    "seriesName",
    "sourceShowId",
    "sourceEpisodeId",
    "bulkType",
    "isSpecial",
]

WATCHLIST_FIELDS = [
    "itemId",
    "tmdbId",
    "mediaType",
    "title",
    "poster",
    "backdrop",
    "status",
    "watchedEpisodeCount",
    "sourceShowId",
    "tvShowName",
]

SKIPPED_EPISODE_FIELDS = [
    "tv_time_show_id",
    "series_name",
    "season_number",
    "episode_number",
    "reason",
    "sourceEpisodeId",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--combined-dir", type=Path, default=DEFAULT_COMBINED)
    parser.add_argument("--mapping", type=Path, default=DEFAULT_MAPPING)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--min-confidence", type=float, default=0.82)
    parser.add_argument("--include-season-zero", action="store_true")
    parser.add_argument("--include-episode-zero", action="store_true")
    return parser.parse_args()


def parse_timestamp(value: str) -> str:
    if not value:
        return ""
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(value[:19], fmt).strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            continue
    return ""


def accepted_mapping_rows(rows: list[dict[str, str]], min_confidence: float) -> dict[str, dict[str, str]]:
    accepted: dict[str, dict[str, str]] = {}
    for row in rows:
        show_id = row.get("tv_time_show_id", "")
        tmdb_id = row.get("tmdb_id", "").strip()
        confidence = float(row.get("confidence") or 0)
        method = row.get("match_method", "")
        if not show_id or not tmdb_id:
            continue
        if confidence < min_confidence:
            continue
        if method == "ambiguous" and confidence < 0.9:
            continue
        accepted[show_id] = row
    return accepted


def watchlist_status(show: dict[str, str], watched_count: int) -> str:
    if watched_count > 0:
        return "watching"
    if truthy(show.get("is_followed")):
        return "planned"
    return "planned"


def main() -> None:
    args = parse_args()
    shows_path = args.combined_dir / "normalized" / "shows.csv"
    episodes_path = args.combined_dir / "normalized" / "episodes.csv"

    for path in (shows_path, episodes_path, args.mapping):
        if not path.is_file():
            raise SystemExit(f"Required file not found: {path}")

    _, shows = read_csv(shows_path)
    _, episodes = read_csv(episodes_path)
    _, mapping_rows = read_csv(args.mapping)
    mapping_by_show = accepted_mapping_rows(mapping_rows, args.min_confidence)
    shows_by_id = {row["tv_time_show_id"]: row for row in shows}

    episode_rows: list[dict[str, object]] = []
    skipped_rows: list[dict[str, object]] = []
    watched_by_show: Counter[str] = Counter()

    for episode in episodes:
        show_id = episode["tv_time_show_id"]
        season_number = integer(episode.get("season_number"))
        episode_number = integer(episode.get("episode_number"))

        if season_number <= 0 and not args.include_season_zero:
            skipped_rows.append({**episode, "reason": "season_zero"})
            continue
        if episode_number <= 0 and not args.include_episode_zero:
            skipped_rows.append({**episode, "reason": "episode_zero"})
            continue

        mapping = mapping_by_show.get(show_id)
        if not mapping:
            skipped_rows.append({**episode, "reason": "unmapped_show"})
            continue

        tmdb_id = int(mapping["tmdb_id"])
        episode_rows.append(
            {
                "tmdbId": tmdb_id,
                "mediaType": "tv",
                "seasonNumber": season_number,
                "episodeNumber": episode_number,
                "episodeKey": episode_key_for(season_number, episode_number),
                "watchedAt": parse_timestamp(episode.get("first_recorded_at", "")),
                "seriesName": mapping.get("tmdb_title") or episode.get("series_name", ""),
                "sourceShowId": show_id,
                "sourceEpisodeId": episode.get("tv_time_episode_id", ""),
                "bulkType": episode.get("bulk_type", ""),
                "isSpecial": episode.get("is_special", ""),
            }
        )
        watched_by_show[str(tmdb_id)] += 1

    episode_rows.sort(
        key=lambda row: (
            int(row["tmdbId"]),
            int(row["seasonNumber"]),
            int(row["episodeNumber"]),
        )
    )

    watchlist_rows: list[dict[str, object]] = []
    for show_id, show in shows_by_id.items():
        mapping = mapping_by_show.get(show_id)
        if not mapping:
            continue
        tmdb_id = int(mapping["tmdb_id"])
        watched_count = watched_by_show.get(str(tmdb_id), 0)
        if not truthy(show.get("is_followed")) and watched_count == 0:
            continue
        watchlist_rows.append(
            {
                "itemId": f"tv_{tmdb_id}",
                "tmdbId": tmdb_id,
                "mediaType": "tv",
                "title": mapping.get("tmdb_title") or show.get("tv_show_name", ""),
                "poster": mapping.get("poster", ""),
                "backdrop": mapping.get("backdrop", ""),
                "status": watchlist_status(show, watched_count),
                "watchedEpisodeCount": watched_count,
                "sourceShowId": show_id,
                "tvShowName": show.get("tv_show_name", ""),
            }
        )

    watchlist_rows.sort(key=lambda row: str(row["title"]).casefold())

    args.output_dir.mkdir(parents=True, exist_ok=True)
    write_csv(args.output_dir / "episodes_import.csv", EPISODE_FIELDS, episode_rows)
    write_csv(args.output_dir / "watchlist_import.csv", WATCHLIST_FIELDS, watchlist_rows)
    write_csv(args.output_dir / "skipped_episodes.csv", SKIPPED_EPISODE_FIELDS, skipped_rows)

    episodes_by_show: dict[int, list[dict[str, object]]] = defaultdict(list)
    for row in episode_rows:
        episodes_by_show[int(row["tmdbId"])].append(row)

    batch_plan = {
        str(tmdb_id): {
            "episodeCount": len(rows),
            "batchCount": (len(rows) + 99) // 100,
        }
        for tmdb_id, rows in sorted(episodes_by_show.items(), key=lambda item: item[0])
    }

    skip_reasons = Counter(str(row["reason"]) for row in skipped_rows)
    report = {
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "shows_in_mapping": len(mapping_rows),
        "accepted_mappings": len(mapping_by_show),
        "watchlist_rows": len(watchlist_rows),
        "episode_rows": len(episode_rows),
        "skipped_episodes": len(skipped_rows),
        "skip_reasons": dict(skip_reasons),
        "unique_tmdb_shows_with_progress": len(episodes_by_show),
        "api_batch_plan": {
            "shows": len(episodes_by_show),
            "total_batches": sum(item["batchCount"] for item in batch_plan.values()),
        },
        "notes": [
            "watchedAt is included for reference; the current EpisodEra API uses server timestamps on batch mark.",
            "Import with POST /watchlist and POST /progress/:showId/episodes/batch (max 100 episodes per batch).",
        ],
        "output_files": {
            "episodes_import": str(args.output_dir / "episodes_import.csv"),
            "watchlist_import": str(args.output_dir / "watchlist_import.csv"),
            "skipped_episodes": str(args.output_dir / "skipped_episodes.csv"),
        },
    }
    (args.output_dir / "import_report.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (args.output_dir / "batch_plan.json").write_text(
        json.dumps(batch_plan, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
