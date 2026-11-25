import { describe, expect, it } from "vitest";
import { parse } from "smol-toml";
import {
  extractCodexAgentsMaxThreads,
  extractCodexAgentsString,
  setCodexAgentsMaxThreads,
  setCodexAgentsString,
} from "@/utils/providerConfigUtils";

describe("Codex agent settings", () => {
  it("edits model, effort and concurrency while preserving other config", () => {
    const initial =
      '# keep this\nmodel = "main"\n[agents]\nmax_threads = 4\n[agents.worker]\ndescription = "keep"\n[mcp_servers.local]\ncommand = "node"\n';
    let edited = setCodexAgentsString(
      initial,
      "default_subagent_model",
      "mini",
    );
    edited = setCodexAgentsString(
      edited,
      "default_subagent_reasoning_effort",
      "high",
    );
    edited = setCodexAgentsMaxThreads(edited, 8);
    expect(extractCodexAgentsString(edited, "default_subagent_model")).toBe(
      "mini",
    );
    expect(extractCodexAgentsMaxThreads(edited)).toBe(8);
    expect(parse(edited)).toMatchObject({
      model: "main",
      agents: {
        default_subagent_model: "mini",
        default_subagent_reasoning_effort: "high",
        max_threads: 8,
        worker: { description: "keep" },
      },
      mcp_servers: { local: { command: "node" } },
    });
    expect(edited).toContain("# keep this");
    const cleared = setCodexAgentsString(edited, "default_subagent_model", "");
    expect(
      extractCodexAgentsString(cleared, "default_subagent_model"),
    ).toBeUndefined();
    expect(extractCodexAgentsMaxThreads(cleared)).toBe(8);
  });
});
