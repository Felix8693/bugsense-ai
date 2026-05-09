import json
import re
import logging
from schemas.models import DevAnalysisResult, UserAnalysisResult, UserMode

logger = logging.getLogger(__name__)


def extract_json_from_text(text: str) -> dict | None:
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

    # 4. 全部失败
    return None


def make_fallback_dev_result(error_text: str, detected_tool: str) -> DevAnalysisResult:
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
        warnings=["⚠️ 本次分析结果为降级输出，准确性有限"],
    )


def make_fallback_user_result(detected_tool: str) -> UserAnalysisResult:
    return UserAnalysisResult(
        plain_explanation="抱歉，这次分析遇到了一点技术问题，没能给出详细解释。",
        severity_message="问题严重程度未知，建议寻求进一步帮助。",
        detected_tool=detected_tool,
        steps=[
            {"step_number": 1, "instruction": "把报错信息截图，发到对应工具的官方交流群或社区寻求帮助", "command": None, "screenshot_hint": None},
        ],
        warnings=["不要随意删除文件或重装系统"],
        success_check="问题解决后，你使用的工具应该能正常运行",
        if_still_failing="可以将报错截图发到工具的官方 Discord 或微信群寻求帮助",
    )


def parse_output(raw_text: str, mode: UserMode, detected_tool: str):
    data = extract_json_from_text(raw_text)

    if data is None:
        logger.warning(f"JSON extraction failed, using fallback. raw={raw_text[:200]}")
        return (
            make_fallback_dev_result("", detected_tool)
            if mode == UserMode.DEVELOPER
            else make_fallback_user_result(detected_tool)
        )

    try:
        if mode == UserMode.DEVELOPER:
            return DevAnalysisResult(**data)
        else:
            return UserAnalysisResult(**data)
    except Exception as e:
        logger.warning(f"Pydantic validation failed: {e}, using fallback")
        return (
            make_fallback_dev_result("", detected_tool)
            if mode == UserMode.DEVELOPER
            else make_fallback_user_result(detected_tool)
        )
