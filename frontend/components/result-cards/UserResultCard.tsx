"use client";

import { useState } from "react";
import type { UserAnalysisResult } from "@/lib/types";

interface UserResultCardProps {
  result: UserAnalysisResult;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="text-xs px-2 py-1 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
    >
      {copied ? "已复制" : "复制"}
    </button>
  );
}

export default function UserResultCard({ result }: UserResultCardProps) {
  return (
    <div className="space-y-4">
      {/* 通俗解释卡片 - 大字体 */}
      <div className="bg-card border border-[#2a2d3e] rounded-lg p-5">
        <h3 className="font-semibold text-text-primary mb-3">这是怎么回事</h3>
        <p className="text-text-primary text-base leading-relaxed">
          {result.plain_explanation}
        </p>
        <p className="mt-3 text-text-secondary text-sm">
          {result.severity_message}
        </p>
      </div>

      {/* 步骤引导 */}
      {result.steps.length > 0 && (
        <div className="bg-card border border-[#2a2d3e] rounded-lg p-4">
          <h3 className="font-semibold text-text-primary mb-3">按这个步骤来</h3>
          <ol className="space-y-4">
            {result.steps.map((step) => (
              <li key={step.step_number} className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/20 text-accent text-sm flex items-center justify-center font-medium">
                  {step.step_number}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-sm leading-relaxed">
                    {step.instruction}
                  </p>
                  {step.command && (
                    <div className="mt-2 flex items-center gap-2 bg-[#0d0f14] rounded px-3 py-2">
                      <code className="flex-1 text-accent text-xs font-mono break-all">
                        {step.command}
                      </code>
                      <CopyButton text={step.command} />
                    </div>
                  )}
                  {step.screenshot_hint && (
                    <p className="mt-1.5 text-text-secondary text-xs">
                      👀 {step.screenshot_hint}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 警告卡片 - 橙色 */}
      {result.warnings.length > 0 && (
        <div className="bg-accent-warning/5 border border-accent-warning/20 border-l-4 border-l-accent-warning rounded-lg p-4">
          <h3 className="font-semibold text-accent-warning mb-2">⚠️ 注意</h3>
          <ul className="space-y-1.5">
            {result.warnings.map((w, i) => (
              <li key={i} className="text-text-secondary text-sm">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 验收标准 - 绿色 */}
      <div className="bg-accent-success/5 border border-accent-success/20 border-l-4 border-l-accent-success rounded-lg p-4">
        <h3 className="font-semibold text-accent-success mb-2">✅ 怎么知道好了</h3>
        <p className="text-text-secondary text-sm">{result.success_check}</p>
      </div>

      {/* 还是不行 */}
      <div className="bg-card border border-[#2a2d3e] rounded-lg p-4">
        <h3 className="font-semibold text-text-primary mb-2">还是不行？</h3>
        <p className="text-text-secondary text-sm">{result.if_still_failing}</p>
      </div>
    </div>
  );
}
