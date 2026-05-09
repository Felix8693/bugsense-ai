"use client";

interface ToolBadgeProps {
  tool: string | null;
  isFromBackend: boolean;
}

export default function ToolBadge({ tool, isFromBackend }: ToolBadgeProps) {
  if (!tool) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-full text-sm">
      <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
      <span className="text-accent">
        已识别：{tool}
        {!isFromBackend && (
          <span className="text-text-secondary ml-1 text-xs">(本地识别)</span>
        )}
      </span>
    </div>
  );
}
