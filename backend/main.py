import uuid
import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from routers import analyze

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def generate_request_id() -> str:
    return f"req_{uuid.uuid4().hex[:8]}"


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = generate_request_id()
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 初始化 Redis 相关服务（允许失败，主流程降级）
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    rate_limiter = None
    result_cache = None
    redis_available = False

    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(redis_url)
        await r.ping()
        await r.aclose()
        redis_available = True
        logger.info("Redis 连接成功")
    except Exception as e:
        logger.warning(f"Redis 不可用，限流和缓存功能降级: {e}")

    if redis_available:
        try:
            from middleware.rate_limit import RateLimiter
            rate_limiter = RateLimiter(redis_url)
            logger.info("RateLimiter 初始化成功")
        except Exception as e:
            logger.warning(f"RateLimiter 初始化失败: {e}")

        try:
            from core.cache import ResultCache
            result_cache = ResultCache(redis_url)
            logger.info("ResultCache 初始化成功")
        except Exception as e:
            logger.warning(f"ResultCache 初始化失败: {e}")
    else:
        logger.warning("跳过 RateLimiter 和 ResultCache 初始化")

    # 初始化 Model Router
    model_router = None
    try:
        from core.model_router import create_router
        model_router = create_router()
        logger.info(f"ModelRouter 初始化成功，active provider: {model_router._active}")
    except Exception as e:
        logger.warning(f"ModelRouter 初始化失败，分析功能不可用: {e}")

    # 存入 app.state 供路由使用
    app.state.rate_limiter = rate_limiter
    app.state.result_cache = result_cache
    app.state.model_router = model_router

    yield


app = FastAPI(
    title="BugSense AI Backend",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
cors_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
cors_origins = [origin.strip() for origin in cors_origins_raw.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request ID
app.add_middleware(RequestIDMiddleware)

# Routers
app.include_router(analyze.router, prefix="/api")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "0.1.0",
        "service": "bugsense-ai-backend",
    }
