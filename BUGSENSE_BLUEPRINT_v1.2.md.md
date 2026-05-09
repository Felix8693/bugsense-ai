# BugSense AI — 完整项目蓝图文档 v1.2
> 更新日期：2026-05  
> 本文档用于交给 Claude Code 执行，包含所有架构、目录结构、代码规范、部署方案的完整定义。  
> v1.1 变更摘要：降低 MVP 复杂度 / 补充工具识别 / 输入校验 / 敏感信息脱敏 / JSON 解析增强 / 限流增强 / 缓存策略调整 / 部署方案修正 / 字体修正 / 本地开发修正 / 错误响应标准化 / 最小测试样例  
> v1.2 小修摘要：requirements.txt 改兼容范围版本 / 环境变量 ACTIVE_PROVIDER + MIMO_MODEL / 缓存命中也追加 redactor warning / ToolBadge 纯前端判断 / 限流 IP 读取简化 / MiMo OpenAI-compatible 调用约定补全

---

## 0. 项目概述

**产品名称**：BugSense AI  
**产品定位**：面向开发者和 AI 工具用户的中文智能报错诊断平台  
**核心价值**：粘贴报错 → 30 秒看懂 + 拿到可执行的修复方案  
**目标用户**：海外中文用户（开发者 + AI 工具用户）  
**服务器位置**：香港优先  
**MVP 策略**：无需注册，IP + visitor_id 双轨限流，最快上线验证

---

## 1. 技术栈全景

```
前端：Next.js 14 (App Router) + TypeScript + Tailwind CSS
后端：Python 3.11 + FastAPI + Uvicorn
AI层：Model Router（先接 MiMo，可扩展 Claude/GPT/DeepSeek）
缓存/限流：Redis（报错 hash 缓存 + IP/visitor_id 双轨限流）
部署-前端：Vercel（主）/ Cloudflare Pages（备）/ 香港 VPS（备）
部署-后端：Railway 香港区（主）/ 腾讯云或阿里云香港轻量服务器 Docker 部署（备）
容器化：Docker（仅后端 + Redis）
代码仓库：GitHub（单 monorepo）
CI/CD：MVP 阶段手动部署，V0.2 后再引入 GitHub Actions
```

---

## 2. Monorepo 目录结构

```
bugsense-ai/
├── frontend/                        # Next.js 前端
│   ├── app/
│   │   ├── layout.tsx               # 全局布局（系统中文字体、主题）
│   │   ├── page.tsx                 # 首页（主功能页）
│   │   ├── globals.css
│   │   └── api/
│   │       └── analyze/
│   │           └── route.ts         # Next.js API Route（转发到后端）
│   ├── components/
│   │   ├── ErrorInput.tsx           # 报错粘贴区
│   │   ├── ModeToggle.tsx           # 开发者/AI用户 模式切换
│   │   ├── AnalysisResult.tsx       # 结果展示容器
│   │   ├── result-cards/
│   │   │   ├── DevResultCard.tsx    # 开发者模式结果卡片
│   │   │   └── UserResultCard.tsx   # AI工具用户模式结果卡片
│   │   ├── ToolBadge.tsx            # 自动识别工具标签
│   │   ├── RateLimitBanner.tsx      # 限流提示
│   │   └── LoadingState.tsx         # 普通 loading 动画（V0.1 不做流式）
│   ├── lib/
│   │   ├── api.ts                   # 前端 API 调用封装
│   │   ├── visitor.ts               # visitor_id 生成与持久化（localStorage）
│   │   └── types.ts                 # 共享类型定义
│   ├── public/
│   ├── package.json
│   ├── tailwind.config.ts
│   └── next.config.ts
│
├── backend/                         # FastAPI 后端
│   ├── main.py                      # 入口文件
│   ├── routers/
│   │   └── analyze.py               # /analyze 路由
│   ├── core/
│   │   ├── log_parser.py            # 场景识别器（含新增工具）
│   │   ├── prompt_engine.py         # Prompt 构建器（双模式）
│   │   ├── model_router.py          # Model Router（可插拔）
│   │   ├── output_parser.py         # AI 输出解析器（含 JSON 增强）
│   │   ├── redactor.py              # 敏感信息脱敏器（新增）
│   │   └── cache.py                 # 结果缓存（脱敏后缓存）
│   ├── providers/
│   │   ├── base.py                  # 抽象基类
│   │   ├── mimo.py                  # MiMo 提供商
│   │   ├── claude.py                # Claude 提供商（预留）
│   │   ├── openai_provider.py       # OpenAI 提供商（预留）
│   │   └── deepseek.py              # DeepSeek 提供商（预留）
│   ├── middleware/
│   │   └── rate_limit.py            # IP + visitor_id 双轨限流
│   ├── schemas/
│   │   └── models.py                # Pydantic 数据模型（含校验）
│   ├── knowledge/
│   │   └── ai_tools_errors.py       # AI工具报错知识库
│   ├── tests/
│   │   └── test_cases.py            # 最小测试样例（6个标准场景）
│   ├── requirements.txt
│   ├── Dockerfile                   # 仅后端
│   └── .env.example
│
├── docker-compose.yml               # 本地开发：仅 backend + redis
│                                    # frontend 用 npm run dev 单独启动
└── README.md
```

---

## 3. 核心数据模型（Pydantic Schemas）

```python
# backend/schemas/models.py

from pydantic import BaseModel, Field, field_validator
from enum import Enum
from typing import Optional
import uuid

class UserMode(str, Enum):
    DEVELOPER = "developer"
    AI_USER = "ai_user"

class AnalyzeRequest(BaseModel):
    error_text: str = Field(
        ...,
        min_length=10,
        max_length=12000,
        description="用户粘贴的报错内容，10~12000字符"
    )
    mode: UserMode
    visitor_id: Optional[str] = Field(
        default=None,
        max_length=64,
        description="前端生成的访客ID，用于限流"
    )
    language: str = "zh"

    @field_validator("error_text")
    @classmethod
    def validate_error_text(cls, v: str) -> str:
        # 后端强制校验，不依赖前端
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
    severity: str                    # critical | high | medium | low
    detected_tool: Optional[str] = None
    root_cause: str
    fix_steps: list[FixStep]
    code_changes: list[CodeChange]
    prevention_tips: list[str]
    confidence: float
    warnings: list[str] = []        # 包含敏感信息提醒（如检测到 API Key）

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
    warnings: list[str]             # 包含敏感信息提醒
    success_check: str
    if_still_failing: str

# ---- 统一响应包装 ----
class AnalyzeResponse(BaseModel):
    request_id: str                  # 每次请求唯一ID，便于排查
    mode: UserMode
    result: DevAnalysisResult | UserAnalysisResult
    cached: bool = False
    remaining_requests: int          # 今日剩余次数

# ---- 统一错误响应 ----
class ErrorResponse(BaseModel):
    request_id: str
    error_code: str                  # 见下方错误码表
    message: str                     # 用户可读的中文提示
    detail: Optional[str] = None     # 技术细节（开发模式下显示）
```

---

## 4. 统一 API 错误响应规范

所有错误响应统一格式，前端按 `error_code` 处理：

```python
# 错误码表
ERROR_CODES = {
    # 400 Bad Request
    "INVALID_INPUT":        (400, "输入内容格式不正确"),
    "TOO_SHORT":            (400, "报错内容太短，请粘贴完整错误信息"),

    # 413 Payload Too Large
    "TOO_LONG":             (413, "报错内容超过12000字符，请截取关键部分"),

    # 429 Too Many Requests
    "RATE_LIMIT_IP":        (429, "该IP今日免费次数已用完（每日30次），明天重置"),
    "RATE_LIMIT_VISITOR":   (429, "今日免费次数已用完（每日10次），明天重置"),

    # 500 Internal Server Error
    "MODEL_ERROR":          (500, "AI 分析服务暂时异常，请稍后重试"),
    "PARSE_ERROR":          (500, "分析结果解析失败，已返回基础建议"),

    # 502 Bad Gateway
    "UPSTREAM_ERROR":       (502, "上游模型服务不可用，请稍后重试"),

    # 504 Gateway Timeout
    "TIMEOUT":              (504, "分析超时，请缩短报错内容后重试"),
}

# 每个请求在 middleware 中生成 request_id
# 格式：req_xxxxxxxx（8位hex）
import uuid
def generate_request_id() -> str:
    return f"req_{uuid.uuid4().hex[:8]}"
```

---

## 5. 场景识别器 v1.1（Log Parser）

```python
# backend/core/log_parser.py

TOOL_PATTERNS = {
    # AI 编程工具
    "claude_code": [
        "claude code",
        "anthropic",
        "claude-3", "claude-opus", "claude-sonnet", "claude-haiku",
        "configured model not available",       # 新增
        "gateway couldn't serve",               # 新增
        "claude code is not configured",        # 新增
        "model not available for your plan",    # 新增
    ],
    "cursor": [
        "cursor",
        ".cursor/mcp",
        "cursor-mcp",
        "cursor settings",
    ],
    "mcp": [
        "mcp server",
        "mcp error",
        "tool not found",
        "mcp.json",
        "mcp client",
        "mcp connection",
        "failed to connect to mcp",
    ],
    "windsurf": ["windsurf", "codeium"],

    # 新增：AI Agent 工具
    "openclaw": [                               # 新增
        "openclaw",
        "open claw",
        "gateway port 18790",
        "claw gateway",
        "openclaw connection",
        "openclaw install",
    ],
    "hermes_agent": [                           # 新增
        "hermes",
        "hermes agent",
        "hermes install",
        "hermes-agent",
        "hermes config",
    ],

    # 本地模型
    "ollama": [
        "ollama",
        "localhost:11434",
        "pull model manifest",
        "ollama serve",
        "ollama run",
    ],
    "lm_studio": ["lm studio", "lmstudio"],
    "llama_cpp": ["llama.cpp", "llama-server"],

    # 开发者工具
    "npm": [
        "npm err", "npm warn",
        "node_modules",
        "package.json",
        "npm install",
        "cannot find module",
        "module not found",
    ],
    "python": [
        "traceback",
        "importerror",
        "modulenotfounderror",
        "pip install",
        "virtualenv",
        "no module named",
    ],
    "docker": [
        "dockerfile",
        "docker build",
        "docker run",
        "container",
        "image",
        "docker daemon",
    ],
    "git": [
        "fatal:",
        "git push", "git pull",
        "merge conflict",
        "detached head",
        "not a git repository",
    ],
    "nextjs": [
        "next.js", "nextjs",
        "next build",
        "app router", "pages router",
    ],
    "react": ["react", "jsx", "tsx", "vite", "webpack", "esbuild"],
    "cicd": [
        "github actions",
        "gitlab ci",
        "jenkins",
        "pipeline failed",
        "workflow",
    ],

    # 环境类通用错误（新增）
    "api_key_error": [                          # 新增
        "invalid api key",
        "invalid_api_key",
        "api key not found",
        "unauthorized",
        "401",
        "authentication failed",
    ],
    "model_not_available": [                    # 新增
        "model not available",
        "model not found",
        "no such model",
        "model does not exist",
        "insufficient_quota",
    ],
    "port_conflict": [                          # 新增
        "port already in use",
        "address already in use",
        "eaddrinuse",
        "bind: address already in use",
        "port 18790",
        "port 11434",
        "port 3000",
        "port 8000",
    ],
    "permission_denied": [                      # 新增
        "permission denied",
        "eacces",
        "access denied",
        "operation not permitted",
        "sudo required",
        "run as administrator",
    ],

    # API / 网关
    "openai_api": [
        "openai",
        "invalid_api_key",
        "insufficient_quota",
        "rate_limit_exceeded",
    ],
    "anthropic_api": ["anthropic", "x-api-key", "claude api"],
    "api_gateway": [
        "api gateway",
        "502", "503",
        "upstream",
        "econnrefused",
        "connection refused",
        "timeout",
        "gateway error",
    ],
}

def detect_tool(error_text: str) -> str:
    text_lower = error_text.lower()
    for tool, patterns in TOOL_PATTERNS.items():
        if any(p in text_lower for p in patterns):
            return tool
    return "unknown"

def classify_user_type(detected_tool: str) -> str:
    ai_tools = [
        "claude_code", "cursor", "mcp", "windsurf",
        "ollama", "lm_studio", "openclaw", "hermes_agent",
        "api_key_error", "model_not_available",
        "port_conflict", "permission_denied",
    ]
    return "likely_ai_user" if detected_tool in ai_tools else "likely_developer"
```

---

## 6. 敏感信息脱敏器（新增模块）

```python
# backend/core/redactor.py
# 在调用模型前自动脱敏，缓存使用脱敏后文本

import re
from dataclasses import dataclass

@dataclass
class RedactResult:
    redacted_text: str          # 脱敏后文本（送入模型）
    found_secrets: list[str]    # 发现的敏感信息类型（用于 warning）
    has_secrets: bool           # 是否检测到敏感信息

# 敏感信息正则规则
REDACT_PATTERNS = [
    # API Keys
    (r'sk-[A-Za-z0-9]{20,}',                    '[REDACTED_OPENAI_KEY]',    'OpenAI API Key'),
    (r'sk-ant-[A-Za-z0-9\-]{20,}',              '[REDACTED_ANTHROPIC_KEY]', 'Anthropic API Key'),
    (r'Bearer\s+[A-Za-z0-9\-._~+/]{20,}',       '[REDACTED_BEARER_TOKEN]',  'Bearer Token'),
    (r'ghp_[A-Za-z0-9]{36}',                    '[REDACTED_GITHUB_TOKEN]',  'GitHub Token'),
    (r'xoxb-[0-9\-A-Za-z]{50,}',               '[REDACTED_SLACK_TOKEN]',   'Slack Token'),

    # 数据库连接串
    (r'(mongodb|postgresql|mysql|redis)://[^\s\'"]+', '[REDACTED_DB_URL]',  '数据库连接串'),

    # 通用密钥字段（key=value 格式）
    (r'(?i)(api[_-]?key|secret[_-]?key|access[_-]?token|password|passwd|pwd)\s*[=:]\s*["\']?([A-Za-z0-9\-_./+]{8,})["\']?',
     r'\1=[REDACTED]', '密钥/密码字段'),

    # IP + 端口（可选脱敏，保留结构）
    # (r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', '[IP_REDACTED]', 'IP地址'),
]

def redact(text: str) -> RedactResult:
    redacted = text
    found = []

    for pattern, replacement, label in REDACT_PATTERNS:
        new_text, count = re.subn(pattern, replacement, redacted)
        if count > 0:
            found.append(label)
            redacted = new_text

    return RedactResult(
        redacted_text=redacted,
        found_secrets=list(set(found)),
        has_secrets=len(found) > 0
    )

def build_secret_warning(found_secrets: list[str]) -> str:
    """生成用户可见的敏感信息警告"""
    if not found_secrets:
        return ""
    types = "、".join(found_secrets)
    return (
        f"⚠️ 检测到你的报错中包含 {types}，"
        f"我们已在分析前自动遮盖这些信息。"
        f"建议你立即前往对应平台轮换（重新生成）这些密钥，"
        f"因为它们可能已经暴露在日志中。"
    )
```

---

## 7. JSON 解析增强（Output Parser）

```python
# backend/core/output_parser.py
# 必须处理：markdown code fence、非标准格式、Pydantic 校验失败

import json
import re
import logging
from schemas.models import DevAnalysisResult, UserAnalysisResult, UserMode

logger = logging.getLogger(__name__)

def extract_json_from_text(text: str) -> dict:
    """
    从模型返回文本中提取 JSON，处理以下情况：
    1. 纯 JSON
    2. ```json ... ``` 包裹
    3. ``` ... ``` 包裹
    4. JSON 混在其他文字中
    """
    # 1. 尝试直接解析
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # 2. 去除 markdown code fence
    fence_pattern = r'```(?:json)?\s*([\s\S]*?)\s*```'
    matches = re.findall(fence_pattern, text)
    for match in matches:
        try:
            return json.loads(match.strip())
        except json.JSONDecodeError:
            continue

    # 3. 提取第一个 { } 块
    brace_pattern = r'\{[\s\S]*\}'
    match = re.search(brace_pattern, text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    # 4. 全部失败，返回 None
    return None


def make_fallback_dev_result(error_text: str, detected_tool: str) -> DevAnalysisResult:
    """JSON 解析或 Pydantic 校验失败时的降级结果，不抛 500"""
    return DevAnalysisResult(
        error_type="解析异常",
        severity="medium",
        detected_tool=detected_tool,
        root_cause="AI 返回了非标准格式，无法自动解析。建议将报错内容直接搜索或查阅官方文档。",
        fix_steps=[
            {"step": 1, "action": "将报错关键词复制到搜索引擎（如 Google）查找解决方案", "command": None},
            {"step": 2, "action": "查阅对应工具的官方文档或 GitHub Issues", "command": None},
        ],
        code_changes=[],
        prevention_tips=["保留完整报错信息便于排查"],
        confidence=0.1,
        warnings=["⚠️ 本次分析结果为降级输出，准确性有限"]
    )

def make_fallback_user_result(detected_tool: str) -> UserAnalysisResult:
    return UserAnalysisResult(
        plain_explanation="抱歉，这次分析遇到了一点技术问题，没能给出详细解释。",
        severity_message="问题严重程度未知，建议寻求进一步帮助。",
        detected_tool=detected_tool,
        steps=[
            {"step_number": 1, "instruction": "把报错信息截图，发到对应工具的官方交流群或社区寻求帮助", "command": None, "screenshot_hint": None}
        ],
        warnings=["不要随意删除文件或重装系统"],
        success_check="问题解决后，你使用的工具应该能正常运行",
        if_still_failing="可以将报错截图发到工具的官方 Discord 或微信群寻求帮助"
    )


def parse_output(raw_text: str, mode: UserMode, detected_tool: str):
    """主解析函数，失败时返回 fallback，不抛异常"""
    data = extract_json_from_text(raw_text)

    if data is None:
        logger.warning(f"JSON extraction failed, using fallback. raw={raw_text[:200]}")
        return (make_fallback_dev_result("", detected_tool) if mode == UserMode.DEVELOPER
                else make_fallback_user_result(detected_tool))

    try:
        if mode == UserMode.DEVELOPER:
            return DevAnalysisResult(**data)
        else:
            return UserAnalysisResult(**data)
    except Exception as e:
        logger.warning(f"Pydantic validation failed: {e}, using fallback")
        return (make_fallback_dev_result("", detected_tool) if mode == UserMode.DEVELOPER
                else make_fallback_user_result(detected_tool))
```

---

## 8. IP + visitor_id 双轨限流

```python
# backend/middleware/rate_limit.py

import redis.asyncio as redis
from fastapi import Request, HTTPException
from datetime import date
import hashlib
import os

# 限流配置（从环境变量读取，方便后期调整）
VISITOR_DAILY_LIMIT = int(os.getenv("VISITOR_DAILY_LIMIT", "10"))
IP_DAILY_LIMIT      = int(os.getenv("IP_DAILY_LIMIT", "30"))

class RateLimiter:
    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url)
        self.environment = os.getenv("ENVIRONMENT", "development")

    def _get_real_ip(self, request: Request) -> str:
        """
        获取真实客户端 IP。

        MVP 阶段简化实现：
        - development：直接使用 request.client.host
        - production：优先读取 X-Forwarded-For，其次 X-Real-IP，
                      最后回退到 request.client.host

        ⚠️ 后续待完善（V0.2）：
        生产环境应根据部署平台（Railway / Cloudflare / 腾讯云）
        限定可信代理 IP 段，防止客户端伪造 X-Forwarded-For。
        届时参考各平台文档配置 TRUSTED_PROXY_NETWORKS 白名单。
        """
        client_ip = request.client.host if request.client else "unknown"

        if self.environment != "production":
            return client_ip

        # production：尝试读取代理头，取第一个（最原始的客户端 IP）
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
                }
            )
        return limit - count

    async def check(self, request: Request, visitor_id: str | None) -> int:
        """
        双轨限流：visitor_id（主，10次）+ IP（兜底，30次）
        返回最小剩余次数
        """
        today    = self._today()
        real_ip  = self._get_real_ip(request)

        remaining_ip = await self._check_limit(
            f"rate:ip:{self._hash(real_ip)}:{today}",
            IP_DAILY_LIMIT,
            "RATE_LIMIT_IP"
        )

        remaining_visitor = IP_DAILY_LIMIT
        if visitor_id and len(visitor_id) >= 8:
            remaining_visitor = await self._check_limit(
                f"rate:vid:{self._hash(visitor_id)}:{today}",
                VISITOR_DAILY_LIMIT,
                "RATE_LIMIT_VISITOR"
            )

        return min(remaining_ip, remaining_visitor)
```

---

## 9. 缓存策略 v1.1

```python
# backend/core/cache.py

import hashlib
import json
import redis.asyncio as redis
import random

# TTL 策略：24~72小时随机（避免缓存雪崩）
CACHE_TTL_MIN = 60 * 60 * 24       # 24小时
CACHE_TTL_MAX = 60 * 60 * 72       # 72小时

class ResultCache:
    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url)

    def _make_key(self, redacted_text: str, mode: str, detected_tool: str) -> str:
        """
        缓存 key 使用：脱敏后的文本 + mode + detected_tool
        不使用原始文本，确保缓存不含敏感信息
        """
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
        """
        缓存结果不得包含原始敏感信息（result 已是脱敏后的分析结果）
        TTL 随机化，24~72小时
        """
        key = self._make_key(redacted_text, mode, detected_tool)
        ttl = random.randint(CACHE_TTL_MIN, CACHE_TTL_MAX)
        try:
            await self.redis.setex(key, ttl, json.dumps(result, ensure_ascii=False))
        except Exception:
            pass  # 缓存失败不影响主流程
```

---

## 10. Prompt 引擎（双模式）

```python
# backend/core/prompt_engine.py

SYSTEM_PROMPT_DEVELOPER = """
你是一个专业的程序调试助手，专注于帮助开发者快速解决技术报错。
用户会粘贴错误日志、终端输出或构建失败信息（敏感信息已脱敏）。

规则：
1. 严格按照 JSON 格式返回，不输出任何其他内容，不使用 markdown 代码块包裹
2. 所有字段使用中文
3. fix_steps 中的 command 字段保留英文命令
4. confidence 是你对分析结果准确性的信心值（0-1）

返回格式（纯 JSON，不加任何包裹）：
{
  "error_type": "错误类型简短描述",
  "severity": "critical|high|medium|low",
  "detected_tool": "识别到的工具/框架，没有则为null",
  "root_cause": "根本原因清晰解释（2-3句话，技术准确）",
  "fix_steps": [
    {"step": 1, "action": "具体操作描述", "command": "终端命令或null"}
  ],
  "code_changes": [
    {"file": "文件路径或null", "before": "原代码或null", "after": "修改后或null", "explanation": "修改说明"}
  ],
  "prevention_tips": ["预防建议1", "预防建议2"],
  "confidence": 0.95,
  "warnings": []
}
"""

SYSTEM_PROMPT_AI_USER = """
你是一个友好的技术助手，帮助不懂代码的普通用户解决 AI 工具的报错问题。
用户可能在使用 Claude Code、Cursor、Ollama、OpenClaw、Hermes 等 AI 工具时遇到了问题。

规则：
1. 严格按照 JSON 格式返回，不输出任何其他内容，不使用 markdown 代码块包裹
2. 全程使用简单中文，避免技术术语（必须用时要括号解释）
3. 语气友好，像朋友帮忙一样
4. steps 要非常具体，一步只做一件事

返回格式（纯 JSON，不加任何包裹）：
{
  "plain_explanation": "用日常语言解释这个报错是什么意思（不超过3句话）",
  "severity_message": "这个问题[不严重，按步骤做就能解决|需要尽快处理|比较紧急]",
  "detected_tool": "识别到的工具名称或null",
  "steps": [
    {
      "step_number": 1,
      "instruction": "用普通话描述要做什么",
      "command": "如果需要输入命令写在这里否则为null",
      "screenshot_hint": "告诉用户看屏幕哪里否则为null"
    }
  ],
  "warnings": ["不要做的事1"],
  "success_check": "做完之后怎么判断问题已经解决了",
  "if_still_failing": "如果还是不行下一步应该怎么办"
}
"""

def build_user_prompt(redacted_text: str, detected_tool: str) -> str:
    tool_hint = f"\n[系统识别到的工具：{detected_tool}]" if detected_tool != "unknown" else ""
    return f"{tool_hint}\n\n用户报错内容（已脱敏）：\n{redacted_text}"
```

---

## 11. Model Router

```python
# backend/core/model_router.py
from abc import ABC, abstractmethod
import os

class BaseModelProvider(ABC):
    @abstractmethod
    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        pass

class ModelRouter:
    def __init__(self):
        self._providers = {}
        # 从环境变量读取，v1.2 改名为 ACTIVE_PROVIDER
        self._active = os.getenv("ACTIVE_PROVIDER", "mimo")

    def register(self, name: str, provider: BaseModelProvider):
        self._providers[name] = provider

    def switch(self, name: str):
        if name not in self._providers:
            raise ValueError(f"Provider {name} not registered")
        self._active = name

    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        provider = self._providers[self._active]
        return await provider.complete(system_prompt, user_prompt)

def create_router() -> ModelRouter:
    router = ModelRouter()
    from providers.mimo import MiMoProvider
    router.register("mimo", MiMoProvider())
    # 预留：
    # router.register("claude", ClaudeProvider())
    # router.register("deepseek", DeepSeekProvider())
    return router
```

---

## 11a. MiMoProvider 实现（OpenAI-compatible 格式）

MiMo 使用 OpenAI-compatible `/chat/completions` 接口，用 httpx 直接调用。

```python
# backend/providers/mimo.py

import os
import httpx
import logging
from providers.base import BaseModelProvider
from fastapi import HTTPException

logger = logging.getLogger(__name__)

class MiMoProvider(BaseModelProvider):
    def __init__(self):
        self.base_url = os.getenv("MIMO_BASE_URL", "").rstrip("/")
        self.api_key  = os.getenv("MIMO_API_KEY", "")
        # MIMO_MODEL 控制实际调用的模型名，与 ACTIVE_PROVIDER 分离
        self.model    = os.getenv("MIMO_MODEL", "mimo-v2.5-pro")
        self.timeout  = 60.0   # 秒，非流式模式等待完整响应

        if not self.base_url or not self.api_key:
            raise RuntimeError("MIMO_BASE_URL 和 MIMO_API_KEY 必须在环境变量中配置")

    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        """
        调用 MiMo OpenAI-compatible /chat/completions 接口。
        接口路径：{MIMO_BASE_URL}/chat/completions
        鉴权方式：Authorization: Bearer {MIMO_API_KEY}
        """
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            "temperature": 0.2,   # 低随机性，保证输出稳定性
            "max_tokens": 2048,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, headers=headers, json=payload)

                # HTTP 层错误处理
                if response.status_code == 401:
                    logger.error("MiMo API 鉴权失败，请检查 MIMO_API_KEY")
                    raise HTTPException(status_code=502, detail={
                        "error_code": "UPSTREAM_ERROR",
                        "message": "上游模型鉴权失败，请联系管理员"
                    })

                if response.status_code == 429:
                    logger.warning("MiMo API 限流")
                    raise HTTPException(status_code=502, detail={
                        "error_code": "UPSTREAM_ERROR",
                        "message": "上游模型服务繁忙，请稍后重试"
                    })

                if response.status_code >= 500:
                    logger.error(f"MiMo API 服务端错误: {response.status_code} {response.text[:200]}")
                    raise HTTPException(status_code=502, detail={
                        "error_code": "UPSTREAM_ERROR",
                        "message": "上游模型服务不可用，请稍后重试"
                    })

                if response.status_code != 200:
                    logger.error(f"MiMo API 未知错误: {response.status_code}")
                    raise HTTPException(status_code=500, detail={
                        "error_code": "MODEL_ERROR",
                        "message": "AI 分析服务异常，请稍后重试"
                    })

                # 解析响应
                data = response.json()
                try:
                    content = data["choices"][0]["message"]["content"]
                    return content
                except (KeyError, IndexError) as e:
                    logger.error(f"MiMo 响应格式异常: {data}")
                    raise HTTPException(status_code=500, detail={
                        "error_code": "MODEL_ERROR",
                        "message": "AI 返回格式异常，请稍后重试"
                    })

        except httpx.TimeoutException:
            logger.error("MiMo API 调用超时")
            raise HTTPException(status_code=504, detail={
                "error_code": "TIMEOUT",
                "message": "分析超时，请缩短报错内容后重试"
            })

        except httpx.RequestError as e:
            logger.error(f"MiMo API 网络错误: {e}")
            raise HTTPException(status_code=502, detail={
                "error_code": "UPSTREAM_ERROR",
                "message": "无法连接到 AI 服务，请检查网络后重试"
            })
```

---

## 12. 完整请求处理流程

```
POST /api/analyze
        │
        ▼
[1] 生成 request_id
        │
        ▼
[2] Pydantic 校验（长度/格式），失败返回 400/413
        │
        ▼
[3] 双轨限流检查（IP + visitor_id），超限返回 429
        │
        ▼
[4] 场景识别（log_parser.detect_tool）
        │
        ▼
[5] 敏感信息脱敏（redactor.redact）
        │   → 记录 redact_result（本次是否发现敏感信息）
        │
        ▼
[6] 查询缓存（脱敏文本 + mode + detected_tool 作为 key）
        │
        ├─── 命中（cached=true）──────────────────────────────┐
        │                                                     │
        │    注意：即使缓存命中，也必须检查本次 redact_result    │
        │    如果本次输入发现敏感信息，将 warning 追加到         │
        │    cached result.warnings 中，再返回。               │
        │    缓存结果本身不修改，只在响应时动态追加。            │
        │                                                     ▼
        │                                              返回（cached: true
        │                                              + 本次 warnings）
        ▼ 未命中
[7] 构建 Prompt（prompt_engine）
        │
        ▼
[8] 调用模型（model_router.complete）
        │   超时/异常 → 返回 502/504
        │
        ▼
[9] 解析输出（output_parser，失败返回 fallback，不抛 500）
        │
        ▼
[10] 如有敏感信息（redact_result.has_secrets），
     在 result.warnings 里追加密钥轮换提醒
        │
        ▼
[11] 写入缓存（脱敏结果，TTL 24~72h 随机）
     注意：写入缓存的 result.warnings 不含本次的敏感信息提醒
     （敏感信息 warning 每次动态追加，不持久化到缓存）
        │
        ▼
[12] 返回 AnalyzeResponse（含 request_id + remaining_requests）
```

---

## 13. 前端规范 v1.1

### V0.1 阶段（MVP）：普通 loading，无流式
```
用户点击分析 → 按钮变 loading 状态 → 等待后端返回完整结果 → 渲染结果卡片
不实现 SSE / ReadableStream / 打字机动画（放到 V0.2）
loading 时显示：旋转图标 + "正在分析中，通常需要 5~15 秒..."
```

### ToolBadge：V0.1 纯前端关键词判断（不新增后端接口）

```typescript
// frontend/lib/detect-tool.ts
// V0.1 在前端本地做轻量关键词匹配，仅用于 ToolBadge 即时显示
// 最终准确的 detect_tool 由后端 /api/analyze 返回，前端以后端结果为准

const FRONTEND_TOOL_PATTERNS: Record<string, string[]> = {
  "Claude Code":    ["claude code", "configured model not available", "gateway couldn't serve"],
  "Cursor / MCP":   ["cursor", "mcp server", "mcp.json", ".cursor/mcp"],
  "OpenClaw":       ["openclaw", "open claw", "gateway port 18790"],
  "Hermes Agent":   ["hermes", "hermes agent", "hermes-agent"],
  "Ollama":         ["ollama", "localhost:11434", "pull model manifest"],
  "npm / Node.js":  ["npm err", "cannot find module", "node_modules", "package.json"],
  "Python":         ["traceback", "modulenotfounderror", "importerror", "no module named"],
  "Docker":         ["dockerfile", "docker build", "docker run"],
  "Git":            ["fatal:", "git push", "git pull", "merge conflict"],
  "Next.js":        ["next.js", "nextjs", "next build"],
};

export function detectToolFrontend(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [tool, patterns] of Object.entries(FRONTEND_TOOL_PATTERNS)) {
    if (patterns.some(p => lower.includes(p))) {
      return tool;
    }
  }
  return null;
}

// 使用方式（在输入框 onChange 中，debounce 500ms）：
// const detectedTool = detectToolFrontend(inputText);
// → 用于 ToolBadge 实时显示，如"已识别：Claude Code"
// 后端分析完成后，用 result.detected_tool 替换显示
```

### 字体（不依赖 Google Fonts 远程加载）
```css
/* 使用系统字体栈，无需网络请求，对中文用户加载最快 */
font-family:
  -apple-system,
  "PingFang SC",          /* macOS/iOS 中文 */
  "Microsoft YaHei",      /* Windows 中文 */
  "Hiragino Sans GB",     /* macOS 备用 */
  "WenQuanYi Micro Hei",  /* Linux 中文 */
  sans-serif;

/* 代码字体：Next.js 内置 next/font/local 加载，不走 Google CDN */
/* 或直接用系统等宽字体 */
font-family: "Cascadia Code", "Consolas", "Monaco", monospace;
```

### 配色方案
```css
--bg-primary: #0f1117;
--bg-card: #1a1d2e;
--accent: #4f8ef7;
--accent-success: #22c55e;
--accent-error: #ef4444;
--accent-warning: #f59e0b;
--text-primary: #e2e8f0;
--text-secondary: #94a3b8;
```

### visitor_id 生成（前端）
```typescript
// frontend/lib/visitor.ts
// 生成并持久化 visitor_id，用于限流
export function getVisitorId(): string {
  const key = "bugsense_vid";
  let vid = localStorage.getItem(key);
  if (!vid) {
    vid = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    localStorage.setItem(key, vid);
  }
  return vid;
}
```

### 页面结构
```
[Header]  BugSense AI Logo + 模式切换（开发者 / AI工具用户）
[Hero]    一句话价值主张 + 大型粘贴框
[Badge]   自动识别工具标签（如"已识别：Claude Code"）
[Button]  分析按钮（loading 状态显示 spinner）
[Result]  结果卡片区（开发者/用户 双模式）
[Footer]  剩余次数：今日还剩 X 次 | 明天重置
```

---

## 14. 本地开发配置

**重要：docker-compose 只启动 backend + redis，前端用 npm run dev 单独启动。**

```yaml
# docker-compose.yml（本地开发用）
version: "3.9"
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    depends_on:
      - redis
    volumes:
      - ./backend:/app    # 开发时热重载

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

# 前端启动方式（独立，不放入 docker-compose）：
# cd frontend && npm run dev
# 访问：http://localhost:3000
# 前端调用后端：http://localhost:8000
```

---

## 15. 部署方案 v1.1

### 前端部署
```
主方案：Vercel
  - 连接 GitHub repo
  - 设置环境变量 NEXT_PUBLIC_API_URL
  - 注意：Vercel 不保证中国大陆稳定访问，当前目标为海外中文用户，可接受

备选方案 A：Cloudflare Pages
  - 适合需要更稳定香港访问的场景
  - 同样连接 GitHub 自动部署

备选方案 B：香港 VPS（Nginx 静态托管）
  - 成本略高，但完全可控
  - 适合后期国内用户访问优化
```

### 后端部署
```
主方案：Railway（优先选择 Hong Kong 区域）
  - 连接 GitHub repo /backend 目录
  - 确认 Railway 控制台有 Hong Kong 区域可选
  - 如无香港区域或访问不稳定，切换备选方案

备选方案：腾讯云 / 阿里云 香港轻量应用服务器
  - 2核4G 约 ¥60-100/月
  - 使用 Docker 部署：
    docker build -t bugsense-backend .
    docker run -d -p 8000:8000 --env-file .env bugsense-backend
  - Redis：同机 Docker 或云 Redis 实例

域名（MVP 阶段）：
  - 暂用 Railway/Vercel 提供的临时域名
  - 格式如：bugsense-backend.railway.app / bugsense.vercel.app
  - 后期购买域名后更换
```

---

## 16. 环境变量

```bash
# backend/.env

# 模型配置
MIMO_API_KEY=your_mimo_api_key
MIMO_BASE_URL=https://xxxxxx/v1      # 填入实际 MiMo 接口地址
MIMO_MODEL=mimo-v2.5-pro             # MiMo 实际调用的模型名（新增）
ACTIVE_PROVIDER=mimo                 # 当前激活的 provider，切换模型只改这里（v1.2 改名）

# Redis
REDIS_URL=redis://localhost:6379     # 本地开发
# REDIS_URL=redis://redis:6379       # docker-compose 内部

# 服务配置
CORS_ORIGINS=http://localhost:3000,https://your-vercel-url.vercel.app
ENVIRONMENT=development              # development | production

# 限流
VISITOR_DAILY_LIMIT=10
IP_DAILY_LIMIT=30

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000    # 本地开发
# NEXT_PUBLIC_API_URL=https://your-backend.railway.app  # 部署后替换
```

---

## 17. requirements.txt

使用兼容范围版本，避免锁死旧版本导致安装失败，同时限制大版本防止破坏性更新：

```
fastapi>=0.115,<1.0
uvicorn[standard]>=0.30,<1.0
pydantic>=2.8,<3.0
redis>=5.0,<6.0
httpx>=0.27,<1.0
python-dotenv>=1.0,<2.0
python-multipart>=0.0.9,<1.0
```

---

## 18. 最小测试样例（6个标准场景）

```python
# backend/tests/test_cases.py
# 这6个样例是 MVP 验收的最小测试集

TEST_CASES = [

    # 1. npm module not found（开发者模式）
    {
        "id": "npm_module_not_found",
        "mode": "developer",
        "error_text": """
npm ERR! code MODULE_NOT_FOUND
npm ERR! Cannot find module 'express'
npm ERR! Require stack:
npm ERR! - /Users/user/project/index.js
npm ERR! 
npm ERR! If you need help, you may report this error at:
npm ERR!   <https://github.com/npm/cli/issues>
        """,
        "expected_detected_tool": "npm",
        "expected_severity": ["high", "medium"],
    },

    # 2. Python ModuleNotFoundError（开发者模式）
    {
        "id": "python_module_not_found",
        "mode": "developer",
        "error_text": """
Traceback (most recent call last):
  File "app.py", line 3, in <module>
    import pandas as pd
ModuleNotFoundError: No module named 'pandas'
        """,
        "expected_detected_tool": "python",
        "expected_severity": ["high", "medium"],
    },

    # 3. Docker build failed（开发者模式）
    {
        "id": "docker_build_failed",
        "mode": "developer",
        "error_text": """
Step 4/8 : RUN pip install -r requirements.txt
 ---> Running in a3f8d2c1b4e5
ERROR: Could not find a version that satisfies the requirement torch==2.0.0 (from versions: none)
ERROR: No matching distribution found for torch==2.0.0
The command '/bin/sh -c pip install -r requirements.txt' returned a non-zero code: 1
        """,
        "expected_detected_tool": "docker",
        "expected_severity": ["high", "critical"],
    },

    # 4. Claude Code - Configured model not available（AI用户模式）
    {
        "id": "claude_code_model_unavailable",
        "mode": "ai_user",
        "error_text": """
Claude Code Error: Configured model not available
The model claude-opus-4-5 is not available for your current plan.
Please check your Anthropic Console or switch to a different model.
        """,
        "expected_detected_tool": "claude_code",
        "check": "plain_explanation should be in Chinese, steps should be non-empty",
    },

    # 5. OpenClaw gateway port 18790 connection issue（AI用户模式）
    {
        "id": "openclaw_port_conflict",
        "mode": "ai_user",
        "error_text": """
OpenClaw Gateway Error: Failed to bind to port 18790
Address already in use: 0.0.0.0:18790
Please check if another instance of OpenClaw is running or if port 18790 is occupied by another application.
        """,
        "expected_detected_tool": "openclaw",
        "check": "warnings should mention not to randomly kill processes",
    },

    # 6. Hermes Agent install failed（AI用户模式）
    {
        "id": "hermes_install_failed",
        "mode": "ai_user",
        "error_text": """
Error: Hermes Agent installation failed
npm ERR! code EACCES
npm ERR! syscall mkdir
npm ERR! path /usr/local/lib/node_modules/hermes-agent
npm ERR! errno -13
npm ERR! Error: EACCES: permission denied, mkdir '/usr/local/lib/node_modules/hermes-agent'
        """,
        "expected_detected_tool": "hermes_agent",
        "check": "should detect permission issue and give non-sudo alternative or explain why permission denied",
    },
]
```

---

## 19. Claude Code 执行计划（按 Phase）

### Phase 1：后端核心（第1-2天）

```
指令1：
"创建 backend/ 目录，初始化 FastAPI 项目骨架。
包含 main.py、requirements.txt、Dockerfile。
实现 GET /health 和 POST /api/analyze 路由的基础结构（路由空壳即可）。
所有路由注册在 routers/analyze.py。
在 main.py 中：每个请求自动生成 request_id（格式 req_xxxxxxxx），
配置 CORS（从环境变量 CORS_ORIGINS 读取）。"

指令2：
"实现 backend/schemas/models.py，
包含 AnalyzeRequest（含 min_length=10/max_length=12000 校验、visitor_id 字段）、
DevAnalysisResult、UserAnalysisResult、AnalyzeResponse、ErrorResponse，
完整按蓝图 v1.1 第3节定义。"

指令3：
"实现 backend/core/log_parser.py，
包含蓝图 v1.1 第5节的完整 TOOL_PATTERNS（含 openclaw、hermes_agent、环境类标签），
以及 detect_tool 和 classify_user_type 函数。"

指令4：
"实现 backend/core/redactor.py，
包含蓝图 v1.1 第6节的全部正则规则和 redact() / build_secret_warning() 函数。"

指令5：
"实现 backend/providers/base.py 抽象基类，
实现 backend/core/model_router.py 的 ModelRouter 类
（从环境变量 ACTIVE_PROVIDER 读取激活的 provider，默认 mimo），
实现 backend/providers/mimo.py：
按蓝图 v1.2 第11a节，使用 httpx 异步调用 MiMo OpenAI-compatible 接口：
- base_url 从 MIMO_BASE_URL 读取
- api_key 从 MIMO_API_KEY 读取
- model 从 MIMO_MODEL 读取
- 接口路径：{base_url}/chat/completions
- 鉴权：Authorization: Bearer {api_key}
- 只实现 complete() 方法（非流式），返回字符串
- 按蓝图完整实现所有错误处理（401/429/5xx/timeout/network）
  统一转成 UPSTREAM_ERROR 或 MODEL_ERROR 或 TIMEOUT"

指令6：
"实现 backend/core/prompt_engine.py，
包含 SYSTEM_PROMPT_DEVELOPER、SYSTEM_PROMPT_AI_USER 和 build_user_prompt()，
完整按蓝图 v1.1 第10节。"

指令7：
"实现 backend/core/output_parser.py，
包含 extract_json_from_text()、make_fallback_dev_result()、
make_fallback_user_result()、parse_output()，
完整按蓝图 v1.1 第7节。
Pydantic 校验失败时返回 fallback，不抛 500。"

指令8：
"实现 backend/middleware/rate_limit.py（IP每日30次 + visitor_id每日10次双轨限流，
按蓝图 v1.1 第8节），
实现 backend/core/cache.py（脱敏文本作 key，TTL 24~72小时随机，按第9节）。"

指令9：
"把所有模块组装到 routers/analyze.py，
按蓝图 v1.2 第12节的完整流程实现 POST /api/analyze：
request_id → 校验 → 限流 → 场景识别 → 脱敏（记录 redact_result）→
查缓存：
  命中时：如果 redact_result.has_secrets，将 build_secret_warning() 追加到
         cached result.warnings，再返回（cached:true），
         不修改缓存本身，只在响应时动态追加。
  未命中：构建Prompt → 调模型 → 解析输出 → 追加敏感信息warning →
         写缓存（写入的 result 不含本次敏感信息warning）→ 返回。
按第4节的错误码表标准化所有错误响应。"
```

### Phase 2：前端界面（第3-4天）

```
指令10：
"创建 frontend/ 目录，初始化 Next.js 14（App Router + TypeScript + Tailwind）。
配置 tailwind.config.ts 使用蓝图 v1.2 第13节的 CSS 变量和系统字体栈（不用 Google Fonts）。
创建 frontend/lib/visitor.ts（visitor_id 生成/持久化）。
创建 frontend/lib/detect-tool.ts（按蓝图 v1.2 第13节 ToolBadge 部分，
实现 detectToolFrontend() 函数，纯本地关键词匹配）。"

指令11：
"实现首页 app/page.tsx，包含：
- Header：Logo + 模式切换（开发者/AI工具用户 两个按钮，默认开发者）
- 大型报错粘贴文本框（placeholder 根据模式切换）
- ToolBadge：文本输入后 debounce 500ms，调用 detectToolFrontend()
  显示识别到的工具（如'已识别：Claude Code'），
  分析完成后用 result.detected_tool 替换显示，
  不新增任何后端 detect 接口
- 分析按钮：点击后显示 loading spinner + '正在分析中，通常需要 5~15 秒...'（V0.1 不做流式）
- RateLimitBanner：底部显示'今日还剩 X 次 | 明天 00:00 重置'
配色按蓝图 v1.2 第13节。"

指令12：
"实现 components/result-cards/DevResultCard.tsx：
- 根因卡片（红色左边框）
- 修复步骤卡片（含命令行一键复制按钮）
- 代码修改建议（before/after 对比，绿红高亮）
- 预防建议卡片
- warnings 卡片（橙色，敏感信息提醒）
实现 components/result-cards/UserResultCard.tsx：
- 大字体通俗解释卡片
- 步骤引导（序号 + 普通话 + 可复制命令）
- 警告卡片（橙色）
- 验收标准卡片（绿色）"

指令13：
"实现 frontend/lib/api.ts：封装 POST /api/analyze 调用，
自动携带 visitor_id，处理 400/413/429/500/502/504 错误，
返回统一格式。
实现 frontend/app/api/analyze/route.ts：转发到后端（从环境变量 NEXT_PUBLIC_API_URL 读取）。"
```

### Phase 3：集成与部署（第5-6天）

```
指令14：
"创建 docker-compose.yml（只含 backend + redis，不含 frontend）。
确保 backend .env.example 包含所有必要变量。
本地联调：
- docker-compose up 启动 backend + redis
- cd frontend && npm run dev 启动前端
- 用 tests/test_cases.py 的6个样例手动测试接口"

指令15：
"输出 Railway 部署步骤文档（markdown 格式）：
1. Railway 控制台创建项目，连接 GitHub，选 /backend 目录
2. 确认是否有 Hong Kong 区域，没有则备注切换腾讯云香港方案
3. 添加 Redis 插件
4. 配置所有环境变量清单
5. 确认部署后 /health 可访问"

指令16：
"输出 Vercel 部署步骤文档（markdown 格式）：
1. 连接 GitHub，选 /frontend 目录
2. 配置 NEXT_PUBLIC_API_URL 为 Railway 后端地址
3. 确认部署后前端可正常访问并调用后端"
```

---

## 20. MVP 验收标准 v1.2

```
✅ 功能验收
□ 粘贴 npm ERR 报错 → 开发者模式 → 返回结构化结果 → 前端正确展示
□ 粘贴 Claude Code 报错 → AI用户模式 → 返回中文普通话解释
□ 粘贴含 API Key 的报错 → 脱敏后分析 → warnings 中出现密钥提醒
□ 粘贴含 API Key 的报错（缓存命中）→ cached:true + warnings 仍有密钥提醒
□ 输入框输入报错关键词 → debounce 后 ToolBadge 显示识别结果（纯前端，无接口）
□ 自动识别工具类型并显示标签（分析完成后以后端结果为准）
□ visitor_id 超过10次 → 429（RATE_LIMIT_VISITOR）
□ IP 超过30次 → 429（RATE_LIMIT_IP）
□ 相同报错第2次请求 → cached: true，响应更快，warnings 仍按本次脱敏追加
□ 报错内容 < 10字符 → 400（TOO_SHORT）
□ 报错内容 > 12000字符 → 413（TOO_LONG）
□ 模型返回非 JSON → fallback 结果，不出现 500
□ MiMo API 401 → 502 UPSTREAM_ERROR（不暴露原始错误）
□ MiMo API 超时 → 504 TIMEOUT

✅ 性能验收
□ 香港用户访问首页 < 2秒
□ AI 分析完整响应 < 20秒（非流式，V0.1 接受等待）

✅ 兼容性
□ Chrome / Safari / Edge 正常
□ Windows / macOS 正常
□ 手机浏览器可正常使用粘贴功能
```

---

## 21. 版本路线图

```
V0.1（当前 MVP）
└── 普通 loading，非流式
└── IP + visitor_id 双轨限流
└── 敏感信息脱敏
└── 6类工具识别
└── 手动部署

V0.2
└── 流式输出（SSE / ReadableStream）
└── 打字机动画
└── GitHub Actions 自动部署
└── 更多工具识别扩展

V1.0
└── 邮箱注册 + 历史记录
└── Supabase Auth + DB

V1.1
└── 截图上传 + OCR 提取报错

V2.0
└── Pro 版 + Stripe/LemonSqueezy
└── CLI 工具 / VSCode 插件
└── GitHub Repo 扫描
```

---

*文档版本：v1.2 | 目标用户：海外中文用户 | 服务器：香港优先*  
*本文档直接交给 Claude Code 按 Phase 执行，每条指令独立可测试*
