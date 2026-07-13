"""Resolve TV Time show names to TMDb TV IDs for EpisodEra import.

Reads `tv_time/combined/normalized/shows.csv`, searches TMDb (directly or via
the deployed EpisodEra `/search` proxy), and writes a reviewable mapping CSV.
Manual overrides take precedence.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Protocol

sys.path.insert(0, str(Path(__file__).resolve().parent))

from tv_time_import_common import (
    backdrop_url,
    load_env_file,
    normalize_title,
    poster_url,
    read_csv,
    write_csv,
)

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SHOWS = REPO_ROOT / "tv_time" / "combined" / "normalized" / "shows.csv"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "tv_time" / "import"
DEFAULT_ENV = REPO_ROOT / ".env"
DEFAULT_OVERRIDES = DEFAULT_OUTPUT_DIR / "show_overrides.csv"
DEFAULT_CACHE = DEFAULT_OUTPUT_DIR / "tmdb_search_cache.json"
DEFAULT_EPISODERA_API = "https://api-m74gmd4u4a-uc.a.run.app"
TMDB_BASE_URL = "https://api.themoviedb.org/3"
REQUEST_DELAY_SECONDS = 0.26

MAPPING_FIELDS = [
    "tv_time_show_id",
    "tv_show_name",
    "tmdb_id",
    "tmdb_title",
    "tmdb_original_title",
    "first_air_date",
    "poster",
    "backdrop",
    "match_method",
    "confidence",
    "search_query",
    "candidate_count",
    "notes",
]

OVERRIDE_FIELDS = ["tv_time_show_id", "tmdb_id", "note"]

DEFAULT_OVERRIDES_ROWS = [
    {"tv_time_show_id": "296654", "tmdb_id": "64481", "note": "Criminal Minds: Beyond Borders"},
    {"tv_time_show_id": "168151", "tmdb_id": "32200", "note": "Criminal Minds: Suspect Behavior"},
    {"tv_time_show_id": "383837", "tmdb_id": "104699", "note": "Shaman King (2021)"},
    {"tv_time_show_id": "339203", "tmdb_id": "77240", "note": "Captain Tsubasa (2018)"},
    {"tv_time_show_id": "252322", "tmdb_id": "46298", "note": "Hunter x Hunter (2011)"},
    {"tv_time_show_id": "72454", "tmdb_id": "30983", "note": "Detective Conan"},
    {"tv_time_show_id": "415311", "tmdb_id": "210955", "note": "First Love (2022)"},
    {"tv_time_show_id": "367146", "tmdb_id": "88329", "note": "Hawkeye (2021)"},
    {"tv_time_show_id": "421649", "tmdb_id": "240667", "note": "One Day (2024)"},
    {"tv_time_show_id": "321462", "tmdb_id": "69857", "note": "Quartet (2017)"},
    {"tv_time_show_id": "440481", "tmdb_id": "236532", "note": "The Strongest Tank's Labyrinth Raids"},
    {"tv_time_show_id": "281714", "tmdb_id": "62517", "note": "Ballers"},
]


@dataclass(frozen=True)
class TmdbCandidate:
    id: int
    name: str
    original_name: str
    first_air_date: str
    poster_path: str | None
    backdrop_path: str | None
    popularity: float
    poster: str | None = None
    backdrop: str | None = None

    def resolved_poster(self) -> str:
        return self.poster or poster_url(self.poster_path) or ""

    def resolved_backdrop(self) -> str:
        return self.backdrop or backdrop_url(self.backdrop_path) or ""


@dataclass(frozen=True)
class MatchResult:
    candidate: TmdbCandidate | None
    confidence: float
    method: str
    search_query: str
    candidate_count: int
    notes: str


class LookupClient(Protocol):
    def search_tv(self, query: str, *, year: int | None = None) -> list[TmdbCandidate]: ...

    def tv_detail(self, tmdb_id: int) -> TmdbCandidate: ...


class CachedLookupClient:
    def __init__(self, inner: LookupClient, cache_path: Path, refresh: bool = False) -> None:
        self.inner = inner
        self.cache_path = cache_path
        self.refresh = refresh
        self.cache: dict[str, list[dict[str, object]]] = {}
        if cache_path.is_file():
            self.cache = json.loads(cache_path.read_text(encoding="utf-8"))

    def search_tv(self, query: str, *, year: int | None = None) -> list[TmdbCandidate]:
        cache_key = f"search_tv:{query}:{year or ''}"
        if not self.refresh and cache_key in self.cache:
            return [candidate_from_dict(item) for item in self.cache[cache_key]]
        candidates = self.inner.search_tv(query, year=year)
        self.cache[cache_key] = [candidate_to_dict(item) for item in candidates]
        self._save_cache()
        time.sleep(REQUEST_DELAY_SECONDS)
        return candidates

    def tv_detail(self, tmdb_id: int) -> TmdbCandidate:
        cache_key = f"tv_detail:{tmdb_id}"
        if not self.refresh and cache_key in self.cache and self.cache[cache_key]:
            return candidate_from_dict(self.cache[cache_key][0])
        candidate = self.inner.tv_detail(tmdb_id)
        self.cache[cache_key] = [candidate_to_dict(candidate)]
        self._save_cache()
        time.sleep(REQUEST_DELAY_SECONDS)
        return candidate

    def _save_cache(self) -> None:
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache_path.write_text(json.dumps(self.cache, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


class TmdbClient:
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    def search_tv(self, query: str, *, year: int | None = None) -> list[TmdbCandidate]:
        params = {"query": query, "include_adult": "false", "language": "en-US"}
        if year is not None:
            params["first_air_date_year"] = str(year)
        payload = self._get("/search/tv", params)
        results = payload.get("results", [])
        return [candidate_from_tmdb_search(item) for item in results[:10]]

    def tv_detail(self, tmdb_id: int) -> TmdbCandidate:
        payload = self._get(f"/tv/{tmdb_id}", {"language": "en-US"})
        return candidate_from_tmdb_search(payload)

    def _get(self, path: str, params: dict[str, str]) -> dict[str, object]:
        query = urllib.parse.urlencode({**params, "api_key": self.api_key})
        url = f"{TMDB_BASE_URL}{path}?{query}"
        return fetch_json(url)


class EpisodEraApiClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    def search_tv(self, query: str, *, year: int | None = None) -> list[TmdbCandidate]:
        del year  # EpisodEra search has no year filter; year scoring happens later.
        params = urllib.parse.urlencode({"q": query, "page": "1"})
        payload = fetch_json(f"{self.base_url}/search?{params}")
        tv = payload.get("tv", {})
        results = tv.get("results", []) if isinstance(tv, dict) else []
        return [candidate_from_episodera_summary(item) for item in results[:10]]

    def tv_detail(self, tmdb_id: int) -> TmdbCandidate:
        payload = fetch_json(f"{self.base_url}/tv/{tmdb_id}")
        return candidate_from_episodera_summary(payload)


def fetch_json(url: str) -> dict[str, object]:
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Request failed ({exc.code}) for {url}: {body}") from exc


def candidate_from_tmdb_search(item: dict[str, object]) -> TmdbCandidate:
    return TmdbCandidate(
        id=int(item["id"]),
        name=str(item.get("name") or item.get("title") or ""),
        original_name=str(item.get("original_name") or item.get("original_title") or ""),
        first_air_date=str(item.get("first_air_date") or item.get("release_date") or ""),
        poster_path=item.get("poster_path") if item.get("poster_path") else None,
        backdrop_path=item.get("backdrop_path") if item.get("backdrop_path") else None,
        popularity=float(item.get("popularity") or 0),
    )


def candidate_from_episodera_summary(item: dict[str, object]) -> TmdbCandidate:
    images = item.get("images", {}) if isinstance(item.get("images"), dict) else {}
    return TmdbCandidate(
        id=int(item["id"]),
        name=str(item.get("title") or ""),
        original_name=str(item.get("title") or ""),
        first_air_date=str(item.get("releaseDate") or ""),
        poster_path=None,
        backdrop_path=None,
        popularity=float(item.get("popularity") or 0),
        poster=str(images.get("poster") or "") or None,
        backdrop=str(images.get("backdrop") or "") or None,
    )


def candidate_to_dict(candidate: TmdbCandidate) -> dict[str, object]:
    return {
        "id": candidate.id,
        "name": candidate.name,
        "original_name": candidate.original_name,
        "first_air_date": candidate.first_air_date,
        "poster_path": candidate.poster_path,
        "backdrop_path": candidate.backdrop_path,
        "popularity": candidate.popularity,
        "poster": candidate.poster,
        "backdrop": candidate.backdrop,
    }


def candidate_from_dict(item: dict[str, object]) -> TmdbCandidate:
    return TmdbCandidate(
        id=int(item["id"]),
        name=str(item.get("name") or ""),
        original_name=str(item.get("original_name") or ""),
        first_air_date=str(item.get("first_air_date") or ""),
        poster_path=item.get("poster_path") if item.get("poster_path") else None,
        backdrop_path=item.get("backdrop_path") if item.get("backdrop_path") else None,
        popularity=float(item.get("popularity") or 0),
        poster=str(item.get("poster") or "") or None,
        backdrop=str(item.get("backdrop") or "") or None,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_SHOWS, help="normalized/shows.csv path")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--env-file", type=Path, default=DEFAULT_ENV)
    parser.add_argument("--api-key", help="TMDb API key (defaults to TMDB_API_KEY from --env-file)")
    parser.add_argument(
        "--episodera-api",
        nargs="?",
        const=DEFAULT_EPISODERA_API,
        default=None,
        help="Use EpisodEra /search proxy instead of direct TMDb (default URL when flag alone)",
    )
    parser.add_argument("--overrides", type=Path, default=DEFAULT_OVERRIDES)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--min-confidence", type=float, default=0.82, help="Auto-accept threshold")
    parser.add_argument("--refresh", action="store_true", help="Ignore cached TMDb search results")
    parser.add_argument("--mapping", type=Path, help="Existing mapping CSV to preserve accepted rows")
    return parser.parse_args()


def build_lookup_client(args: argparse.Namespace) -> tuple[LookupClient, str]:
    env = load_env_file(args.env_file)
    api_key = args.api_key or env.get("TMDB_API_KEY", "")
    if args.episodera_api is not None:
        return EpisodEraApiClient(args.episodera_api), f"episodera-api:{args.episodera_api}"
    if api_key and not api_key.startswith("replace-with"):
        return TmdbClient(api_key), "tmdb-direct"
  # Default to deployed EpisodEra API so the script works without a local key.
    return EpisodEraApiClient(DEFAULT_EPISODERA_API), f"episodera-api:{DEFAULT_EPISODERA_API}"


def extract_year_hint(title: str) -> tuple[str, int | None]:
    match = re.search(r"\((\d{4})\)\s*$", title.strip())
    if not match:
        return title, None
    return title[: match.start()].strip(), int(match.group(1))


def title_variants(title: str) -> list[str]:
    base, year = extract_year_hint(title)
    variants = [title, base]
    if ":" in base:
        variants.append(base.split(":", 1)[0].strip())
    if year is not None:
        variants.append(f"{base} {year}")
    deduped: list[str] = []
    seen: set[str] = set()
    for variant in variants:
        normalized = variant.strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            deduped.append(normalized)
    return deduped


def score_candidate(source_title: str, candidate: TmdbCandidate, year_hint: int | None) -> float:
    source_norm = normalize_title(source_title)
    names = [candidate.name, candidate.original_name]
    best = 0.0
    for name in names:
        if not name:
            continue
        target_norm = normalize_title(name)
        if source_norm == target_norm:
            return 1.0
        best = max(best, SequenceMatcher(None, source_norm, target_norm).ratio())
        if len(source_norm) >= 5 and (source_norm in target_norm or target_norm in source_norm):
            best = max(best, 0.92)

    if year_hint is not None and candidate.first_air_date.startswith(str(year_hint)):
        best = min(1.0, best + 0.08)
    elif year_hint is not None and candidate.first_air_date and not candidate.first_air_date.startswith(str(year_hint)):
        best *= 0.85

    return round(best, 4)


def choose_match(show_name: str, candidates: list[TmdbCandidate], *, search_query: str) -> MatchResult:
    if not candidates:
        return MatchResult(None, 0.0, "unresolved", search_query, 0, "No TMDb search results")

    _, year_hint = extract_year_hint(show_name)
    scored = sorted(
        ((score_candidate(show_name, candidate, year_hint), candidate) for candidate in candidates),
        key=lambda item: (item[0], item[1].popularity),
        reverse=True,
    )
    best_score, best_candidate = scored[0]
    second_score = scored[1][0] if len(scored) > 1 else 0.0
    notes = ""
    if best_score >= 0.98:
        method = "exact"
    elif best_score - second_score < 0.04 and second_score >= 0.75:
        method = "ambiguous"
        notes = f"Close runner-up: {scored[1][1].name} ({second_score:.2f})"
    else:
        method = "search"

    return MatchResult(best_candidate, best_score, method, search_query, len(candidates), notes)


def find_best_match(client: LookupClient, show_name: str) -> MatchResult:
    best_result = MatchResult(None, 0.0, "unresolved", show_name, 0, "No match")
    for query in title_variants(show_name):
        _, year_hint = extract_year_hint(query)
        candidates = client.search_tv(query, year=year_hint)
        result = choose_match(show_name, candidates, search_query=query)
        if result.candidate and result.confidence > best_result.confidence:
            best_result = result
        if result.confidence >= 0.98:
            break
    return best_result


def load_overrides(path: Path) -> dict[str, int]:
    if not path.is_file():
        return {}
    _, rows = read_csv(path)
    overrides: dict[str, int] = {}
    for row in rows:
        show_id = row.get("tv_time_show_id", "").strip()
        tmdb_id = row.get("tmdb_id", "").strip()
        if show_id and tmdb_id and not str(row.get("note", "")).lower().startswith("example"):
            overrides[show_id] = int(tmdb_id)
    return overrides


def load_existing_mapping(path: Path) -> dict[str, dict[str, str]]:
    if not path.is_file():
        return {}
    _, rows = read_csv(path)
    return {row["tv_time_show_id"]: row for row in rows if row.get("tv_time_show_id")}


def mapping_row_from_match(show: dict[str, str], match: MatchResult) -> dict[str, object]:
    candidate = match.candidate
    return {
        "tv_time_show_id": show["tv_time_show_id"],
        "tv_show_name": show["tv_show_name"],
        "tmdb_id": candidate.id if candidate else "",
        "tmdb_title": candidate.name if candidate else "",
        "tmdb_original_title": candidate.original_name if candidate else "",
        "first_air_date": candidate.first_air_date if candidate else "",
        "poster": candidate.resolved_poster() if candidate else "",
        "backdrop": candidate.resolved_backdrop() if candidate else "",
        "match_method": match.method,
        "confidence": f"{match.confidence:.4f}",
        "search_query": match.search_query,
        "candidate_count": match.candidate_count,
        "notes": match.notes,
    }


def ensure_override_template(path: Path) -> None:
    if path.is_file():
        return
    write_csv(path, OVERRIDE_FIELDS, DEFAULT_OVERRIDES_ROWS)


def main() -> None:
    args = parse_args()
    if not args.input.is_file():
        raise SystemExit(f"Shows file not found: {args.input}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    ensure_override_template(args.overrides)

    inner_client, backend = build_lookup_client(args)
    client = CachedLookupClient(inner_client, args.cache, refresh=args.refresh)

    _, shows = read_csv(args.input)
    overrides = load_overrides(args.overrides)
    mapping_path = args.mapping or (args.output_dir / "show_mapping.csv")
    existing = load_existing_mapping(mapping_path)

    mapping_rows: list[dict[str, object]] = []
    unresolved_rows: list[dict[str, object]] = []

    for index, show in enumerate(shows, start=1):
        show_id = show["tv_time_show_id"]
        print(f"[{index}/{len(shows)}] {show['tv_show_name']}", flush=True)

        if show_id in overrides:
            candidate = client.tv_detail(overrides[show_id])
            match = MatchResult(candidate, 1.0, "manual", f"override:{show_id}", 1, "Manual override")
            mapping_rows.append(mapping_row_from_match(show, match))
            continue

        prior = existing.get(show_id)
        if (
            prior
            and prior.get("tmdb_id")
            and float(prior.get("confidence") or 0) >= args.min_confidence
            and prior.get("match_method") in {"exact", "search", "manual"}
            and not args.refresh
        ):
            mapping_rows.append(prior)
            continue

        match = find_best_match(client, show["tv_show_name"])
        row = mapping_row_from_match(show, match)
        mapping_rows.append(row)
        if not match.candidate or match.confidence < args.min_confidence or match.method == "ambiguous":
            unresolved_rows.append(row)

    mapping_rows.sort(key=lambda row: str(row["tv_show_name"]).casefold())
    write_csv(args.output_dir / "show_mapping.csv", MAPPING_FIELDS, mapping_rows)
    write_csv(args.output_dir / "unresolved_shows.csv", MAPPING_FIELDS, unresolved_rows)

    accepted = sum(
        1
        for row in mapping_rows
        if row.get("tmdb_id") and float(row.get("confidence") or 0) >= args.min_confidence and row.get("match_method") != "ambiguous"
    )
    summary = {
        "shows_total": len(shows),
        "mapping_rows": len(mapping_rows),
        "accepted": accepted,
        "unresolved": len(unresolved_rows),
        "manual_overrides": len(overrides),
        "min_confidence": args.min_confidence,
        "backend": backend,
        "output_dir": str(args.output_dir),
    }
    (args.output_dir / "resolve_report.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
