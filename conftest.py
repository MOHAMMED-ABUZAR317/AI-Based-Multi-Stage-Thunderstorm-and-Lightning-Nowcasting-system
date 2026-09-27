"""
Root pytest conftest.py — sets up sys.path so that:
  - `from backend.app...` and `from backend.src...` imports resolve correctly
  - `import conftest_paths` (used by Member 4 unit tests) is also importable

This file is picked up automatically by pytest because it sits at the
project root, one level above `backend/`.
"""

import sys
from pathlib import Path

# Project root  (the directory containing backend/, frontend/, ml/, etc.)
ROOT = Path(__file__).resolve().parent

# Paths to inject
_paths = [
    ROOT,                            # enables `from backend.app...`
    ROOT / "backend" / "tests",     # enables `import conftest_paths`
    ROOT / "backend" / "src",       # enables direct `from storm_tracking...` in Member 4 tests
    ROOT / "backend" / "adapters",  # Member 4 adapter modules
    ROOT / "backend" / "synthetic", # Member 4 synthetic generators
]

for p in _paths:
    s = str(p)
    if s not in sys.path:
        sys.path.insert(0, s)
