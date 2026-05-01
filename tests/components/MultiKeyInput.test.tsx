import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { ApiKeySection } from "@/components/providers/forms/shared/ApiKeySection";
import type { MultiKeyConfig } from "@/types";
import { server } from "../msw/server";

function renderApiKeySection(
  initialConfig: MultiKeyConfig,
  options: {
    showBalanceMetadata?: boolean;
    appId?: "claude" | "codex" | "gemini";
    providerId?: string;
    balanceQueryBaseUrl?: string;
  } = {},
) {
  function Harness() {
    const [apiKey, setApiKey] = useState(initialConfig.keys[0] ?? "");
    const [multiKeyConfig, setMultiKeyConfig] = useState<
      MultiKeyConfig | undefined
    >(initialConfig);

    return (
      <>
        <ApiKeySection
          appId={options.appId}
          providerId={options.providerId}
          value={apiKey}
          onChange={setApiKey}
          category="aggregator"
          shouldShowLink={false}
          websiteUrl=""
          multiKeyConfig={multiKeyConfig}
          onMultiKeyConfigChange={setMultiKeyConfig}
          enableMultiKey
          showBalanceMetadata={options.showBalanceMetadata}
          balanceQueryBaseUrl={options.balanceQueryBaseUrl}
        />
        <output data-testid="state">
          {JSON.stringify({ apiKey, multiKeyConfig })}
        </output>
      </>
    );
  }

  return render(<Harness />);
}

function getState() {
  return JSON.parse(screen.getByTestId("state").textContent ?? "{}") as {
    apiKey: string;
    multiKeyConfig?: MultiKeyConfig;
  };
}

describe("MultiKeyInput", () => {
  it("removes a key before the fixed key without restoring the stale key list", async () => {
    renderApiKeySection({
      keys: ["key-1", "key-2", "key-3"],
      strategy: "fixed",
      fixedIndex: 2,
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove API Key 2" }));

    await waitFor(() => {
      expect(getState().multiKeyConfig).toMatchObject({
        keys: ["key-1", "key-3"],
        strategy: "fixed",
        fixedIndex: 1,
      });
    });
  });

  it("resets fixed index when the selected key is removed", async () => {
    renderApiKeySection({
      keys: ["key-1", "key-2", "key-3"],
      strategy: "fixed",
      fixedIndex: 1,
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove API Key 2" }));

    await waitFor(() => {
      expect(getState().multiKeyConfig).toMatchObject({
        keys: ["key-1", "key-3"],
        strategy: "fixed",
        fixedIndex: 0,
      });
    });
  });

  it("keeps balance metadata attached to a single key", async () => {
    renderApiKeySection(
      {
        keys: ["key-1"],
        strategy: "round_robin",
      },
      { showBalanceMetadata: true },
    );

    expect(
      screen.queryByPlaceholderText("provider.multiKey.balanceAccessToken"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "provider.multiKey.balanceOpen",
      }),
    );

    fireEvent.change(
      screen.getByPlaceholderText("provider.multiKey.balanceAccessToken"),
      {
        target: { value: "access-token-1" },
      },
    );
    fireEvent.change(
      screen.getByPlaceholderText("provider.multiKey.balanceUserId"),
      {
        target: { value: "user-1" },
      },
    );

    await waitFor(() => {
      expect(getState().multiKeyConfig).toMatchObject({
        keys: ["key-1"],
        strategy: "round_robin",
        keyMetadata: [
          {
            balanceQuery: {
              accessToken: "access-token-1",
              userId: "user-1",
            },
          },
        ],
      });
    });
  });

  it("queries all configured key balances and displays compact numbers", async () => {
    server.use(
      http.post("http://tauri.local/testUsageScript", async ({ request }) => {
        const body = (await request.json()) as {
          newApiAccounts?: Array<{ accessToken: string; userId: string }>;
        };
        expect(body.newApiAccounts).toHaveLength(2);
        return HttpResponse.json({
          success: true,
          data: [
            { remaining: 4.29, isValid: true },
            { remaining: 12, isValid: true },
          ],
        });
      }),
    );

    renderApiKeySection(
      {
        keys: ["key-1", "key-2"],
        strategy: "round_robin",
        keyMetadata: [
          {
            balanceQuery: {
              accessToken: "access-token-1",
              userId: "user-1",
            },
          },
          {
            balanceQuery: {
              accessToken: "access-token-2",
              userId: "user-2",
            },
          },
        ],
      },
      {
        showBalanceMetadata: true,
        appId: "claude",
        providerId: "provider-1",
        balanceQueryBaseUrl: "https://cngpt.net",
      },
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "provider.multiKey.balanceQueryAll",
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("4.29")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();
    });
  });
});
