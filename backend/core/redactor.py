import re
from dataclasses import dataclass


@dataclass
class RedactResult:
    redacted_text: str
    found_secrets: list[str]
    has_secrets: bool


REDACT_PATTERNS = [
    # API Keys
    (r'sk-[A-Za-z0-9]{20,}',                    '[REDACTED_OPENAI_KEY]',    'OpenAI API Key'),
    (r'sk-ant-[A-Za-z0-9\-]{20,}',              '[REDACTED_ANTHROPIC_KEY]', 'Anthropic API Key'),
    (r'Bearer\s+[A-Za-z0-9\-._~+/]{20,}',       '[REDACTED_BEARER_TOKEN]',  'Bearer Token'),
    (r'ghp_[A-Za-z0-9]{36}',                    '[REDACTED_GITHUB_TOKEN]',  'GitHub Token'),
    (r'xoxb-[0-9\-A-Za-z]{50,}',               '[REDACTED_SLACK_TOKEN]',   'Slack Token'),

    # 数据库连接串
    (r'(mongodb|postgresql|mysql|redis)://[^\s\'"]+', '[REDACTED_DB_URL]',  '数据库连接串'),

    # 通用密钥字段
    (r'(?i)(api[_-]?key|secret[_-]?key|access[_-]?token|password|passwd|pwd)\s*[=:]\s*["\']?([A-Za-z0-9\-_./+]{8,})["\']?',
     r'\1=[REDACTED]', '密钥/密码字段'),
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
        has_secrets=len(found) > 0,
    )


def build_secret_warning(found_secrets: list[str]) -> str:
    if not found_secrets:
        return ""
    types = "、".join(found_secrets)
    return (
        f"⚠️ 检测到你的报错中包含 {types}，"
        f"我们已在分析前自动遮盖这些信息。"
        f"建议你立即前往对应平台轮换（重新生成）这些密钥，"
        f"因为它们可能已经暴露在日志中。"
    )
