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

          {/* Example Buttons */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setInputText(`Traceback (most recent call last):
  File "main.py", line 42, in process_data
    result = json.loads(raw_data)
json.decoder.JSONDecodeError: Expecting property name enclosed in double quotes: line 3 column 5 (char 45)`)}
              className="px-3 py-1.5 bg-card border border-[#2a2d3e] rounded-full text-xs text-text-secondary hover:text-accent hover:border-accent/50 transition-colors"
            >
              试试 Python 报错
            </button>
            <button
              type="button"
              onClick={() => setInputText(`npm ERR! code ERESOLVE
npm ERR! ERESOLVE could not resolve
npm ERR! While resolving: my-project@1.0.0
npm ERR! Found: react@18.2.0
npm ERR! node_modules/react
npm ERR!   react@"^18.2.0" from the root project
npm ERR!
npm ERR! Could not resolve dependency:
npm ERR! peer react@"^17.0.0" from some-old-lib@2.3.1
npm ERR! node_modules/some-old-lib
npm ERR!   some-old-lib@"^2.3.1" from the root project`)}
              className="px-3 py-1.5 bg-card border border-[#2a2d3e] rounded-full text-xs text-text-secondary hover:text-accent hover:border-accent/50 transition-colors"
            >
              试试 npm 依赖冲突
            </button>
            <button
              type="button"
              onClick={() => setInputText(`ERROR [builder 5/8] RUN npm ci --only=production
#12 1.234 npm ERR! code E401
#12 1.235 npm ERR! Unable to authenticate, need: Basic realm="https://registry.npmjs.org/"
#12 1.237
#12 1.237 npm ERR! A complete log of this run can be found in:
#12 1.237 npm ERR!     /root/.npm/_logs/2024-01-15T10_32_45_123Z-debug-0.log
------
Dockerfile:8
--------------------
   6 |
   7 |     COPY package*.json ./
   8 | >>> RUN npm ci --only=production
   9 |
  10 |     COPY . .
--------------------
error: failed to solve: process "/bin/sh -c npm ci --only=production" did not complete successfully: exit code 1`)}
              className="px-3 py-1.5 bg-card border border-[#2a2d3e] rounded-full text-xs text-text-secondary hover:text-accent hover:border-accent/50 transition-colors"
            >
              试试 Docker 构建失败
            </button>
            <button
              type="button"
              onClick={() => setInputText(`Warning: Text content did not match. Server: "Hello, User!" Client: "Hello, Guest!"
    at span
    at div
    at Header (webpack-internal:///(app-pages-browser)/./components/Header.tsx:15:11)
    at body
    at html

Error: Hydration failed because the initial UI does not match what was rendered on the server.
See more info here: https://nextjs.org/docs/messages/react-hydration-error`)}
              className="px-3 py-1.5 bg-card border border-[#2a2d3e] rounded-full text-xs text-text-secondary hover:text-accent hover:border-accent/50 transition-colors"
            >
              试试 Next.js Hydration
            </button>
          </div>

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
