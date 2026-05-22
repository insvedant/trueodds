"""
Standalone script for GitHub Actions — collects one odds snapshot.
Run from repo root: python ml/run_collect.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.collect_data import collect_snapshot, setup_indexes, get_db

def main():
    db = get_db()
    setup_indexes(db)
    result = asyncio.run(collect_snapshot())
    print('Collection result:', result)

if __name__ == '__main__':
    main()
