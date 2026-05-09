# BugSense AI

Paste an error message, get a diagnosis and fix suggestion powered by AI.

## Tech Stack

- **Backend**: Python 3.11, FastAPI, Uvicorn
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Cache / Rate Limit**: Redis 7
- **AI**: MIMO (via OpenAI-compatible API)

## Local Development (no Docker)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
cp .env.example .env           # fill in MIMO_API_KEY, MIMO_BASE_URL, MIMO_MODEL
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                    # http://localhost:3000
```

### Redis (required for cache + rate limit)

Install Redis locally, or run:

```bash
docker run -d --name bugsense-redis -p 6379:6379 redis:7-alpine
```

## Docker + Redis

### 1. Create `.env` at project root

```bash
cp backend/.env.example .env
```

Edit `.env` and fill in your values:

| Variable | Example |
|---|---|
| MIMO_API_KEY | your-real-api-key |
| MIMO_BASE_URL | https://api.example.com/v1 |
| MIMO_MODEL | mimo-v2.5-pro |
| ACTIVE_PROVIDER | mimo |
| CORS_ORIGINS | http://localhost:3000,http://127.0.0.1:3000 |
| ENVIRONMENT | development |
| VISITOR_DAILY_LIMIT | 10 |
| IP_DAILY_LIMIT | 30 |

> REDIS_URL is set automatically inside docker-compose to `redis://redis:6379`.

### 2. Start

```bash
docker compose up --build -d
```

### 3. View logs

```bash
docker compose logs -f backend
```

### 4. Stop

```bash
docker compose down
```

## API Endpoints

### Health check

```bash
curl http://localhost:8000/health
```

### Analyze

```bash
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"error_message": "NullPointerException at com.example.App.main(App.java:10)", "language": "java"}'
```

Sending the same error message again will return `"cached": true`.

## Troubleshooting

**MIMO_BASE_URL format**
Do NOT use `https://xxxxxx/v1` — that is a placeholder. Use the actual base URL of your MIMO API endpoint, e.g. `https://api.example.com/v1`. The `/v1` suffix is required.

**`.env` should not be committed**
The `.gitignore` already excludes `.env`. Never commit files containing real API keys to GitHub.

**PowerShell Chinese garbled output**
Terminal display of Chinese characters may look garbled in PowerShell. This does not affect the frontend — Chinese text renders correctly in the browser.
