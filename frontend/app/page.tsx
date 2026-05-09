"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ModeToggle from "@/components/ModeToggle";
import ToolBadge from "@/components/ToolBadge";
import RateLimitBanner from "@/components/RateLimitBanner";
import LoadingState from "@/components/LoadingState";
import DevResultCard from "@/components/result-cards/DevResultCard";
import UserResultCard from "@/components/result-cards/UserResultCard";
import { detectToolFrontend } from "@/lib/detect-tool";
import { analyzeError, ApiError } from "@/lib/api";
import type { UserMode, DevAnalysisResult, UserAnalysisResult } from "@/lib/types";

const PLACEHOLDERS: Record<UserMode, string> = {
  developer: "粘贴你的错误日志、终端输出或构建失败信息...",
  ai_user: "把报错截图里的红色文字复制过来粘贴在这里...",
};

export default function Home() {
  const [mode, setMode] = useState<UserMode>("developer");
  const [inputText, setInputText] = useState("");
  const [detectedTool, setDetectedTool] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DevAnalysisResult | UserAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remainingRequests, setRemainingRequests] = useState(10);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // debounce 500ms 检测工具
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!inputText.trim()) {
      setDetectedTool(null);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      const tool = detectToolFrontend(inputText);
      setDetectedTool(tool);
    }, 500);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [inputText]);

  const handleAnalyze = useCallback(async () => {
    if (!inputText.trim() || inputText.trim().length < 10) return;
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await analyzeError(inputText, mode);
      setResult(response.result);
      setRemainingRequests(response.remaining_requests);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("发生未知错误，请稍后重试");
      }
    } finally {
      setIsLoading(false);
    }
  }, [inputText, mode]);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#2a2d3e]">
        <div className="flex items-center gap-2">
          <span className="text-lg sm:text-xl font-bold text-accent">BugSense</span>
          <span className="text-lg sm:text-xl font-bold text-text-primary">AI</span>
        </div>
        <ModeToggle
          mode={mode}
          onModeChange={(m) => {
            setMode(m);
            setResult(null);
            setError(null);
          }}
        />
      </header>

      {/* Main */}
      <main className="flex flex-1 flex-col items-center justify-start sm:justify-center px-4 py-6 sm:py-12">
        <div className="w-full max-w-2xl">
          {/* Hero */}
          <h1 className="text-2xl font-bold text-text-primary text-center mb-2">
            粘贴报错，30秒看懂
          </h1>
          <p className="text-text-secondary text-center mb-6">
            智能分析错误日志，给出可执行的修复方案
          </p>

          {/* Textarea */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={PLACEHOLDERS[mode]}
            className="w-full h-36 sm:h-48 p-3 sm:p-4 bg-card border border-[#2a2d3e] rounded-lg text-text-primary placeholder-text-secondary resize-none focus:outline-none focus:border-accent transition-colors font-mono text-sm"
          />

          {/* ToolBadge */}
          <div className="mt-3 min-h-[28px]">
            <ToolBadge tool={detectedTool} isFromBackend={false} />
          </div>

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={!inputText.trim() || inputText.trim().length < 10 || isLoading}
            className="w-full mt-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-accent text-white hover:bg-accent/90"
          >
            {isLoading ? "分析中..." : "开始分析"}
          </button>

          {/* Loading */}
          {isLoading && <LoadingState />}

          {/* Error */}
          {error && (
            <div className="mt-4 bg-accent-error/5 border border-accent-error/20 rounded-lg p-4 text-accent-error text-sm">
              {error}
            </div>
          )}

          {/* 结果展示 */}
          {result && (
            <div className="mt-6">
              {mode === "developer" ? (
                <DevResultCard result={result as DevAnalysisResult} />
              ) : (
                <UserResultCard result={result as UserAnalysisResult} />
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2a2d3e]">
        <RateLimitBanner remaining={remainingRequests} />
      </footer>
    </div>
  );
}
