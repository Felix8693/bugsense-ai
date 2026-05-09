import hashlib
import json
import redis.asyncio as redis
import random

CACHE_TTL_MIN = 60 * 60 * 24    # 24小时
CACHE_TTL_MAX = 60 * 60 * 72    # 72小时


class ResultCache:
    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url)

    def _make_key(self, redacted_text: str, mode: str, detected_tool: str) -> str:
        content = f"{mode}:{detected_tool}:{redacted_text.strip()}"
        return f"cache:{hashlib.sha256(content.encode()).hexdigest()}"

    async def get(self, redacted_text: str, mode: str, detected_tool: str):
        key = self._make_key(redacted_text, mode, detected_tool)
        try:
            data = await self.redis.get(key)
            if data:
                return json.loads(data)
        except Exception:
            pass
        return None

    async def set(self, redacted_text: str, mode: str, detected_tool: str, result: dict):
        key = self._make_key(redacted_text, mode, detected_tool)
        ttl = random.randint(CACHE_TTL_MIN, CACHE_TTL_MAX)
        try:
            await self.redis.setex(key, ttl, json.dumps(result, ensure_ascii=False))
        except Exception:
            pass
