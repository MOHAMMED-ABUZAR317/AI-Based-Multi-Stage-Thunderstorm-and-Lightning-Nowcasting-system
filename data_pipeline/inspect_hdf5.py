"""Inspect the top-level datasets and attributes of a supplied INSAT HDF5 file."""

from __future__ import annotations

import argparse
from pathlib import Path

import h5py


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_file", type=Path, help="Path to a supplied .h5/.hdf file")
    args = parser.parse_args()
    source_path = args.source_file.expanduser().resolve()
    if not source_path.is_file():
        parser.error(f"source file does not exist: {source_path}")

    with h5py.File(source_path, "r") as source:
        print(f"Datasets in {source_path.name}:")

        def report(name: str, value: object) -> None:
            if isinstance(value, h5py.Dataset):
                print(f"  {name}: shape={value.shape}, dtype={value.dtype}")
            elif isinstance(value, h5py.Group):
                print(f"  {name}/")

        source.visititems(report)
        print("Root attributes:")
        for name, value in source.attrs.items():
            print(f"  {name}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
