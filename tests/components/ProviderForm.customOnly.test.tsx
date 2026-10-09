/**
 * 新增供应商对话框现在是「只有自定义」：锁定它不再渲染任何预设按钮，只保留
 * 「自定义」一项，避免预设入口被无意间引回来。
 *
 * 预设数据（src/config/*ProviderPresets.ts）与旧 provider 的编辑路径仍在，
 * 这里只覆盖新增入口。
 */
import { render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ProviderForm } from "@/components/providers/forms/ProviderForm";
import type { AppId } from "@/lib/api";
import { createTestQueryClient } from "../utils/testQueryClient";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

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

vi.mock("@/lib/query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/query")>();
  return {
    ...actual,
    useSettingsQuery: () => ({
      data: { commonConfigConfirmed: true },
    }),
  };
});

const ADD_APPS: AppId[] = ["claude", "codex", "gemini", "grokbuild"];

function truncatedLabelButtons() {
  return screen
    .getAllByRole("button")
    .filter((button) => button.querySelector("span.truncate") !== null);
}

/** 预设按钮带 title（分类）且带截断标签；「自定义」按钮没有 title。 */
function presetButtons() {
  return truncatedLabelButtons().filter((button) =>
    button.hasAttribute("title"),
  );
}

function renderAddForm(appId: AppId) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProviderForm
        appId={appId}
        submitLabel="save-provider"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("新增供应商只保留自定义", () => {
  it.each(ADD_APPS)("%s：新增对话框不渲染预设按钮，只留自定义", (appId) => {
    renderAddForm(appId);
    expect(presetButtons()).toHaveLength(0);
    expect(truncatedLabelButtons()).toHaveLength(1);
  });
});