"""
Run the full test suite.

NOTE ON TOOLING: The task instructions specify pytest. This sandbox has no
network access, so `pip install pytest` cannot succeed here (see final
report). All tests are written using Python's built-in `unittest` module
instead, with pytest-style file/function naming so they remain
pytest-compatible if this project is later run somewhere with pytest
available (`pip install pytest && pytest tests/`).

Usage:
    python tests/run_all.py
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite = loader.discover(start_dir=str(Path(__file__).resolve().parent), pattern="test_*.py")
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
