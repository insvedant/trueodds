"""
check_archive_integrity.py — how much of the Parquet archive lost its odds?

An earlier bug in archive_snapshots.py wrote any batch that happened to START with an
"unchanged" marker document WITHOUT the book_odds column, discarding the odds of every
real snapshot in that batch (and then deleted the originals from MongoDB). This tool
measures the damage. It only reads file metadata and one small column; it changes nothing.

    cd ~/trueodds && ./ml/venv/bin/python -m ml.check_archive_integrity
"""
import glob
import os
import sys

import pyarrow.parquet as pq

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ml.config import ARCHIVE_DIR, LEGACY_ARCHIVE_DIR


def main() -> int:
    for label, root in (("new archive", ARCHIVE_DIR), ("legacy backup", LEGACY_ARCHIVE_DIR)):
        files = sorted(glob.glob(os.path.join(root, "**", "*.parquet"), recursive=True))
        total_files = len(files)
        files_no_odds = rows_total = rows_lost = rows_with_odds = unreadable = 0
        worst_days = {}
        for f in files:
            try:
                pf = pq.ParquetFile(f)
                names = pf.schema_arrow.names
                n = pf.metadata.num_rows
                rows_total += n
                if "book_odds" in names:
                    col = pq.read_table(f, columns=["book_odds"]).column("book_odds")
                    rows_with_odds += len(col) - col.null_count
                    continue
                files_no_odds += 1
                if "is_duplicate" in names:
                    flags = pf.read(columns=["is_duplicate"]).column("is_duplicate").to_pylist()
                    lost = sum(1 for x in flags if x is not True)
                else:
                    lost = n
                rows_lost += lost
                day = next((p for p in f.split(os.sep) if p.startswith("day=")), "?")
                month = next((p for p in f.split(os.sep) if p.startswith("month=")), "?")
                worst_days[f"{month}/{day}"] = worst_days.get(f"{month}/{day}", 0) + lost
            except Exception as e:
                unreadable += 1
                print(f"  unreadable: {f}: {str(e).splitlines()[0][:120]}")
        print(f"\n{label}: {root}")
        if not total_files:
            print("  no parquet files")
            continue
        print(f"  files: {total_files:,} ({files_no_odds:,} have no book_odds column, {unreadable} unreadable)")
        print(f"  rows : {rows_total:,} total | {rows_with_odds:,} carry odds")
        print(f"  snapshots that were REAL but have NO odds (data lost by the old writer): {rows_lost:,}")
        if worst_days:
            top = sorted(worst_days.items(), key=lambda kv: -kv[1])[:5]
            print("  most affected days:", ", ".join(f"{d} ({n:,})" for d, n in top))
    print("\nNote: markers (is_duplicate=True) legitimately carry no odds and are not counted as lost.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
