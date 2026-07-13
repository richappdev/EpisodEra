"""Analyze combined TV Time GDPR export (no PII in stdout)."""

from __future__ import annotations

import csv
from collections import Counter
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parents[1] / "tv_time" / "combined"


def main() -> None:
    shows: dict[str, dict[str, str]] = {}
    with (BASE / "normalized/shows.csv").open(encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            shows[row["tv_time_show_id"]] = row

    episodes: list[dict[str, str]] = []
    with (BASE / "normalized/episodes.csv").open(encoding="utf-8-sig") as handle:
        episodes = list(csv.DictReader(handle))

    print("=== VIEWING SUMMARY ===")
    print(f"Unique episodes watched: {len(episodes)}")
    print(f"Shows tracked: {len(shows)}")
    followed = sum(1 for s in shows.values() if s.get("is_followed", "").lower() == "true")
    favorited = sum(1 for s in shows.values() if s.get("is_favorited", "").lower() == "true")
    with_eps = sum(1 for s in shows.values() if int(s.get("derived_unique_episode_count") or 0) > 0)
    print(f"Followed shows: {followed}")
    print(f"Favorited shows: {favorited}")
    print(f"Shows with watch history: {with_eps}")

    total_runtime = sum(int(ep.get("runtime_seconds") or 0) for ep in episodes)
    print(f"Total episode runtime: {total_runtime // 3600}h {(total_runtime % 3600) // 60}m")

    dates: list[datetime] = []
    for ep in episodes:
        raw = ep.get("first_recorded_at", "")
        if raw:
            try:
                dates.append(datetime.strptime(raw[:19], "%Y-%m-%d %H:%M:%S"))
            except ValueError:
                pass
    if dates:
        dates.sort()
        print(f"Watch records span: {dates[0].date()} to {dates[-1].date()}")
        by_year = Counter(d.year for d in dates)
        print("Records by year:", dict(sorted(by_year.items())))
        by_month = Counter((d.year, d.month) for d in dates)
        top_months = sorted(by_month.items(), key=lambda item: -item[1])[:8]
        print("Busiest months:", [f"{y}-{m:02d}({c})" for (y, m), c in top_months])

    top = sorted(shows.values(), key=lambda s: int(s.get("derived_unique_episode_count") or 0), reverse=True)[:20]
    print("\nTop 20 shows by episodes:")
    for show in top:
        count = int(show.get("derived_unique_episode_count") or 0)
        if count > 0:
            print(f"  {count:4d}  {show['tv_show_name']}")

    bulk = Counter(ep.get("bulk_type", "") for ep in episodes)
    print("\nHow episodes were marked:", dict(bulk))
    special = sum(1 for ep in episodes if ep.get("is_special", "").lower() == "true")
    print(f"Special episodes: {special}")
    cross = sum(1 for ep in episodes if "," in (ep.get("source_accounts") or ""))
    print(f"Episodes seen in both accounts: {cross}")

    print("\n=== ACCOUNT TIMELINE ===")
    with (BASE / "raw-merged/user_statistics.csv").open(encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            acct = row["source_account"]
            print(
                f"  {acct}: joined {row['created_at'][:10]}, "
                f"shows_followed={row['nb_shows_followed']}, time_spent={row['time_spent']}min"
            )

    with (BASE / "raw-merged/tracking-prod-records-v2.csv").open(encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            if row.get("key") == "tracking-stats" and row["source_account"] == "primary":
                movie_rt = int(row.get("total_movies_runtime") or 0)
                series_rt = int(row.get("total_series_runtime") or 0)
                print(
                    f"  Primary tracking-stats: {row['ep_watch_count']} eps, "
                    f"{row['movie_watch_count']} movies"
                )
                print(
                    f"    Series runtime: {series_rt // 3600}h, "
                    f"Movie runtime: {movie_rt // 60}min, Followed: {row['series_follow_count']}"
                )
                break

    print("\n=== SOCIAL ACTIVITY ===")
    with (BASE / "raw-merged/comments-prod-comments.csv").open(encoding="utf-8-sig") as handle:
        comments = list(csv.DictReader(handle))
    likes = sum(1 for comment in comments if comment.get("type") == "like")
    print(f"Comment likes: {likes}, total comment records: {len(comments)}")

    with (BASE / "raw-merged/user_badge.csv").open(encoding="utf-8-sig") as handle:
        badges = list(csv.DictReader(handle))
    print(f"Badges earned: {len(badges)}")
    badge_types = Counter(
        badge["badge_id"].split("-")[1] if "-" in badge["badge_id"] else badge["badge_id"]
        for badge in badges
    )
    print("Badge types:", dict(badge_types))

    print("\n=== PLATFORMS ===")
    with (BASE / "raw-merged/user_platform.csv").open(encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            print(
                f"  {row['source_account']}: platform={row.get('platform', '?')}, "
                f"app_version={row.get('app_version', '?')}"
            )

    with (BASE / "raw-merged/user_device.csv").open(encoding="utf-8-sig") as handle:
        devices = list(csv.DictReader(handle))
    print(f"Devices registered: {len(devices)}")

    print("\n=== ENGAGEMENT (addiction scores) ===")
    with (BASE / "raw-merged/show_addiction_score.csv").open(encoding="utf-8-sig") as handle:
        addiction = [row for row in csv.DictReader(handle) if row["source_account"] == "primary"]
    print(f"Shows with addiction scores: {len(addiction)}")
    top_add = sorted(addiction, key=lambda row: int(row.get("monthly_score") or 0), reverse=True)[:10]
    for row in top_add:
        ts = int(row.get("last_action_timestamp") or 0)
        dt = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d") if ts else "?"
        print(f"  {row['tv_show_name']}: daily={row['daily_score']}, last_action={dt}")

    with (BASE / "raw-merged/emotions-3-prod-episode_votes.csv").open(encoding="utf-8-sig") as handle:
        emotions = list(csv.DictReader(handle))
    with (BASE / "raw-merged/ratings-3-prod-episode_votes.csv").open(encoding="utf-8-sig") as handle:
        ratings = list(csv.DictReader(handle))
    print(f"\nEpisode emotion votes: {len(emotions)}, ratings: {len(ratings)}")

    with (BASE / "raw-merged/user_connection.csv").open(encoding="utf-8-sig") as handle:
        connections = list(csv.DictReader(handle))
    with (BASE / "raw-merged/ip_address.csv").open(encoding="utf-8-sig") as handle:
        ips = list(csv.DictReader(handle))
    print(f"User connections: {len(connections)}")
    print(f"IP address log entries: {len(ips)}")

    # Data inventory
    print("\n=== EXPORT DATA INVENTORY ===")
    manifest = __import__("json").loads((BASE / "manifest.json").read_text(encoding="utf-8"))
    totals = Counter()
    for filename, counts in manifest["raw_row_counts"].items():
        totals[filename] = sum(counts.values())
    categories = {
        "Viewing/tracking": ["tracking-prod-records-v2.csv", "show_seen_episode_latest.csv", "seen_episode_latest.csv"],
        "Shows/follows": ["followed_tv_show.csv", "user_tv_show_data.csv", "show_addiction_score.csv"],
        "Account/profile": ["user.csv", "user_statistics.csv", "user_setting.csv", "user_social_data.csv"],
        "Auth/security": ["access_token.csv", "refresh_token.csv", "auth-prod-login.csv", "mail_validation_token.csv"],
        "Social": ["comments-prod-comments.csv", "user_connection.csv", "user_badge.csv"],
        "Device/tracking": ["user_device.csv", "device_data.csv", "ip_address.csv", "install_tracking.csv"],
        "Engagement": ["emotions-3-prod-episode_votes.csv", "ratings-3-prod-episode_votes.csv"],
    }
    for category, files in categories.items():
        count = sum(totals.get(f, 0) for f in files)
        print(f"  {category}: {count} rows across {len(files)} tables")


if __name__ == "__main__":
    main()
