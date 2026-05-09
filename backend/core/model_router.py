import os
import logging
from providers.base import BaseModelProvider

logger = logging.getLogger(__name__)


class ModelRouter:
    def __init__(self):
        self._providers: dict[str, BaseModelProvider] = {}
        self._active = os.getenv("ACTIVE_PROVIDER", "mimo")

    def register(self, name: str, provider: BaseModelProvider):
        self._providers[name] = provider

    def switch(self, name: str):
        if name not in self._providers:
            raise ValueError(f"Provider '{name}' not registered. Available: {list(self._providers.keys())}")
        self._active = name

    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        if self._active not in self._providers:
            raise ValueError(
                f"ACTIVE_PROVIDER '{self._active}' is not registered. "
                f"Available providers: {list(self._providers.keys())}"
            )
        provider = self._providers[self._active]
        return await provider.complete(system_prompt, user_prompt)


def create_router() -> ModelRouter:
    router = ModelRouter()
    from providers.mimo import MiMoProvider
    router.register("mimo", MiMoProvider())
    # 预留：
    # from providers.claude import ClaudeProvider
    # router.register("claude", ClaudeProvider())
    # from providers.deepseek import DeepSeekProvider
    # router.register("deepseek", DeepSeekProvider())
    return router
