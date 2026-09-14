"""NBA season stats and game-log fetch/normalization.

Network calls happen only when fetch_stats_bundle() is invoked.
Season stats are stored as per-game averages. Game logs are per-game totals.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Callable, Mapping

from nba_players import _as_int, _as_str, _rows_from_dataset, nba_season_id, previous_nba_season_id

SEASON_TYPES = ("Preseason", "Regular Season", "PlayIn", "Playoffs")


def parse_minutes(value: Any) -> float:
    if value in (None, ""):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if ":" in text:
        minutes, seconds = text.split(":", 1)
        try:
            return int(minutes) + int(seconds) / 60
        except ValueError:
            return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def parse_game_date(value: Any) -> str | None:
    text = _as_str(value)
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _as_float(value: Any) -> float:
    if value in (None, ""):
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _as_count(value: Any) -> int:
    if value in (None, ""):
        return 0
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return 0


def _per_game(total: Any, games: int) -> float:
    if games <= 0:
        return 0.0
    return round(_as_float(total) / games, 3)


def normalize_season_stats(row: Mapping[str, Any], season: str, *, totals: bool = False) -> dict[str, Any] | None:
    nba_id = _as_int(row.get("PLAYER_ID") or row.get("Player_ID") or row.get("nbaPersonId"))
    if nba_id is None or nba_id <= 0:
        return None

    games = _as_count(row.get("GP") or row.get("gamesPlayed"))
    season_id = _as_str(row.get("SEASON_ID"))
    season_label = _as_str(row.get("season")) or (season_id if season_id and "-" in season_id else None) or season
    minutes_raw = parse_minutes(row.get("MIN"))
    scale = (lambda value: _per_game(value, games)) if totals else _as_float

    return {
        "nbaPersonId": nba_id,
        "season": season_label,
        "gamesPlayed": games,
        "minutes": _per_game(minutes_raw, games) if totals else minutes_raw,
        "points": scale(row.get("PTS")),
        "rebounds": scale(row.get("REB")),
        "assists": scale(row.get("AST")),
        "steals": scale(row.get("STL")),
        "blocks": scale(row.get("BLK")),
        "turnovers": scale(row.get("TOV")),
        "fieldGoalsMade": scale(row.get("FGM")),
        "fieldGoalsAttempted": scale(row.get("FGA")),
        "threePointersMade": scale(row.get("FG3M")),
        "threePointersAttempted": scale(row.get("FG3A")),
        "freeThrowsMade": scale(row.get("FTM")),
        "freeThrowsAttempted": scale(row.get("FTA")),
    }


def normalize_game_log(row: Mapping[str, Any]) -> dict[str, Any] | None:
    nba_id = _as_int(row.get("PLAYER_ID") or row.get("Player_ID") or row.get("nbaPersonId"))
    game_id = _as_str(row.get("GAME_ID") or row.get("Game_ID") or row.get("gameId"))
    game_date = parse_game_date(row.get("GAME_DATE") or row.get("gameDate"))
    if nba_id is None or nba_id <= 0 or not game_id or not game_date:
        return None

    return {
        "nbaPersonId": nba_id,
        "gameId": game_id,
        "gameDate": game_date,
        "minutes": round(parse_minutes(row.get("MIN")), 3),
        "points": _as_count(row.get("PTS")),
        "rebounds": _as_count(row.get("REB")),
        "assists": _as_count(row.get("AST")),
        "steals": _as_count(row.get("STL")),
        "blocks": _as_count(row.get("BLK")),
        "turnovers": _as_count(row.get("TOV")),
        "fieldGoalsMade": _as_count(row.get("FGM")),
        "fieldGoalsAttempted": _as_count(row.get("FGA")),
        "threePointersMade": _as_count(row.get("FG3M")),
        "threePointersAttempted": _as_count(row.get("FG3A")),
        "freeThrowsMade": _as_count(row.get("FTM")),
        "freeThrowsAttempted": _as_count(row.get("FTA")),
    }


def fetch_league_season_stats(season: str) -> list[dict[str, Any]]:
    from nba_api.stats.endpoints import leaguedashplayerstats
    from nba_api.stats.library.parameters import PerModeDetailed, SeasonTypeAllStar

    dataset = leaguedashplayerstats.LeagueDashPlayerStats(
        season=season,
        per_mode_detailed=PerModeDetailed.per_game,
        season_type_all_star=SeasonTypeAllStar.regular,
        timeout=90,
    )
    return _rows_from_dataset(dataset.league_dash_player_stats.get_dict())


def fetch_league_game_logs(season: str, season_type: str) -> list[dict[str, Any]]:
    from nba_api.stats.endpoints import leaguegamelog
    from nba_api.stats.library.parameters import PlayerOrTeamAbbreviation

    dataset = leaguegamelog.LeagueGameLog(
        player_or_team_abbreviation=PlayerOrTeamAbbreviation.player,
        season=season,
        season_type_all_star=season_type,
        timeout=90,
    )
    return _rows_from_dataset(dataset.league_game_log.get_dict())


def fetch_league_team_games(season: str, season_type: str) -> list[dict[str, Any]]:
    from nba_api.stats.endpoints import leaguegamelog
    from nba_api.stats.library.parameters import PlayerOrTeamAbbreviation

    dataset = leaguegamelog.LeagueGameLog(
        player_or_team_abbreviation=PlayerOrTeamAbbreviation.team,
        season=season,
        season_type_all_star=season_type,
        timeout=90,
    )
    return _rows_from_dataset(dataset.league_game_log.get_dict())


def normalize_team_game(row: Mapping[str, Any], season: str) -> dict[str, Any] | None:
    team_id = _as_int(row.get("TEAM_ID") or row.get("teamId"))
    game_id = _as_str(row.get("GAME_ID") or row.get("Game_ID") or row.get("gameId"))
    game_date = parse_game_date(row.get("GAME_DATE") or row.get("gameDate"))
    team_abbr = _as_str(row.get("TEAM_ABBREVIATION") or row.get("teamAbbr"))
    if team_id is None or team_id <= 0 or not game_id or not game_date:
        return None
    return {
        "teamId": team_id,
        "teamAbbr": team_abbr or "",
        "gameId": game_id,
        "gameDate": game_date,
        "season": season,
        "minutes": parse_minutes(row.get("MIN")),
        "fieldGoalsAttempted": _as_count(row.get("FGA")),
        "freeThrowsAttempted": _as_count(row.get("FTA")),
        "turnovers": _as_count(row.get("TOV")),
    }


def fetch_player_career_totals(nba_person_id: int) -> list[dict[str, Any]]:
    from nba_api.stats.endpoints import playercareerstats

    dataset = playercareerstats.PlayerCareerStats(player_id=nba_person_id, timeout=60)
    return _rows_from_dataset(dataset.season_totals_regular_season.get_dict())


def fetch_player_game_logs(nba_person_id: int, season: str, season_type: str) -> list[dict[str, Any]]:
    from nba_api.stats.endpoints import playergamelog

    dataset = playergamelog.PlayerGameLog(
        player_id=nba_person_id,
        season=season,
        season_type_all_star=season_type,
        timeout=60,
    )
    return _rows_from_dataset(dataset.player_game_log.get_dict())


def _collect_season_stats(
    seasons: list[str],
    fetcher: Callable[[str], Any],
    errors: list[str],
) -> list[dict[str, Any]]:
    by_key: dict[tuple[int, str], dict[str, Any]] = {}
    for season in seasons:
        try:
            for row in _rows_from_dataset(fetcher(season)):
                normalized = normalize_season_stats(row, season)
                if normalized is None:
                    continue
                by_key[(normalized["nbaPersonId"], normalized["season"])] = normalized
        except Exception as exc:  # noqa: BLE001 - one season must not abort the bundle
            errors.append(f"season stats {season}: {exc}")
    return list(by_key.values())


def _collect_game_logs(
    seasons: list[str],
    fetcher: Callable[[str, str], Any],
    errors: list[str],
) -> list[dict[str, Any]]:
    by_key: dict[tuple[int, str], dict[str, Any]] = {}
    for season in seasons:
        for season_type in SEASON_TYPES:
            try:
                for row in _rows_from_dataset(fetcher(season, season_type)):
                    normalized = normalize_game_log(row)
                    if normalized is None:
                        continue
                    by_key[(normalized["nbaPersonId"], normalized["gameId"])] = normalized
            except Exception as exc:  # noqa: BLE001 - missing playoff logs are common
                errors.append(f"game logs {season} {season_type}: {exc}")
    return list(by_key.values())


def _collect_team_games(
    seasons: list[str],
    fetcher: Callable[[str, str], Any],
    errors: list[str],
) -> list[dict[str, Any]]:
    by_key: dict[tuple[int, str], dict[str, Any]] = {}
    for season in seasons:
        for season_type in SEASON_TYPES:
            try:
                for row in _rows_from_dataset(fetcher(season, season_type)):
                    normalized = normalize_team_game(row, season)
                    if normalized is None:
                        continue
                    by_key[(normalized["teamId"], normalized["gameId"])] = normalized
            except Exception as exc:  # noqa: BLE001 - missing playoff logs are common
                errors.append(f"team games {season} {season_type}: {exc}")
    return list(by_key.values())


def fetch_stats_bundle(
    nba_person_id: int | None = None,
    season: str | None = None,
    season_stats_fetcher: Callable[[str], Any] | None = None,
    game_log_fetcher: Callable[[str, str], Any] | None = None,
    team_game_fetcher: Callable[[str, str], Any] | None = None,
    career_fetcher: Callable[[int], Any] | None = None,
    player_log_fetcher: Callable[[int, str, str], Any] | None = None,
) -> dict[str, Any]:
    current = season or nba_season_id()
    seasons = ["2025-26", "2026-27"]
    errors: list[str] = []

    if nba_person_id is None:
        season_stats = _collect_season_stats(
            seasons,
            season_stats_fetcher or fetch_league_season_stats,
            errors,
        )
        game_logs = _collect_game_logs(
            seasons,
            game_log_fetcher or fetch_league_game_logs,
            errors,
        )
    else:
        career_rows = _rows_from_dataset((career_fetcher or fetch_player_career_totals)(nba_person_id))
        wanted = set(seasons)
        season_stats = []
        for row in career_rows:
            normalized = normalize_season_stats(row, current, totals=True)
            if normalized and normalized["season"] in wanted:
                season_stats.append(normalized)

        def player_logs(season_id: str, season_type: str) -> Any:
            return (player_log_fetcher or fetch_player_game_logs)(nba_person_id, season_id, season_type)

        game_logs = _collect_game_logs(seasons, player_logs, errors)

    team_games = _collect_team_games(
        seasons,
        team_game_fetcher or fetch_league_team_games,
        errors,
    )

    return {
        "source": "nba_api",
        "season": current,
        "seasons": seasons,
        "seasonStats": season_stats,
        "gameLogs": game_logs,
        "teamGames": team_games,
        "errors": errors,
    }
