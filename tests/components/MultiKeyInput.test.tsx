import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useState } from "react";
import { ApiKeySection } from "@/components/providers/forms/shared/ApiKeySection";
import type { MultiKeyConfig } from "@/types";

function renderApiKeySection(initialConfig: MultiKeyConfig) {
  function Harness() {
    const [apiKey, setApiKey] = useState(initialConfig.keys[0] ?? "");
    const [multiKeyConfig, setMultiKeyConfig] = useState<
      MultiKeyConfig | undefined
    >(initialConfig);

    return (
      <>
        <ApiKeySection
          value={apiKey}
          onChange={setApiKey}
          category="aggregator"
          shouldShowLink={false}
          websiteUrl=""
          multiKeyConfig={multiKeyConfig}
          onMultiKeyConfigChange={setMultiKeyConfig}
          enableMultiKey
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
});
