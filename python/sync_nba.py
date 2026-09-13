"""Backward-compatible alias for python/sync_players.py."""

from __future__ import annotations

import sys

from sync_players import main


if __name__ == "__main__":
    sys.exit(main())
