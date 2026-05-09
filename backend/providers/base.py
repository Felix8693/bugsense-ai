from abc import ABC, abstractmethod


class BaseModelProvider(ABC):
    @abstractmethod
    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        pass
