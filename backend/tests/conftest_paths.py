"""
Shared sys.path bootstrap for tests, adapters and the synthetic generator.

NOTE: pytest is not installed in this sandbox (no network access to fetch
it), so the actual test *runner* used here is Python's built-in
`unittest` (see tests/run_all.py). Test files are still organised and
named the pytest-conventional way (`test_*.py`, `test_*` functions/classes)
so they will also work unmodified if pytest becomes available later
(e.g. in CI / on a machine with internet access).
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for p in (ROOT / "src", ROOT, ROOT / "adapters", ROOT / "synthetic"):
    sp = str(p)
    if sp not in sys.path:
        sys.path.insert(0, sp)
