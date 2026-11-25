import type { AppId } from "@/lib/api/types";
import { MCP_APP_IDS, APP_IDS } from "./appConfig";

export const APP_IDS_WITH = {
  plugins: ["claude", "codex", "grokbuild", "openclaw", "pi"] as const,
  mcp: MCP_APP_IDS,
  skills: APP_IDS.filter(app => app !== "claude-desktop"),
} satisfies Record<string, readonly AppId[]>;

export type AppIdWith<K extends keyof typeof APP_IDS_WITH> = (typeof APP_IDS_WITH)[K][number];
