"use client";

import { useState } from "react";
import type { DevAnalysisResult } from "@/lib/types";

interface DevResultCardProps {
  result: DevAnalysisResult;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
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

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-accent-error/20 text-accent-error",
    high: "bg-accent-warning/20 text-accent-warning",
    medium: "bg-accent/20 text-accent",
    low: "bg-accent-success/20 text-accent-success",
  };
  const labels: Record<string, string> = {
    critical: "严重",
    high: "高",
    medium: "中",
    low: "低",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${colors[severity] || colors.medium}`}>
      {labels[severity] || severity}
    </span>
  );
}

export default function DevResultCard({ result }: DevResultCardProps) {
  return (
    <div className="space-y-4">
      {/* 根因卡片 - 红色左边框 */}
      <div className="bg-card border border-[#2a2d3e] border-l-4 border-l-accent-error rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-semibold text-text-primary">根因分析</h3>
          <SeverityBadge severity={result.severity} />
        </div>
        <p className="text-text-secondary text-sm leading-relaxed">
          {result.root_cause}
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
          <span>错误类型：{result.error_type}</span>
          <span>|</span>
          <span>置信度：{Math.round(result.confidence * 100)}%</span>
        </div>
      </div>

      {/* 修复步骤卡片 */}
      {result.fix_steps.length > 0 && (
        <div className="bg-card border border-[#2a2d3e] rounded-lg p-4">
          <h3 className="font-semibold text-text-primary mb-3">修复步骤</h3>
          <ol className="space-y-3">
            {result.fix_steps.map((step) => (
              <li key={step.step} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-medium">
                  {step.step}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-text-secondary text-sm">{step.action}</p>
                  {step.command && (
                    <div className="mt-1.5 flex items-center gap-2 bg-[#0d0f14] rounded px-3 py-2">
                      <code className="flex-1 text-accent text-xs font-mono break-all">
                        {step.command}
                      </code>
                      <CopyButton text={step.command} />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 代码修改建议 */}
      {result.code_changes.length > 0 && (
        <div className="bg-card border border-[#2a2d3e] rounded-lg p-4">
          <h3 className="font-semibold text-text-primary mb-3">代码修改建议</h3>
          <div className="space-y-4">
            {result.code_changes.map((change, i) => (
              <div key={i} className="border border-[#2a2d3e] rounded-lg overflow-hidden">
                {change.file && (
                  <div className="px-3 py-1.5 bg-[#0d0f14] text-text-secondary text-xs font-mono border-b border-[#2a2d3e]">
                    {change.file}
                  </div>
                )}
                <div className="p-3 space-y-2">
                  {change.before && (
                    <div>
                      <div className="text-xs text-accent-error mb-1">修改前</div>
                      <pre className="bg-accent-error/5 border border-accent-error/20 rounded px-3 py-2 text-xs font-mono text-text-secondary overflow-x-auto">
                        {change.before}
                      </pre>
                    </div>
                  )}
                  {change.after && (
                    <div>
                      <div className="text-xs text-accent-success mb-1">修改后</div>
                      <pre className="bg-accent-success/5 border border-accent-success/20 rounded px-3 py-2 text-xs font-mono text-text-secondary overflow-x-auto">
                        {change.after}
                      </pre>
                    </div>
                  )}
                  <p className="text-text-secondary text-xs">{change.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 预防建议 */}
      {result.prevention_tips.length > 0 && (
        <div className="bg-card border border-[#2a2d3e] rounded-lg p-4">
          <h3 className="font-semibold text-text-primary mb-3">预防建议</h3>
          <ul className="space-y-2">
            {result.prevention_tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-text-secondary text-sm">
                <span className="text-accent-success mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings - 橙色 */}
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
    </div>
  );
}
