path = "ml/models/train.py"
old = '''ROLLING_DAYS    = 30
MAX_SAMPLES     = 50_000
RANDOM_STATE    = 42
CI_MODE             = os.environ.get('CI_TRAINING', '').lower() == 'true'
N_ESTIMATORS_LARGE  = 50  if CI_MODE else 150
N_ESTIMATORS_MEDIUM = 30  if CI_MODE else 100
N_JOBS              = -1
logger.info(f"Training mode : {'CI-FAST' if CI_MODE else 'FULL'}")
logger.info(f"Rolling window: last {ROLLING_DAYS} days")
logger.info(f"Max samples   : {MAX_SAMPLES:,}")
logger.info(f"n_jobs        : {N_JOBS} (all cores)")'''
new = '''ROLLING_DAYS    = 30
MAX_SAMPLES     = 35_000
RANDOM_STATE    = 42
CI_MODE             = os.environ.get('CI_TRAINING', '').lower() == 'true'
N_ESTIMATORS_LARGE  = 50  if CI_MODE else 150
N_ESTIMATORS_MEDIUM = 30  if CI_MODE else 100
# Was -1 (all cores) -- on a 954MB RAM VM, each parallel sklearn worker
# process carries its own memory overhead, and that parallelism is the
# most likely driver of the OOM kill (process requested 3.8GB virtual
# memory). Single-threaded is slower but has a flat, predictable memory
# footprint instead of multiplying by core count.
N_JOBS              = 1
logger.info(f"Training mode : {'CI-FAST' if CI_MODE else 'FULL'}")
logger.info(f"Rolling window: last {ROLLING_DAYS} days")
logger.info(f"Max samples   : {MAX_SAMPLES:,}")
logger.info(f"n_jobs        : {N_JOBS} (single-threaded -- reduced for memory safety)")'''
content = open(path).read()
count = content.count(old)
if count != 1:
    print(f"SAFETY CHECK FAILED -- found {count} matches (expected exactly 1). Not touching the file.")
else:
    content = content.replace(old, new)
    open(path, "w").write(content)
    print("Patched successfully.")
