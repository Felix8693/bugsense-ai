const FRONTEND_TOOL_PATTERNS: Record<string, string[]> = {
  "Claude Code": ["claude code", "configured model not available", "gateway couldn't serve"],
  "Cursor / MCP": ["cursor", "mcp server", "mcp.json", ".cursor/mcp"],
  "OpenClaw": ["openclaw", "open claw", "gateway port 18790"],
  "Hermes Agent": ["hermes", "hermes agent", "hermes-agent"],
  "Ollama": ["ollama", "localhost:11434", "pull model manifest"],
  "npm / Node.js": ["npm err", "cannot find module", "node_modules", "package.json"],
  "Python": ["traceback", "modulenotfounderror", "importerror", "no module named"],
  "Docker": ["dockerfile", "docker build", "docker run"],
  "Git": ["fatal:", "git push", "git pull", "merge conflict"],
  "Next.js": ["next.js", "nextjs", "next build"],
};

export function detectToolFrontend(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [tool, patterns] of Object.entries(FRONTEND_TOOL_PATTERNS)) {
    if (patterns.some((p) => lower.includes(p))) {
      return tool;
    }
  }
  return null;
}
