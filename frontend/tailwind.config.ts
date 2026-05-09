import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--bg-primary)",
        card: "var(--bg-card)",
        accent: "var(--accent)",
        "accent-success": "var(--accent-success)",
        "accent-error": "var(--accent-error)",
        "accent-warning": "var(--accent-warning)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "PingFang SC",
          "Microsoft YaHei",
          "Hiragino Sans GB",
          "WenQuanYi Micro Hei",
          "sans-serif",
        ],
        mono: ["Cascadia Code", "Consolas", "Monaco", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
