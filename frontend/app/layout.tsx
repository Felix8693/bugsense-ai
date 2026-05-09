import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BugSense AI",
  description: "粘贴报错 → 30秒看懂 + 拿到可执行的修复方案",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
