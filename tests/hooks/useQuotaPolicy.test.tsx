import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCodexOauthQuotaByAccountId } from "@/lib/query/subscription";
import { useCopilotQuota } from "@/lib/query/copilot";

const mocks = vi.hoisted(() => ({
  settings: { data: undefined as undefined | { officialQuotaManualOnly: boolean }, isPending: true },
  codex: vi.fn(),
  copilot: vi.fn(),
}));

vi.mock("@/lib/query/queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/query/queries")>()),
  useSettingsQuery: () => mocks.settings,
}));
vi.mock("@/lib/api/subscription", () => ({
  subscriptionApi: { getCodexOauthQuota: mocks.codex },
}));
vi.mock("@/lib/api/copilot", () => ({
  copilotGetUsage: mocks.copilot,
  copilotGetUsageForAccount: mocks.copilot,
}));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("official quota query policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settings = { data: undefined, isPending: true };
    mocks.codex.mockResolvedValue({ tool: "codex", success: true, tiers: [], queriedAt: Date.now(), error: null });
    mocks.copilot.mockResolvedValue({
      copilot_plan: "individual", quota_reset_date: "2026-12-01",
      quota_snapshots: { premium_interactions: { entitlement: 300, remaining: 200 } },
    });
  });

  it("waits for settings before any automatic request and starts when allowed", async () => {
    const { client, wrapper } = setup();
    const { rerender, unmount } = renderHook(() => useCodexOauthQuotaByAccountId("account"), { wrapper });
    expect(mocks.codex).not.toHaveBeenCalled();
    mocks.settings = { data: { officialQuotaManualOnly: false }, isPending: false };
    rerender();
    await waitFor(() => expect(mocks.codex).toHaveBeenCalledTimes(1));
    unmount();
    client.clear();
  });

  it("keeps manual refresh and cached results while automatic queries are disabled", async () => {
    mocks.settings = { data: { officialQuotaManualOnly: true }, isPending: false };
    const { client, wrapper } = setup();
    const { result, unmount } = renderHook(() => ({
      codex: useCodexOauthQuotaByAccountId("account", { autoQuery: true }),
      copilot: useCopilotQuota("account", { autoQuery: true }),
    }), { wrapper });
    expect(result.current.codex.manualIdle).toBe(true);
    expect(result.current.copilot.manualIdle).toBe(true);
    expect(mocks.codex).not.toHaveBeenCalled();
    expect(mocks.copilot).not.toHaveBeenCalled();
    await act(async () => {
      await Promise.all([result.current.codex.refetch(), result.current.copilot.refetch()]);
    });
    await waitFor(() => expect(result.current.codex.data?.success).toBe(true));
    expect(result.current.copilot.data?.success).toBe(true);
    expect(result.current.codex.manualIdle).toBe(false);
    expect(result.current.copilot.manualIdle).toBe(false);
    await act(async () => { await client.invalidateQueries(); });
    expect(mocks.codex).toHaveBeenCalledTimes(1);
    expect(mocks.copilot).toHaveBeenCalledTimes(1);
    expect(result.current.codex.data?.success).toBe(true);
    unmount();
    client.clear();
  });
});
