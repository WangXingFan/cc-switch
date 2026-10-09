/**
 * 新增对话框：Codex、Gemini CLI、Grok Build 的表单把当前配置文件投影到编辑框上显示，
 * 投影结果就是保存时三方比较的底。锁定一条不变式：打开对话框后，编辑框里的内容
 * 和最后上报的底一致。对不上时，底里有、显示里没有的全局设置会在保存时被当成删除
 * 写进配置文件。
 *
 * 新增入口现在只有自定义（不再有预设可点），所以这里只覆盖「打开即投影」。
 *
 * MSW 替身：投影在原内容上加一份「配置文件里已有的全局设置」，模拟真实的 live。
 */
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderForm } from "@/components/providers/forms/ProviderForm";
import type { AppId } from "@/lib/api";
import { server } from "../msw/server";
import { createTestQueryClient } from "../utils/testQueryClient";

vi.mock("@/components/JsonEditor", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      data-testid="json-editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock("@/components/providers/forms/CodexOAuthSection", () => ({
  CodexOAuthSection: () => <div data-testid="codex-oauth-section" />,
}));

vi.mock("@/components/providers/forms/hooks", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/providers/forms/hooks")>();
  return {
    ...actual,
    useCopilotAuth: () => ({
      isAuthenticated: false,
      isStatusSuccess: true,
      isStatusError: false,
      accounts: [],
    }),
    useCodexOauth: () => ({
      isAuthenticated: false,
      isStatusSuccess: true,
      isStatusError: false,
      defaultAccountId: null,
      accounts: [],
    }),
    useXaiOauth: () => ({ isAuthenticated: false, accounts: [] }),
  };
});

const LIVE_TOML = '\n[ui]\ntheme = "dark"\n';

vi.mock("@/lib/query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/query")>();
  return {
    ...actual,
    useSettingsQuery: () => ({
      data: { commonConfigConfirmed: true },
    }),
  };
});

type Base = Record<string, unknown> | null;

function projectAsLive() {
  server.use(
    http.post(
      "http://tauri.local/get_provider_editor_view",
      async ({ request }) => {
        const { app, settingsConfig = {} } = (await request.json()) as {
          app: AppId;
          settingsConfig?: Record<string, unknown>;
        };
        const settings = { ...settingsConfig };
        if (app === "gemini") {
          settings.env = {
            ...(settingsConfig.env as Record<string, unknown>),
            GEMINI_SANDBOX: "docker",
          };
          settings.config = {
            ...(settingsConfig.config as Record<string, unknown>),
            ui: { theme: "dark" },
          };
        } else {
          settings.config = `${String(settingsConfig.config ?? "")}${LIVE_TOML}`;
        }
        return HttpResponse.json({ settings, inactive: [] });
      },
    ),
  );
}

function renderForm(appId: AppId, bases: Base[]) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProviderForm
        appId={appId}
        submitLabel="save"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        onEditorBaseChange={(base) => bases.push(base)}
      />
    </QueryClientProvider>,
  );
}

function editorTexts(): string[] {
  return screen
    .getAllByTestId("json-editor")
    .map((node) => (node as HTMLTextAreaElement).value);
}

/** 等到最后一次上报的底不为空。 */
async function firstBase(bases: Base[]): Promise<Base> {
  await waitFor(() => {
    expect(bases.length).toBeGreaterThan(0);
    expect(bases.at(-1)).not.toBeNull();
  });
  return bases.at(-1)!;
}

describe("新增对话框的草稿投影", () => {
  beforeEach(() => {
    projectAsLive();
  });

  it("Codex：打开新增对话框时，显示内容等于底", async () => {
    const bases: Base[] = [];
    renderForm("codex", bases);

    const base = await firstBase(bases);
    expect(String(base!.config)).toContain(LIVE_TOML.trim());
    await waitFor(() => expect(editorTexts()).toContain(String(base!.config)));
  });

  it("Gemini：打开新增对话框时，全局设置仍在显示内容和底里", async () => {
    const bases: Base[] = [];
    renderForm("gemini", bases);

    const base = await firstBase(bases);
    expect((base!.env as Record<string, unknown>).GEMINI_SANDBOX).toBe(
      "docker",
    );
    await waitFor(() =>
      expect(
        editorTexts().some((text) => text.includes("GEMINI_SANDBOX=docker")),
      ).toBe(true),
    );
  });

  it("Grok Build：打开新增对话框时，显示内容等于底", async () => {
    const bases: Base[] = [];
    renderForm("grokbuild", bases);

    const base = await firstBase(bases);
    await waitFor(() => expect(editorTexts()).toContain(String(base!.config)));
  });
});