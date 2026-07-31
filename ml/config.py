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

COL_STATS           = "ml_stats"         

# Cold-storage archival — moves odds_snapshots older than LIVE_RETENTION_DAYS
# out of MongoDB and into local Parquet files, one batch file per day:
#   {ARCHIVE_DIR}/{ARCHIVE_SUBDIR_ODDS_SNAPSHOTS}/year=YYYY/month=MM/day=DD/batch_NNNN.parquet
# Matches the directory layout that already exists on the VM.
ARCHIVE_DIR = "/home/ubuntu/data_archive"
ARCHIVE_SUBDIR_ODDS_SNAPSHOTS = "odds_snapshots"
LIVE_RETENTION_DAYS = 7
DAILY_ARCHIVE_COMPRESSION = "snappy"
# Older, pre-existing Parquet backup from before the current archive
# structure — parquet_loader.py reads both locations when loading
# historical data for training.
LEGACY_ARCHIVE_DIR = "/home/ubuntu/parquet_backup"



ODDS_API_KEY  = os.getenv("THEODDSAPI_KEY", "")

ODDS_BASE_URL = "https://api.the-odds-api.com/v4"



TRACKED_SPORTS = [

    "americanfootball_nfl",

    "americanfootball_ncaaf",

    "basketball_nba",

    "basketball_wnba",

    "baseball_mlb",

    "icehockey_nhl",

    "soccer_epl",

    "mma_mixed_martial_arts",

    "tennis_atp_french_open",

    "aussierules_afl",

    "rugbyleague_nrl",

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

RETRAIN_INTERVAL_H = 12              



MODEL_CLV        = "clv_predictor"

MODEL_SHARP      = "sharp_money_detector"

MODEL_ARB_WINDOW = "arb_window_predictor"

MODEL_EV_CONF    = "ev_confidence"



ML_API_HOST = os.getenv("ML_API_HOST", "0.0.0.0")

ML_API_PORT = int(os.getenv("ML_API_PORT", "8000"))



LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
