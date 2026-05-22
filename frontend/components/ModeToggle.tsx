"use client";

type Mode = "developer" | "ai_user";

interface ModeToggleProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

const MODE_INFO: Record<Mode, { label: string; desc: string }> = {
  developer: {
    label: "开发者",
    desc: "技术化分析，包含命令、代码修改、依赖和配置建议",
  },
  ai_user: {
    label: "AI 工具用户",
    desc: "口语化解释，适合看不懂终端报错的新手",
  },
};

export default function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
      <div className="flex rounded-lg border border-[#2a2d3e] overflow-hidden text-xs sm:text-sm">
        <button
          onClick={() => onModeChange("developer")}
          className={`px-2.5 sm:px-4 py-1.5 sm:py-2 font-medium transition-colors ${
            mode === "developer"
              ? "bg-accent text-white"
              : "bg-card text-text-secondary hover:text-text-primary"
          }`}
        >
          {MODE_INFO.developer.label}
        </button>
        <button
          onClick={() => onModeChange("ai_user")}
          className={`px-2.5 sm:px-4 py-1.5 sm:py-2 font-medium transition-colors ${
            mode === "ai_user"
              ? "bg-accent text-white"
              : "bg-card text-text-secondary hover:text-text-primary"
          }`}
        >
          {MODE_INFO.ai_user.label}
        </button>
      </div>
      <span className="text-text-secondary text-xs hidden sm:inline">
        {MODE_INFO[mode].desc}
      </span>
    </div>
  );
}
