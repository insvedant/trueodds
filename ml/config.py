"""
config.py — Central configuration for TrueOdds ML service
All settings read from environment variables with sensible defaults.
"""

import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/trueodds")
DB_NAME     = "trueodds"

COL_ODDS_SNAPSHOTS  = "odds_snapshots"    
COL_LINE_MOVEMENTS  = "line_movements"    
COL_ARB_HISTORY     = "arb_history"       
COL_ML_PREDICTIONS  = "ml_predictions"   
COL_FEATURE_STORE   = "feature_store"    

ODDS_API_KEY  = os.getenv("THEODDSAPI_KEY", "")
ODDS_BASE_URL = "https://api.the-odds-api.com/v4"

TRACKED_SPORTS = [
    "americanfootball_nfl",
    "basketball_nba",
    "baseball_mlb",
    "icehockey_nhl",
    "soccer_epl",
    "mma_mixed_martial_arts",
    "tennis_atp_french_open",
]

TRACKED_BOOKS = [
    "draftkings", "fanduel", "betmgm", "caesars",
    "pointsbet", "bet365", "pinnacle", "bovada",
    "williamhill_us", "barstool",
]

SHARP_BOOKS = ["pinnacle", "circa", "bookmaker"]

COLLECTION_INTERVAL_SECONDS = 60      
HISTORICAL_LOOKBACK_DAYS    = 90      

MODEL_DIR          = os.path.join(os.path.dirname(__file__), "saved_models")
MIN_TRAINING_ROWS  = 500              
RETRAIN_INTERVAL_H = 24              

# ── Mongo → Parquet archival architecture ────────────────────────────────
# Mongo keeps only the rolling live window; anything older than this is
# archived to Parquet on local SSD and removed from Mongo to keep the
# Atlas free tier (512MB) from filling up. Training reads BOTH sources
# and merges them, so model quality is unaffected by where a row lives.
COL_STATS          = "stats"
ARCHIVE_DIR         = os.getenv("ARCHIVE_DIR", "/home/ubuntu/data_archive")
LIVE_RETENTION_DAYS = int(os.getenv("LIVE_RETENTION_DAYS", "7"))

# Archive files live under a per-collection subfolder, e.g.
#   {ARCHIVE_DIR}/odds_snapshots/year=2026/month=06/day=26.parquet
# Currently only odds_snapshots is archived (see ml/models/train.py
# comments on why line_movements/arb_history are out of scope for now),
# but the subfolder exists from day one so adding a second archived
# collection later never collides with this one's files.
ARCHIVE_SUBDIR_ODDS_SNAPSHOTS = COL_ODDS_SNAPSHOTS

# Daily archive writes favor snappy (faster write, slightly larger file) —
# this runs once a day per partition and write latency matters more than
# squeezing out the last bit of disk space on a file that's about to be
# superseded by the monthly compaction anyway.
DAILY_ARCHIVE_COMPRESSION = os.getenv("DAILY_ARCHIVE_COMPRESSION", "snappy")

# Monthly compacted files favor zstd — written once per month, read
# repeatedly by every training run thereafter, so a better compression
# ratio (smaller file, less disk I/O on every load) is worth the slightly
# slower one-time write. Verified pyarrow on this system supports zstd.
MONTHLY_COMPACT_COMPRESSION = os.getenv("MONTHLY_COMPACT_COMPRESSION", "zstd")

# Pre-existing historical backup directory from before this archival
# system existed. Schema/partitioning of these files is not guaranteed to
# match ARCHIVE_DIR's — parquet_loader.py merges both via union_by_name
# and handles missing/mismatched columns defensively rather than assuming
# the old backup has the same shape as new archive output.
LEGACY_ARCHIVE_DIR = os.getenv("LEGACY_ARCHIVE_DIR", "/home/ubuntu/parquet_backup")

MODEL_CLV        = "clv_predictor"
MODEL_SHARP      = "sharp_money_detector"
MODEL_ARB_WINDOW = "arb_window_predictor"
MODEL_EV_CONF    = "ev_confidence"

ML_API_HOST = os.getenv("ML_API_HOST", "0.0.0.0")
ML_API_PORT = int(os.getenv("ML_API_PORT", "8000"))

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
