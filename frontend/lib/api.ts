import { getVisitorId } from "./visitor";
import type { AnalyzeResponse, UserMode } from "./types";

export class ApiError extends Error {
  status: number;
  errorCode: string;
  message: string;

  constructor(status: number, errorCode: string, message: string) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
    this.message = message;
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_INPUT: "输入内容格式不正确",
  TOO_SHORT: "报错内容太短，请粘贴完整错误信息（至少10个字符）",
  TOO_LONG: "报错内容超过12000字符，请截取关键部分",
  RATE_LIMIT_IP: "该IP今日免费次数已用完，明天重置",
  RATE_LIMIT_VISITOR: "今日免费次数已用完，明天重置",
  MODEL_ERROR: "AI 分析服务暂时异常，请稍后重试",
  PARSE_ERROR: "分析结果解析失败，已返回基础建议",
  UPSTREAM_ERROR: "上游模型服务不可用，请稍后重试",
  TIMEOUT: "分析超时，请缩短报错内容后重试",
};

export async function analyzeError(
  errorText: string,
  mode: UserMode
): Promise<AnalyzeResponse> {
  const visitorId = getVisitorId();

  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error_text: errorText,
      mode,
      visitor_id: visitorId,
      language: "zh",
    }),
  });

  let data: Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(res.status, "UNKNOWN", `服务器返回了无法解析的响应（${res.status}）`);
  }

  if (!res.ok) {
    const errorCode = (data.error_code as string) || "UNKNOWN";
    const message =
      ERROR_MESSAGES[errorCode] ||
      (data.message as string) ||
      `请求失败（${res.status}）`;
    throw new ApiError(res.status, errorCode, message);
  }

  return data as unknown as AnalyzeResponse;
}
