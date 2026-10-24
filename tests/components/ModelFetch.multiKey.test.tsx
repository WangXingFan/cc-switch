import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClaudeFormFields } from "@/components/providers/forms/ClaudeFormFields";
import { CodexFormFields } from "@/components/providers/forms/CodexFormFields";
import { GeminiFormFields } from "@/components/providers/forms/GeminiFormFields";
import { Form } from "@/components/ui/form";
import type { MultiKeyConfig } from "@/types";

const modelFetchApi = vi.hoisted(() => ({
  fetchModelsForConfig: vi.fn(),
  showFetchModelsError: vi.fn(),
}));

vi.mock("@/lib/api/model-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/model-fetch")>()),
  ...modelFetchApi,
}));

const baseUrl = "https://api.example.com/v1";

function renderForm(
  app: "claude" | "codex" | "gemini",
  initialConfig?: MultiKeyConfig,
) {
  function Harness() {
    const form = useForm();
    const [multiKeyConfig, setMultiKeyConfig] = useState(initialConfig);
    const [apiKey, setApiKey] = useState("first-key");
    const commonProps = {
      category: "aggregator" as const,
      onApiKeyChange: setApiKey,
      shouldShowApiKeyLink: false,
      websiteUrl: "",
      multiKeyConfig,
      onMultiKeyConfigChange: setMultiKeyConfig,
      shouldShowSpeedTest: false,
      onBaseUrlChange: vi.fn(),
      isEndpointModalOpen: false,
      onEndpointModalToggle: vi.fn(),
      autoSelect: false,
      onAutoSelectChange: vi.fn(),
      speedTestEndpoints: [],
      onModelChange: vi.fn(),
      isFullUrl: false,
      onFullUrlChange: vi.fn(),
      onApiFormatChange: vi.fn(),
      customUserAgent: "",
      onCustomUserAgentChange: vi.fn(),
      localProxyHeadersOverride: "",
      onLocalProxyHeadersOverrideChange: vi.fn(),
      localProxyBodyOverride: "",
      onLocalProxyBodyOverrideChange: vi.fn(),
    };

    return (
      <Form {...form}>
        {app === "claude" ? (
          <ClaudeFormFields
            {...commonProps}
            apiKey={apiKey}
            baseUrl={baseUrl}
            shouldShowApiKey
            templateValueEntries={[]}
            templateValues={{}}
            templatePresetName=""
            onTemplateValueChange={vi.fn()}
            shouldShowModelSelector
            claudeModel=""
            defaultHaikuModel=""
            defaultHaikuModelName=""
            defaultSonnetModel=""
            defaultSonnetModelName=""
            defaultOpusModel=""
            defaultOpusModelName=""
            defaultFableModel=""
            defaultFableModelName=""
            subagentModel=""
            apiFormat="anthropic"
            apiKeyField="ANTHROPIC_AUTH_TOKEN"
            onApiKeyFieldChange={vi.fn()}
          />
        ) : app === "codex" ? (
          <CodexFormFields
            {...commonProps}
            codexApiKey={apiKey}
            codexBaseUrl={baseUrl}
            apiFormat="openai_responses"
            anthropicAuthField="ANTHROPIC_AUTH_TOKEN"
            onAnthropicAuthFieldChange={vi.fn()}
            impersonateClaudeCode={false}
            onImpersonateClaudeCodeChange={vi.fn()}
            maxOutputTokens=""
            onMaxOutputTokensChange={vi.fn()}
            promptCacheRouting="auto"
            onPromptCacheRoutingChange={vi.fn()}
          />
        ) : (
          <GeminiFormFields
            {...commonProps}
            apiKey={apiKey}
            baseUrl={baseUrl}
            shouldShowApiKey
            onCustomEndpointsChange={vi.fn()}
            shouldShowModelField
            model=""
          />
        )}
      </Form>
    );
  }

  return render(<Harness />);
}

function getFetchButton() {
  return screen.getByRole("button", { name: "providerForm.fetchModels" });
}

describe.each(["claude", "codex", "gemini"] as const)(
  "%s model fetching with multiple keys",
  (app) => {
    beforeEach(() => {
      modelFetchApi.fetchModelsForConfig.mockResolvedValue([]);
    });

    it("fetches with the selected key and follows selection changes", async () => {
      renderForm(app, {
        keys: ["first-key", "second-key", "third-key"],
        strategy: "fixed",
        fixedIndex: 1,
      });

      fireEvent.click(getFetchButton());

      await waitFor(() => expect(getFetchButton()).not.toBeDisabled());
      expect(
        modelFetchApi.fetchModelsForConfig.mock.calls[0]?.slice(0, 2),
      ).toEqual([baseUrl, "second-key"]);

      fireEvent.click(
        screen.getAllByTitle("provider.multiKey.fixedSelectHint")[1],
      );
      fireEvent.click(getFetchButton());

      await waitFor(() => expect(getFetchButton()).not.toBeDisabled());
      expect(
        modelFetchApi.fetchModelsForConfig.mock.calls[1]?.slice(0, 2),
      ).toEqual([baseUrl, "third-key"]);
    });

    it("preserves draft key indices when earlier entries are empty", async () => {
      renderForm(app, {
        keys: ["first-key", "", " selected-key "],
        strategy: "fixed",
        fixedIndex: 2,
      });

      fireEvent.click(getFetchButton());

      await waitFor(() => expect(getFetchButton()).not.toBeDisabled());
      expect(
        modelFetchApi.fetchModelsForConfig.mock.calls[0]?.slice(0, 2),
      ).toEqual([baseUrl, "selected-key"]);
    });

    it("reports an empty selected key instead of fetching with the first key", () => {
      renderForm(app, {
        keys: ["first-key", "   "],
        strategy: "fixed",
        fixedIndex: 1,
      });

      fireEvent.click(getFetchButton());

      expect(modelFetchApi.fetchModelsForConfig).not.toHaveBeenCalled();
      expect(modelFetchApi.showFetchModelsError).toHaveBeenCalledWith(
        null,
        expect.any(Function),
        { hasApiKey: false, hasBaseUrl: true },
      );
    });

    it.each(["round_robin", "random"] as const)(
      "keeps using the primary key for %s rotation",
      async (strategy) => {
        renderForm(app, {
          keys: ["first-key", "second-key"],
          strategy,
          fixedIndex: 1,
        });

        fireEvent.click(getFetchButton());

        await waitFor(() => expect(getFetchButton()).not.toBeDisabled());
        expect(
          modelFetchApi.fetchModelsForConfig.mock.calls[0]?.slice(0, 2),
        ).toEqual([baseUrl, "first-key"]);
      },
    );

    it("keeps single-key model fetching working", async () => {
      renderForm(app);

      fireEvent.click(getFetchButton());

      await waitFor(() => expect(getFetchButton()).not.toBeDisabled());
      expect(
        modelFetchApi.fetchModelsForConfig.mock.calls[0]?.slice(0, 2),
      ).toEqual([baseUrl, "first-key"]);
    });
  },
);
