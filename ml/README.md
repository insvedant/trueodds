# TrueOdds ML Service

Machine learning pipeline for sports betting predictions.

## Architecture

```
TheOddsAPI (every 60s)
↓
collect_data.py → MongoDB (odds_snapshots, line_movements, arb_history)
↓
features.py → builds ML feature vectors
↓
models/train.py → trains XGBoost/sklearn models (every 24h)
↓
models/predict.py → generates predictions → MongoDB (ml_predictions)
↓
api/server.py (FastAPI :8000) → Node.js backend reads predictions
↓
Frontend /dashboard/insights → users see predictions
```

## Setup

### 1. Install Python dependencies
```bash
cd trueodds/ml
pip install -r requirements.txt
```

### 2. Set your API key
Edit `.env`:
```
THEODDSAPI_KEY=your_real_key_here
MONGODB_URI=mongodb://localhost:27017/trueodds
```

### 3. Import historical data (run once)
```bash
python import_historical.py --days 90
```
This imports 90 days of historical odds — uses ~270 API requests.

### 4. Start the scheduler (runs everything automatically)
```bash
python -m ml.scheduler.run
```

This runs:
- Odds collection every 60 seconds
- ML predictions every 5 minutes
- Model retraining every 24 hours

### 5. Start the FastAPI server (separate terminal)
```bash
uvicorn ml.api.server:app --host 0.0.0.0 --port 8000 --reload
```

## Models

| Model | What it predicts | Min data needed |
|---|---|---|
| CLV Predictor | Whether odds will get better or worse | 500 snapshots |
| Sharp Money Detector | Professional betting signals | 500 snapshots |
| Arb Window Predictor | How long an arb will last (minutes) | 100 resolved arbs |
| EV Confidence Scorer | Reliability of +EV signals | 500 snapshots |

## Production deployment

Run both processes with PM2:
```bash
# Scheduler
pm2 start "python -m ml.scheduler.run" --name ml-scheduler --cwd /var/www/trueodds

# FastAPI server
pm2 start "uvicorn ml.api.server:app --host 0.0.0.0 --port 8000" --name ml-api --cwd /var/www/trueodds
pm2 save
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /health | Service health + data counts |
| GET | /predictions/{event_id} | All predictions for one event |
| GET | /predictions/batch/all | All recent predictions |
| GET | /sharp-money | Sharp money signals |
| GET | /arb-windows | Arb urgency predictions |
| POST | /predict/ev | Score a single EV bet |
| GET | /insights/{user_id} | Personal edge analysis |

Node.js accesses these via `/api/ml/*` routes (proxied automatically).
