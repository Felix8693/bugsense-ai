from pydantic import BaseModel, Field, field_validator
from enum import Enum
from typing import Optional


class UserMode(str, Enum):
    DEVELOPER = "developer"
    AI_USER = "ai_user"


class AnalyzeRequest(BaseModel):
    error_text: str = Field(
        ...,
        min_length=10,
        max_length=12000,
        description="用户粘贴的报错内容，10~12000字符",
    )
    mode: UserMode
    visitor_id: Optional[str] = Field(
        default=None,
        max_length=64,
        description="前端生成的访客ID，用于限流",
    )
    language: str = "zh"

    @field_validator("error_text")
    @classmethod
    def validate_error_text(cls, v: str) -> str:
        stripped = v.strip()
        if len(stripped) < 10:
            raise ValueError("报错内容太短，请粘贴完整的错误信息（至少10个字符）")
        if len(stripped) > 12000:
            raise ValueError("报错内容超过12000字符限制，请截取关键部分")
        return stripped


# ---- 开发者模式输出 ----


class FixStep(BaseModel):
    step: int
    action: str
    command: Optional[str] = None


class CodeChange(BaseModel):
    file: Optional[str] = None
    before: Optional[str] = None
    after: Optional[str] = None
    explanation: str


class DevAnalysisResult(BaseModel):
    error_type: str
    severity: str
    detected_tool: Optional[str] = None
    root_cause: str
    fix_steps: list[FixStep]
    code_changes: list[CodeChange]
    prevention_tips: list[str]
    confidence: float
    warnings: list[str] = []


# ---- AI工具用户模式输出 ----


class GuidedStep(BaseModel):
    step_number: int
    instruction: str
    command: Optional[str] = None
    screenshot_hint: Optional[str] = None


class UserAnalysisResult(BaseModel):
    plain_explanation: str
    severity_message: str
    detected_tool: Optional[str] = None
    steps: list[GuidedStep]
    warnings: list[str]
    success_check: str
    if_still_failing: str


# ---- 统一响应包装 ----


class AnalyzeResponse(BaseModel):
    request_id: str
    mode: UserMode
    result: DevAnalysisResult | UserAnalysisResult
    cached: bool = False
    remaining_requests: int


# ---- 统一错误响应 ----


class ErrorResponse(BaseModel):
    request_id: str
    error_code: str
    message: str
    detail: Optional[str] = None
