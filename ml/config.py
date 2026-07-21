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

RETRAIN_INTERVAL_H = 12              



MODEL_CLV        = "clv_predictor"

MODEL_SHARP      = "sharp_money_detector"

MODEL_ARB_WINDOW = "arb_window_predictor"

MODEL_EV_CONF    = "ev_confidence"



ML_API_HOST = os.getenv("ML_API_HOST", "0.0.0.0")

ML_API_PORT = int(os.getenv("ML_API_PORT", "8000"))



LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
