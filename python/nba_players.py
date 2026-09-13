"""Bulk NBA player fetch and normalization.

Network calls to stats.nba.com happen only when fetch_player_catalog() is invoked.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Callable, Mapping

INDEX_ENRICH_KEYS = ("POSITION", "JERSEY_NUMBER")


def nba_season_id(today: date | None = None) -> str:
    """Return the NBA season stats.nba.com expects for current rosters.

    nba_api keeps using the prior season until October, which leaves
    offseason trades on last year's teams. League-year rosters settle in July.
    """
    current = today or date.today()
    start_year = current.year if current.month >= 7 else current.year - 1
    return f"{start_year}-{str(start_year + 1)[2:]}"


def previous_nba_season_id(season: str) -> str:
    start_year = int(season.split("-", 1)[0])
    return f"{start_year - 1}-{str(start_year)[2:]}"


def _as_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    return number


def _as_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _is_active(value: Any) -> bool:
    return value in (1, "1", True, "true", "True", "Y", "y")


def _null_team_id(team_id: int | None) -> int | None:
    if team_id is None or team_id <= 0:
        return None
    return team_id


def split_display_name(
    display_first_last: str | None,
    last_comma_first: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
) -> tuple[str, str, str]:
    first = _as_str(first_name)
    last = _as_str(last_name)

    if not first or not last:
        comma = _as_str(last_comma_first)
        if comma and "," in comma:
            last_part, first_part = comma.split(",", 1)
            last = last or _as_str(last_part)
            first = first or _as_str(first_part)

    full = _as_str(display_first_last)
    if not first or not last:
        if full:
            parts = full.split()
            if len(parts) == 1:
                first = first or parts[0]
                last = last or parts[0]
            else:
                first = first or " ".join(parts[:-1])
                last = last or parts[-1]

    if not first or not last:
        raise ValueError("Player is missing a usable first or last name")

    if not full:
        full = f"{first} {last}".strip()

    return first, last, full


def normalize_player(
    common_row: Mapping[str, Any],
    index_row: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    row = dict(common_row)
    if index_row:
        for key in INDEX_ENRICH_KEYS:
            value = index_row.get(key)
            if value not in (None, ""):
                row[key] = value

    nba_id = _as_int(
        row.get("nbaPersonId")
        or row.get("PERSON_ID")
        or row.get("id")
        or row.get("PLAYER_ID")
    )
    if nba_id is None or nba_id <= 0:
        return None

    try:
        first_name, last_name, full_name = split_display_name(
            display_first_last=row.get("DISPLAY_FIRST_LAST")
            or row.get("full_name")
            or row.get("fullName"),
            last_comma_first=row.get("DISPLAY_LAST_COMMA_FIRST"),
            first_name=row.get("PLAYER_FIRST_NAME") or row.get("first_name") or row.get("firstName"),
            last_name=row.get("PLAYER_LAST_NAME") or row.get("last_name") or row.get("lastName"),
        )
    except ValueError:
        return None

    team_id = _null_team_id(_as_int(row.get("TEAM_ID") or row.get("teamId")))
    roster_status = row.get("ROSTERSTATUS", row.get("ROSTER_STATUS", row.get("is_active", row.get("isActive"))))
    from_year = _as_int(row.get("FROM_YEAR") or row.get("fromYear"))
    if from_year is not None and from_year < 1946:
        from_year = None

    return {
        "nbaPersonId": nba_id,
        "firstName": first_name,
        "lastName": last_name,
        "fullName": full_name,
        "teamId": team_id,
        "teamAbbr": _as_str(row.get("TEAM_ABBREVIATION") or row.get("teamAbbr")),
        "teamName": _compose_team_name(row),
        "position": _as_str(row.get("POSITION") or row.get("position")),
        "jerseyNumber": _as_str(row.get("JERSEY_NUMBER") or row.get("jerseyNumber")),
        "fromYear": from_year,
        "isActive": _is_active(roster_status),
    }


def _compose_team_name(row: Mapping[str, Any]) -> str | None:
    city = _as_str(row.get("TEAM_CITY"))
    name = _as_str(row.get("teamName") or row.get("TEAM_NAME"))
    if city and name:
        if city.lower() in name.lower():
            return name
        return f"{city} {name}"
    return name or city


def merge_player_rows(
    common_rows: list[Mapping[str, Any]],
    index_rows: list[Mapping[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    index_by_id: dict[int, Mapping[str, Any]] = {}
    for row in index_rows or []:
        player_id = _as_int(row.get("PERSON_ID") or row.get("PLAYER_ID") or row.get("id"))
        if player_id:
            index_by_id[player_id] = row

    merged: dict[int, dict[str, Any]] = {}
    failed = 0
    for row in common_rows:
        player_id = _as_int(row.get("PERSON_ID") or row.get("PLAYER_ID") or row.get("id") or row.get("nbaPersonId"))
        normalized = normalize_player(row, index_by_id.get(player_id) if player_id else None)
        if normalized is None:
            failed += 1
            continue
        existing = merged.get(normalized["nbaPersonId"])
        if existing is None or _row_rank(normalized) >= _row_rank(existing):
            merged[normalized["nbaPersonId"]] = normalized

    return list(merged.values()), failed


def _row_rank(player: Mapping[str, Any]) -> tuple[int, int]:
    return (1 if player.get("isActive") else 0, 1 if player.get("teamId") else 0)


def fetch_common_all_players(season: str | None = None) -> list[dict[str, Any]]:
    from nba_api.stats.endpoints import commonallplayers

    dataset = commonallplayers.CommonAllPlayers(
        is_only_current_season=0,
        season=season or nba_season_id(),
        timeout=60,
    )
    return _rows_from_dataset(dataset.common_all_players.get_dict())


def fetch_player_index(season: str | None = None) -> list[dict[str, Any]]:
    from nba_api.stats.endpoints import playerindex
    from nba_api.stats.library.parameters import Historical

    dataset = playerindex.PlayerIndex(
        historical_nullable=Historical.all_time,
        season=season or nba_season_id(),
        timeout=60,
    )
    return _rows_from_dataset(dataset.player_index.get_dict())


def _rows_from_dataset(raw: Any) -> list[dict[str, Any]]:
    if isinstance(raw, list):
        if not raw:
            return []
        if isinstance(raw[0], dict):
            return list(raw)
        return []
    if isinstance(raw, dict) and "headers" in raw:
        rows = raw.get("data") or raw.get("rowSet") or []
        return [dict(zip(raw["headers"], row)) for row in rows]
    return []


def fetch_player_catalog(
    common_fetcher: Callable[[], Any] = fetch_common_all_players,
    index_fetcher: Callable[[], Any] | None = fetch_player_index,
) -> dict[str, Any]:
    common_rows = _rows_from_dataset(common_fetcher())
    if not common_rows:
        raise RuntimeError("nba_api returned no players from CommonAllPlayers")

    index_rows: list[dict[str, Any]] = []
    index_error: str | None = None
    if index_fetcher is not None:
        try:
            index_rows = _rows_from_dataset(index_fetcher())
        except Exception as exc:  # noqa: BLE001 - position data is optional enrichment
            index_error = str(exc)

    players, failed = merge_player_rows(common_rows, index_rows)
    if not players:
        raise RuntimeError("No valid NBA players could be normalized from nba_api")

    return {
        "source": "nba_api",
        "fetched": len(players),
        "skipped": failed,
        "indexError": index_error,
        "players": players,
    }
