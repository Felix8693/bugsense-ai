import redis.asyncio as redis
from fastapi import Request, HTTPException
from datetime import date
import hashlib
import os

VISITOR_DAILY_LIMIT = int(os.getenv("VISITOR_DAILY_LIMIT", "10"))
IP_DAILY_LIMIT = int(os.getenv("IP_DAILY_LIMIT", "30"))


class RateLimiter:
    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url)
        self.environment = os.getenv("ENVIRONMENT", "development")

    def _get_real_ip(self, request: Request) -> str:
        client_ip = request.client.host if request.client else "unknown"

        if self.environment != "production":
            return client_ip

        forwarded = request.headers.get("X-Forwarded-For", "")
        if forwarded:
            return forwarded.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP", "")
        if real_ip:
            return real_ip.strip()

        return client_ip

    def _hash(self, value: str) -> str:
        return hashlib.sha256(value.encode()).hexdigest()[:16]

    def _today(self) -> str:
        return date.today().isoformat()

    async def _check_limit(self, key: str, limit: int, error_code: str) -> int:
        count = await self.redis.incr(key)
        if count == 1:
            await self.redis.expire(key, 86400)
        if count > limit:
            raise HTTPException(
                status_code=429,
                detail={
                    "error_code": error_code,
                    "message": f"今日免费次数已用完（每日{limit}次），明天 00:00 重置",
                },
            )
        return limit - count

    async def check(self, request: Request, visitor_id: str | None) -> int:
        today = self._today()
        real_ip = self._get_real_ip(request)

        remaining_ip = await self._check_limit(
            f"rate:ip:{self._hash(real_ip)}:{today}",
            IP_DAILY_LIMIT,
            "RATE_LIMIT_IP",
        )

        remaining_visitor = IP_DAILY_LIMIT
        if visitor_id and len(visitor_id) >= 8:
            remaining_visitor = await self._check_limit(
                f"rate:vid:{self._hash(visitor_id)}:{today}",
                VISITOR_DAILY_LIMIT,
                "RATE_LIMIT_VISITOR",
            )

        return min(remaining_ip, remaining_visitor)
