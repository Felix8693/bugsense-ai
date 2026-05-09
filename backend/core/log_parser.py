TOOL_PATTERNS = {
    # AI 编程工具
    "claude_code": [
        "claude code",
        "anthropic",
        "claude-3", "claude-opus", "claude-sonnet", "claude-haiku",
        "configured model not available",
        "gateway couldn't serve",
        "claude code is not configured",
        "model not available for your plan",
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

    # AI Agent 工具
    "openclaw": [
        "openclaw",
        "open claw",
        "gateway port 18790",
        "claw gateway",
        "openclaw connection",
        "openclaw install",
    ],
    "hermes_agent": [
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

    # 环境类通用错误
    "api_key_error": [
        "invalid api key",
        "invalid_api_key",
        "api key not found",
        "unauthorized",
        "401",
        "authentication failed",
    ],
    "model_not_available": [
        "model not available",
        "model not found",
        "no such model",
        "model does not exist",
        "insufficient_quota",
    ],
    "port_conflict": [
        "port already in use",
        "address already in use",
        "eaddrinuse",
        "bind: address already in use",
        "port 18790",
        "port 11434",
        "port 3000",
        "port 8000",
    ],
    "permission_denied": [
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
