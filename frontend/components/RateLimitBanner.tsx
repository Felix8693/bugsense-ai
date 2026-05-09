"use client";

interface RateLimitBannerProps {
  remaining: number;
}

export default function RateLimitBanner({ remaining }: RateLimitBannerProps) {
  return (
    <div className="text-center text-sm text-text-secondary py-4">
      今日还剩 <span className="text-accent font-medium">{remaining}</span> 次
      <span className="mx-2">|</span>
      明天 00:00 重置
    </div>
  );
}
