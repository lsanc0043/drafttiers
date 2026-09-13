"""Manual NBA stats sync entry point.

Prints a single JSON object to stdout. Next.js/Prisma owns persistence.
"""

from __future__ import annotations

import argparse
import sys
import traceback
from pathlib import Path

from dotenv import load_dotenv

from nba_stats import fetch_stats_bundle
from sync_players import configure_utf8_stdio, write_json

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--player-id", type=int, default=None)
    args = parser.parse_args(argv)

    configure_utf8_stdio()
    try:
        payload = fetch_stats_bundle(nba_person_id=args.player_id)
        write_json(payload, sys.stdout)
        return 0
    except Exception as exc:  # noqa: BLE001 - CLI must surface fetch/normalize failure
        error = {"success": False, "error": str(exc)}
        write_json(error, sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
