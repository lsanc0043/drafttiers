import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from datetime import date

from nba_players import (
    fetch_player_catalog,
    merge_player_rows,
    nba_season_id,
    normalize_player,
    split_display_name,
)


def test_split_display_name_from_comma_format():
    first, last, full = split_display_name("LeBron James", "James, LeBron")
    assert first == "LeBron"
    assert last == "James"
    assert full == "LeBron James"


def test_normalize_skips_missing_id():
    assert normalize_player({"DISPLAY_FIRST_LAST": "No Id"}) is None


def test_normalize_maps_common_all_players_and_index():
    player = normalize_player(
        {
            "PERSON_ID": 2544,
            "DISPLAY_FIRST_LAST": "LeBron James",
            "DISPLAY_LAST_COMMA_FIRST": "James, LeBron",
            "TEAM_ID": 1610612747,
            "TEAM_CITY": "Los Angeles",
            "TEAM_NAME": "Lakers",
            "TEAM_ABBREVIATION": "LAL",
            "ROSTERSTATUS": 1,
            "FROM_YEAR": 2003,
        },
        {
            "PERSON_ID": 2544,
            "POSITION": "F",
            "JERSEY_NUMBER": "23",
            "TEAM_ABBREVIATION": "CLE",
        },
    )
    assert player == {
        "nbaPersonId": 2544,
        "firstName": "LeBron",
        "lastName": "James",
        "fullName": "LeBron James",
        "teamId": 1610612747,
        "teamAbbr": "LAL",
        "teamName": "Los Angeles Lakers",
        "position": "F",
        "jerseyNumber": "23",
        "fromYear": 2003,
        "isActive": True,
    }


def test_nba_season_rolls_in_july_not_october():
    assert nba_season_id(date(2026, 6, 30)) == "2025-26"
    assert nba_season_id(date(2026, 7, 1)) == "2026-27"
    assert nba_season_id(date(2026, 9, 12)) == "2026-27"


def test_player_index_enriches_position_without_overwriting_team():
    player = normalize_player(
        {
            "PERSON_ID": 1630163,
            "DISPLAY_FIRST_LAST": "LaMelo Ball",
            "TEAM_ID": 1610612750,
            "TEAM_CITY": "Minnesota",
            "TEAM_NAME": "Timberwolves",
            "TEAM_ABBREVIATION": "MIN",
            "ROSTERSTATUS": 1,
        },
        {
            "PERSON_ID": 1630163,
            "TEAM_ID": 1610612766,
            "TEAM_ABBREVIATION": "CHA",
            "TEAM_CITY": "Charlotte",
            "TEAM_NAME": "Hornets",
            "POSITION": "G",
            "JERSEY_NUMBER": "1",
        },
    )
    assert player["teamAbbr"] == "MIN"
    assert player["teamName"] == "Minnesota Timberwolves"
    assert player["position"] == "G"
    assert player["jerseyNumber"] == "1"


def test_from_year_is_normalized():
    player = normalize_player(
        {
            "PERSON_ID": 1642271,
            "DISPLAY_FIRST_LAST": "Rookie Player",
            "FROM_YEAR": "2026",
            "ROSTERSTATUS": 1,
        }
    )
    assert player["fromYear"] == 2026


def test_merge_prefers_active_roster_row():
    players, failed = merge_player_rows(
        [
            {
                "PERSON_ID": 1,
                "DISPLAY_FIRST_LAST": "A One",
                "ROSTERSTATUS": 1,
                "TEAM_ID": 1610612750,
                "TEAM_ABBREVIATION": "MIN",
                "TEAM_CITY": "Minnesota",
                "TEAM_NAME": "Timberwolves",
            },
            {"PERSON_ID": 1, "DISPLAY_FIRST_LAST": "A One", "ROSTERSTATUS": 0, "TEAM_ID": 0},
        ]
    )
    assert failed == 0
    assert players[0]["isActive"] is True
    assert players[0]["teamAbbr"] == "MIN"


def test_merge_deduplicates_and_counts_failures():
    players, failed = merge_player_rows(
        [
            {"PERSON_ID": 1, "DISPLAY_FIRST_LAST": "A One", "ROSTERSTATUS": 0, "TEAM_ID": 0},
            {"PERSON_ID": 1, "DISPLAY_FIRST_LAST": "A One", "ROSTERSTATUS": 1, "TEAM_ID": 1610612747, "TEAM_ABBREVIATION": "LAL", "TEAM_CITY": "Los Angeles", "TEAM_NAME": "Lakers"},
            {"DISPLAY_FIRST_LAST": "Missing"},
        ]
    )
    assert failed == 1
    assert len(players) == 1
    assert players[0]["isActive"] is True
    assert players[0]["teamAbbr"] == "LAL"


def test_fetch_player_catalog_uses_injected_fetchers_not_nba_api():
    catalog = fetch_player_catalog(
        common_fetcher=lambda: [
            {
                "PERSON_ID": 201566,
                "DISPLAY_FIRST_LAST": "Russell Westbrook",
                "TEAM_ID": 1610612743,
                "TEAM_ABBREVIATION": "DEN",
                "TEAM_CITY": "Denver",
                "TEAM_NAME": "Nuggets",
                "ROSTERSTATUS": 1,
            }
        ],
        index_fetcher=lambda: [
            {"PERSON_ID": 201566, "POSITION": "G"},
        ],
    )
    assert catalog["fetched"] == 1
    assert catalog["players"][0]["position"] == "G"
    assert catalog["indexError"] is None


def test_fetch_player_catalog_survives_index_failure():
    catalog = fetch_player_catalog(
        common_fetcher=lambda: [
            {"PERSON_ID": 2, "DISPLAY_FIRST_LAST": "Test Player", "ROSTERSTATUS": 0, "TEAM_ID": 0}
        ],
        index_fetcher=lambda: (_ for _ in ()).throw(RuntimeError("network down")),
    )
    assert catalog["fetched"] == 1
    assert catalog["players"][0]["position"] is None
    assert "network down" in catalog["indexError"]


def test_empty_common_all_players_fails():
    with pytest.raises(RuntimeError):
        fetch_player_catalog(common_fetcher=lambda: [], index_fetcher=lambda: [])


def test_catalog_is_json_serializable():
    catalog = fetch_player_catalog(
        common_fetcher=lambda: [
            {"PERSON_ID": 3, "DISPLAY_FIRST_LAST": "Json Player", "ROSTERSTATUS": 0, "TEAM_ID": 0}
        ],
        index_fetcher=None,
    )
    json.dumps(catalog)


def test_write_json_emits_utf8_for_accented_names():
    from io import BytesIO

    from sync_players import write_json

    class Stream:
        def __init__(self) -> None:
            self.buffer = BytesIO()

    stream = Stream()
    write_json({"fullName": "Bojan Bogdanović"}, stream)
    payload = stream.buffer.getvalue()
    assert "Bogdanović".encode("utf-8") in payload
    json.loads(payload.decode("utf-8"))
