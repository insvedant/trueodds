"""
config.py — Central configuration for TrueOdds ML service
All settings read from environment variables with sensible defaults.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── MongoDB ────────────────────────────────────────────────────────────────
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/trueodds")
DB_NAME     = "trueodds"

# Collections
COL_ODDS_SNAPSHOTS  = "odds_snapshots"    # every raw odds fetch stored here
COL_LINE_MOVEMENTS  = "line_movements"    # computed line movement events
COL_ARB_HISTORY     = "arb_history"       # historical arb opportunities
COL_ML_PREDICTIONS  = "ml_predictions"   # model outputs stored here
COL_FEATURE_STORE   = "feature_store"    # pre-computed features for training

# ── TheOddsAPI ────────────────────────────────────────────────────────────
ODDS_API_KEY  = os.getenv("THEODDSAPI_KEY", "")
ODDS_BASE_URL = "https://api.the-odds-api.com/v4"

# Sports to track (add more as needed)
TRACKED_SPORTS = [
    "americanfootball_nfl",
    "basketball_nba",
    "baseball_mlb",
    "icehockey_nhl",
    "soccer_epl",
    "mma_mixed_martial_arts",
    "tennis_atp_french_open",
]

# Books to track for ML (more = better models)
TRACKED_BOOKS = [
    "draftkings", "fanduel", "betmgm", "caesars",
    "pointsbet", "bet365", "pinnacle", "bovada",
    "williamhill_us", "barstool",
]

# Sharp books used as reference for true probability
SHARP_BOOKS = ["pinnacle", "circa", "bookmaker"]

# ── Collection schedule ───────────────────────────────────────────────────
COLLECTION_INTERVAL_SECONDS = 60      # paid plan — collect every 60 seconds
HISTORICAL_LOOKBACK_DAYS    = 90      # import 90 days of history on first run

# ── ML Model settings ─────────────────────────────────────────────────────
MODEL_DIR          = os.path.join(os.path.dirname(__file__), "saved_models")
MIN_TRAINING_ROWS  = 500              # minimum samples before training
RETRAIN_INTERVAL_H = 24              # retrain models every 24 hours

# Model names
MODEL_CLV        = "clv_predictor"
MODEL_SHARP      = "sharp_money_detector"
MODEL_ARB_WINDOW = "arb_window_predictor"
MODEL_EV_CONF    = "ev_confidence"

# ── FastAPI server ────────────────────────────────────────────────────────
ML_API_HOST = os.getenv("ML_API_HOST", "0.0.0.0")
ML_API_PORT = int(os.getenv("ML_API_PORT", "8000"))

# ── Logging ───────────────────────────────────────────────────────────────
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
