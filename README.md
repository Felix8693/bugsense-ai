# BugSense AI

BugSense AI is an AI-powered error log analysis tool for developers and AI tool users.

Users can paste error logs from Python, Node.js, Docker, Next.js, Git, CI/CD, or AI coding tools. BugSense AI will analyze the error and return a structured explanation, including root cause, fix steps, code change suggestions, and prevention tips.

## Online Demo

Frontend:

https://bugsense-ai-flame.vercel.app

Backend health check:

https://bugsense-ai-production.up.railway.app/health

## Features

- Paste error logs and get AI-powered debugging suggestions
- Supports Python, Node.js, Docker, Next.js, Git, CI/CD and common development errors
- Automatically detects error type locally before AI analysis
- Provides root cause, fix steps, code suggestions and prevention tips
- Redis-based result cache
- IP and visitor_id based rate limiting
- Secret redaction before sending logs to the model
- Frontend proxy route for safer API calls
- Deployed with Vercel frontend and Railway backend

## Tech Stack

### Frontend

- Next.js
- TypeScript
- React
- Vercel

### Backend

- FastAPI
- Python
- Uvicorn
- Redis
- Docker
- Railway

### AI Provider

- MiMo API
- OpenAI-compatible chat completions API

## Project Structure

```text
bugsense-ai/
├── backend/
│   ├── main.py
│   ├── providers/
│   ├── core/
│   └── requirements.txt
├── frontend/
│   ├── app/
│   ├── app/api/analyze/route.ts
│   └── package.json
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md

![BugSense AI Screenshot](./docs/home-page.png)
