"""
pytest conftest.py for backend/tests/ — injects sys.path so that:
  - `import conftest_paths` resolves (file lives in this same directory)
  - `from backend.app...` and `from backend.src...` imports resolve correctly
    (project root must be on sys.path)
  - `from storm_tracking...` direct imports (Member 4) also resolve

This file is discovered automatically by pytest since it lives inside the
test package directory.
"""

import sys
from pathlib import Path

# backend/tests/
TESTS_DIR = Path(__file__).resolve().parent
# backend/
BACKEND_DIR = TESTS_DIR.parent
# project root (contains backend/, frontend/, ml/, etc.)
ROOT = BACKEND_DIR.parent

_paths = [
    ROOT,               # enables `from backend.app...` / `from backend.src...`
    TESTS_DIR,          # enables `import conftest_paths`
    BACKEND_DIR / "src",       # enables direct `from storm_tracking...`
    BACKEND_DIR / "adapters",  # Member 4 adapters
    BACKEND_DIR / "synthetic", # Member 4 synthetic generators
]

for p in _paths:
    s = str(p)
    if s not in sys.path:
        sys.path.insert(0, s)
