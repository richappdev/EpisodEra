"""Shared helpers for TV Time -> EpisodEra import tooling."""

from __future__ import annotations

import csv
import re
import unicodedata
from pathlib import Path
from typing import Iterable


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def write_csv(path: Path, fieldnames: list[str], rows: Iterable[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def normalize_title(title: str) -> str:
    text = unicodedata.normalize("NFKD", title.casefold())
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def episode_key_for(season_number: int, episode_number: int) -> str:
    return f"s{season_number:02d}e{episode_number:02d}"


def integer(value: str | None) -> int:
    try:
        return int(float(value or 0))
    except ValueError:
        return 0


def truthy(value: str | None) -> bool:
    return str(value).lower() in {"1", "true", "yes"}


def load_env_file(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def poster_url(poster_path: str | None) -> str | None:
    if not poster_path:
        return None
    return f"https://image.tmdb.org/t/p/w500{poster_path}"


def backdrop_url(backdrop_path: str | None) -> str | None:
    if not backdrop_path:
        return None
    return f"https://image.tmdb.org/t/p/w780{backdrop_path}"
