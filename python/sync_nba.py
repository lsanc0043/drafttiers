"""NBA player catalog sync placeholder.

Install dependencies:
    python -m venv .venv
    .venv\\Scripts\\activate
    pip install -r python/requirements.txt

This script will later pull player data via nba_api and upsert into Postgres
through DATABASE_URL. No sync logic is implemented yet.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")


def main() -> int:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL is not set. Copy .env.example to .env first.")
        return 1

    print("NBA sync scaffold is ready. nba_api integration is not implemented yet.")
    print("Planned source: nba_api.stats.static.players")
    return 0


if __name__ == "__main__":
    sys.exit(main())
