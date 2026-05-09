import os
import httpx
import logging
from providers.base import BaseModelProvider
from fastapi import HTTPException

logger = logging.getLogger(__name__)


class MiMoProvider(BaseModelProvider):
    def __init__(self):
        self.base_url = os.getenv("MIMO_BASE_URL", "").rstrip("/")
        self.api_key = os.getenv("MIMO_API_KEY", "")
        self.model = os.getenv("MIMO_MODEL", "mimo-v2.5-pro")
        self.timeout = 60.0

        if not self.base_url or not self.api_key:
            raise RuntimeError("MIMO_BASE_URL 和 MIMO_API_KEY 必须在环境变量中配置")

    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 2048,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, headers=headers, json=payload)

                if response.status_code == 401:
                    logger.error("MiMo API 鉴权失败，请检查 MIMO_API_KEY")
                    raise HTTPException(status_code=502, detail={
                        "error_code": "UPSTREAM_ERROR",
                        "message": "上游模型鉴权失败，请联系管理员",
                    })

                if response.status_code == 429:
                    logger.warning("MiMo API 限流")
                    raise HTTPException(status_code=502, detail={
                        "error_code": "UPSTREAM_ERROR",
                        "message": "上游模型服务繁忙，请稍后重试",
                    })

                if response.status_code >= 500:
                    logger.error(f"MiMo API 服务端错误: {response.status_code} {response.text[:200]}")
                    raise HTTPException(status_code=502, detail={
                        "error_code": "UPSTREAM_ERROR",
                        "message": "上游模型服务不可用，请稍后重试",
                    })

                if response.status_code != 200:
                    logger.error(f"MiMo API 未知错误: {response.status_code}")
                    raise HTTPException(status_code=500, detail={
                        "error_code": "MODEL_ERROR",
                        "message": "AI 分析服务异常，请稍后重试",
                    })

                data = response.json()
                try:
                    content = data["choices"][0]["message"]["content"]
                    return content
                except (KeyError, IndexError):
                    logger.error(f"MiMo 响应格式异常: {data}")
                    raise HTTPException(status_code=500, detail={
                        "error_code": "MODEL_ERROR",
                        "message": "AI 返回格式异常，请稍后重试",
                    })

        except HTTPException:
            raise
        except httpx.TimeoutException:
            logger.error("MiMo API 调用超时")
            raise HTTPException(status_code=504, detail={
                "error_code": "TIMEOUT",
                "message": "分析超时，请缩短报错内容后重试",
            })

        except httpx.RequestError as e:
            logger.error(f"MiMo API 网络错误: {e}")
            raise HTTPException(status_code=502, detail={
                "error_code": "UPSTREAM_ERROR",
                "message": "无法连接到 AI 服务，请检查网络后重试",
            })
