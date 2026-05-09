"use client";

export default function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-text-secondary text-sm">
        正在分析中，通常需要 5~15 秒...
      </p>
    </div>
  );
}
