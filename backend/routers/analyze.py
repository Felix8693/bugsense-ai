import logging

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse

from schemas.models import (
    AnalyzeRequest,
    AnalyzeResponse,
    DevAnalysisResult,
    UserAnalysisResult,
    UserMode,
)
from core.log_parser import detect_tool
from core.redactor import redact, build_secret_warning
from core.prompt_engine import (
    SYSTEM_PROMPT_DEVELOPER,
    SYSTEM_PROMPT_AI_USER,
    build_user_prompt,
)
from core.output_parser import parse_output

logger = logging.getLogger(__name__)

router = APIRouter()

# 错误码 → (status_code, message)
ERROR_CODES = {
    "INVALID_INPUT": (400, "输入内容格式不正确"),
    "TOO_SHORT": (400, "报错内容太短，请粘贴完整错误信息"),
    "TOO_LONG": (413, "报错内容超过12000字符，请截取关键部分"),
    "RATE_LIMIT_IP": (429, "该IP今日免费次数已用完（每日30次），明天重置"),
    "RATE_LIMIT_VISITOR": (429, "今日免费次数已用完（每日10次），明天重置"),
    "MODEL_ERROR": (500, "AI 分析服务暂时异常，请稍后重试"),
    "PARSE_ERROR": (500, "分析结果解析失败，已返回基础建议"),
    "UPSTREAM_ERROR": (502, "上游模型服务不可用，请稍后重试"),
    "TIMEOUT": (504, "分析超时，请缩短报错内容后重试"),
}


def error_response(request_id: str, error_code: str, detail: str | None = None) -> JSONResponse:
    status_code, message = ERROR_CODES.get(error_code, (500, "未知错误"))
    return JSONResponse(
        status_code=status_code,
        content={
            "request_id": request_id,
            "error_code": error_code,
            "message": message,
            "detail": detail,
        },
    )


@router.post("/analyze")
async def analyze_error(request: Request, body: AnalyzeRequest):
    request_id = getattr(request.state, "request_id", "req_unknown")

    # --- 限流 ---
    rate_limiter = getattr(request.app.state, "rate_limiter", None)
    remaining_requests = 30  # 默认值（Redis 不可用时）
    if rate_limiter:
        try:
            remaining_requests = await rate_limiter.check(request, body.visitor_id)
        except HTTPException as e:
            # 限流超限，直接返回 429
            error_code = e.detail.get("error_code", "RATE_LIMIT_VISITOR") if isinstance(e.detail, dict) else "RATE_LIMIT_VISITOR"
            return error_response(request_id, error_code)
        except Exception as e:
            logger.warning(f"限流检查异常，跳过限流: {e}")
    else:
        logger.warning("RateLimiter 不可用，跳过限流检查")

    # --- 场景识别 ---
    detected_tool = detect_tool(body.error_text)

    # --- 敏感信息脱敏 ---
    redact_result = redact(body.error_text)
    redacted_text = redact_result.redacted_text

    # --- 查缓存 ---
    result_cache = getattr(request.app.state, "result_cache", None)
    cached_data = None
    if result_cache:
        try:
            cached_data = await result_cache.get(redacted_text, body.mode.value, detected_tool)
        except Exception as e:
            logger.warning(f"缓存查询异常: {e}")

    if cached_data is not None:
        # 缓存命中
        try:
            if body.mode == UserMode.DEVELOPER:
                result = DevAnalysisResult(**cached_data)
            else:
                result = UserAnalysisResult(**cached_data)
        except Exception:
            # 缓存数据损坏，当作未命中
            cached_data = None

    if cached_data is not None:
        # 缓存命中：动态追加敏感信息 warning（不修改缓存）
        if redact_result.has_secrets:
            secret_warning = build_secret_warning(redact_result.found_secrets)
            if secret_warning:
                result.warnings = list(result.warnings) + [secret_warning]

        return AnalyzeResponse(
            request_id=request_id,
            mode=body.mode,
            result=result,
            cached=True,
            remaining_requests=remaining_requests,
        )

    # --- 缓存未命中：调用模型 ---
    model_router = getattr(request.app.state, "model_router", None)
    if not model_router:
        return error_response(request_id, "MODEL_ERROR", "ModelRouter 未初始化")

    # 选择 prompt
    if body.mode == UserMode.DEVELOPER:
        system_prompt = SYSTEM_PROMPT_DEVELOPER
    else:
        system_prompt = SYSTEM_PROMPT_AI_USER

    user_prompt = build_user_prompt(redacted_text, detected_tool)

    # 调用模型
    try:
        raw_text = await model_router.complete(system_prompt, user_prompt)
    except HTTPException:
        raise  # 已经是标准错误格式，直接抛出
    except Exception as e:
        logger.error(f"模型调用异常: {e}")
        return error_response(request_id, "MODEL_ERROR", str(e))

    # 解析输出
    result = parse_output(raw_text, body.mode, detected_tool)

    # 准备写入缓存的 warnings（不含本次敏感信息提醒）
    cache_warnings = list(result.warnings)

    # 追加本次敏感信息 warning 到返回结果
    if redact_result.has_secrets:
        secret_warning = build_secret_warning(redact_result.found_secrets)
        if secret_warning:
            result.warnings = cache_warnings + [secret_warning]

    # 写入缓存（写入的 result 不含本次敏感信息 warning）
    if result_cache:
        try:
            cache_dict = result.model_dump()
            cache_dict["warnings"] = cache_warnings
            await result_cache.set(redacted_text, body.mode.value, detected_tool, cache_dict)
        except Exception as e:
            logger.warning(f"缓存写入异常: {e}")

    return AnalyzeResponse(
        request_id=request_id,
        mode=body.mode,
        result=result,
        cached=False,
        remaining_requests=remaining_requests,
    )
