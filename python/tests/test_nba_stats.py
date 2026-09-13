import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from nba_players import previous_nba_season_id
from nba_stats import fetch_stats_bundle, normalize_game_log, normalize_season_stats, normalize_team_game, parse_minutes


def test_parse_minutes_from_clock_string():
    assert parse_minutes("32:30") == 32.5
    assert parse_minutes(36) == 36.0


def test_normalize_season_stats_per_game():
    row = normalize_season_stats(
        {
            "PLAYER_ID": 2544,
            "GP": 65,
            "MIN": 35.4,
            "PTS": 25.4,
            "REB": 7.8,
            "AST": 8.1,
            "STL": 1.1,
            "BLK": 0.6,
            "TOV": 3.2,
            "FGM": 9.1,
            "FGA": 18.2,
            "FG3M": 2.1,
            "FG3A": 6.0,
            "FTM": 5.1,
            "FTA": 6.4,
        },
        "2025-26",
    )
    assert row["nbaPersonId"] == 2544
    assert row["gamesPlayed"] == 65
    assert row["points"] == 25.4


def test_normalize_season_totals_to_per_game():
    row = normalize_season_stats(
        {
            "PLAYER_ID": 2544,
            "SEASON_ID": "2025-26",
            "GP": 2,
            "MIN": 70,
            "PTS": 50,
            "REB": 16,
            "AST": 10,
            "STL": 2,
            "BLK": 2,
            "TOV": 4,
            "FGM": 20,
            "FGA": 40,
            "FG3M": 4,
            "FG3A": 12,
            "FTM": 6,
            "FTA": 8,
        },
        "2026-27",
        totals=True,
    )
    assert row["season"] == "2025-26"
    assert row["points"] == 25.0
    assert row["minutes"] == 35.0


def test_normalize_game_log_accepts_player_game_log_headers():
    row = normalize_game_log(
        {
            "Player_ID": 2544,
            "Game_ID": "0022500001",
            "GAME_DATE": "APR 10, 2026",
            "MIN": "31:00",
            "PTS": 30,
            "REB": 8,
            "AST": 9,
            "STL": 2,
            "BLK": 1,
            "TOV": 3,
            "FGM": 11,
            "FGA": 22,
            "FG3M": 3,
            "FG3A": 8,
            "FTM": 5,
            "FTA": 6,
        }
    )
    assert row["gameId"] == "0022500001"
    assert row["gameDate"] == "2026-04-10"
    assert row["points"] == 30
    assert row["minutes"] == 31.0


def test_normalize_team_game():
    row = normalize_team_game(
        {
            "TEAM_ID": 1610612748,
            "TEAM_ABBREVIATION": "MIA",
            "GAME_ID": "0022500100",
            "GAME_DATE": "2026-01-15",
        },
        "2025-26",
    )
    assert row == {
        "teamId": 1610612748,
        "teamAbbr": "MIA",
        "gameId": "0022500100",
        "gameDate": "2026-01-15",
        "season": "2025-26",
    }


def test_fetch_stats_bundle_uses_injected_bulk_fetchers():
    catalog = fetch_stats_bundle(
        season="2026-27",
        season_stats_fetcher=lambda season: [
            {
                "PLAYER_ID": 2544,
                "GP": 1,
                "MIN": 30,
                "PTS": 20,
                "REB": 5,
                "AST": 5,
                "STL": 1,
                "BLK": 0,
                "TOV": 2,
                "FGM": 8,
                "FGA": 16,
                "FG3M": 2,
                "FG3A": 6,
                "FTM": 2,
                "FTA": 2,
            }
        ]
        if season == "2026-27"
        else [],
        game_log_fetcher=lambda season, season_type: [
            {
                "PLAYER_ID": 2544,
                "GAME_ID": "0022600001",
                "GAME_DATE": "2026-10-22",
                "MIN": 30,
                "PTS": 22,
                "REB": 6,
                "AST": 7,
                "STL": 1,
                "BLK": 0,
                "TOV": 2,
                "FGM": 9,
                "FGA": 18,
                "FG3M": 2,
                "FG3A": 5,
                "FTM": 2,
                "FTA": 2,
            }
        ]
        if season == "2026-27" and season_type == "Regular Season"
        else (_ for _ in ()).throw(RuntimeError("no playoffs"))
        if season_type == "Playoffs"
        else [],
        team_game_fetcher=lambda season, season_type: [],
    )
    assert catalog["season"] == "2026-27"
    assert previous_nba_season_id("2026-27") == "2025-26"
    assert len(catalog["seasonStats"]) == 1
    assert len(catalog["gameLogs"]) == 1
    assert any("Playoffs" in entry for entry in catalog["errors"])
    json.dumps(catalog)


def test_fetch_stats_bundle_individual_does_not_call_league_bulk():
    catalog = fetch_stats_bundle(
        nba_person_id=2544,
        season="2026-27",
        season_stats_fetcher=lambda season: (_ for _ in ()).throw(RuntimeError("bulk should not run")),
        game_log_fetcher=lambda season, season_type: (_ for _ in ()).throw(RuntimeError("bulk should not run")),
        career_fetcher=lambda player_id: [
            {
                "PLAYER_ID": player_id,
                "SEASON_ID": "2025-26",
                "GP": 2,
                "MIN": 60,
                "PTS": 40,
                "REB": 10,
                "AST": 8,
                "STL": 2,
                "BLK": 0,
                "TOV": 4,
                "FGM": 16,
                "FGA": 32,
                "FG3M": 2,
                "FG3A": 8,
                "FTM": 6,
                "FTA": 8,
            }
        ],
        player_log_fetcher=lambda player_id, season, season_type: [
            {
                "Player_ID": player_id,
                "Game_ID": "0022500999",
                "GAME_DATE": "2026-04-10",
                "MIN": 29,
                "PTS": 18,
                "REB": 4,
                "AST": 6,
                "STL": 1,
                "BLK": 0,
                "TOV": 1,
                "FGM": 7,
                "FGA": 14,
                "FG3M": 1,
                "FG3A": 4,
                "FTM": 3,
                "FTA": 4,
            }
        ]
        if season_type == "Regular Season"
        else [],
        team_game_fetcher=lambda season, season_type: [],
    )
    assert catalog["seasonStats"][0]["points"] == 20.0
    assert catalog["gameLogs"][0]["gameId"] == "0022500999"
