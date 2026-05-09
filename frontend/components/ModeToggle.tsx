"use client";

type Mode = "developer" | "ai_user";

interface ModeToggleProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

export default function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="flex rounded-lg border border-[#2a2d3e] overflow-hidden text-xs sm:text-sm">
      <button
        onClick={() => onModeChange("developer")}
        className={`px-2.5 sm:px-4 py-1.5 sm:py-2 font-medium transition-colors ${
          mode === "developer"
            ? "bg-accent text-white"
            : "bg-card text-text-secondary hover:text-text-primary"
        }`}
      >
        开发者
      </button>
      <button
        onClick={() => onModeChange("ai_user")}
        className={`px-2.5 sm:px-4 py-1.5 sm:py-2 font-medium transition-colors ${
          mode === "ai_user"
            ? "bg-accent text-white"
            : "bg-card text-text-secondary hover:text-text-primary"
        }`}
      >
        AI 用户
      </button>
    </div>
  );
}
