"""Manual NBA player catalog sync entry point.

Prints a single JSON object to stdout. Exits non-zero on failure.
Does not write to the database; Next.js/Prisma owns persistence.
"""

from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path

from dotenv import load_dotenv

from nba_players import fetch_player_catalog

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")


def configure_utf8_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8")


def write_json(payload: object, stream: object) -> None:
    encoded = json.dumps(payload, ensure_ascii=False) + "\n"
    buffer = getattr(stream, "buffer", None)
    if buffer is not None:
        buffer.write(encoded.encode("utf-8"))
        buffer.flush()
        return
    stream.write(encoded)
    stream.flush()


def main() -> int:
    configure_utf8_stdio()
    try:
        payload = fetch_player_catalog()
        write_json(payload, sys.stdout)
        return 0
    except Exception as exc:  # noqa: BLE001 - CLI must surface any fetch/normalize failure
        error = {"success": False, "error": str(exc)}
        write_json(error, sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
