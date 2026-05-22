"""
Standalone collector script for GitHub Actions.
Avoids any import-time indentation issues by running the scheduler directly.
"""
import os
import sys

# Add repo root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Verify environment
mongodb_uri = os.environ.get('MONGODB_URI', '')
api_key = os.environ.get('THEODDSAPI_KEY', '')

if not mongodb_uri:
    print('ERROR: MONGODB_URI not set')
    sys.exit(1)

if not api_key:
    print('ERROR: THEODDSAPI_KEY not set')
    sys.exit(1)

print(f'MongoDB URI: {mongodb_uri[:30]}...')
print(f'API Key: {api_key[:8]}...')

try:
    import asyncio
    from ml.collect_data import collect_snapshot, setup_indexes, get_db

    print('Imports successful')
    db = get_db()
    setup_indexes(db)
    result = asyncio.run(collect_snapshot())
    print('Collection result:', result)
    print('Done!')

except IndentationError as e:
    print(f'IndentationError in collect_data.py: {e}')
    print('Trying alternative approach...')
    
    # Run the scheduler for just one cycle
    import subprocess
    result = subprocess.run([
        sys.executable, '-c',
        'import runpy; runpy.run_module("ml.scheduler.run", run_name="__main__", alter_sys=True)'
    ], timeout=300)
    sys.exit(result.returncode)

except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
    sys.exit(1)
