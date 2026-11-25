// Runs only in GitHub Actions against the built renderer, with synthetic IPC data.
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const { chromium } = await import(pathToFileURL(path.join(process.env.UI_PREVIEW_TOOLS, "node_modules/playwright/index.mjs")).href);
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", "4173"], { stdio: "inherit" });
await fs.mkdir("ui-preview", { recursive: true });
let browser;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await fetch("http://127.0.0.1:4173").then(r => r.ok).catch(() => false)) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  browser = await chromium.launch();
  for (const view of ["plugins", "sessions", "mcp", "settings"]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(({ view }) => {
      localStorage.setItem("language", "zh");
      localStorage.setItem("cc-switch-last-view", view);
      localStorage.setItem("cc-switch-last-app", "claude");
      localStorage.setItem("cc-switch.sessionManager.groupMode", "time");
      const now = Date.now();
      const settings = { language: "zh", showInTray: true, sessionAutoSyncEnabled: false, sessionContentSearchEnabled: true, usageDisplay: { currency: "CNY", exchangeRates: { CNY: 7.2 } } };
      const messages = [
        { role: "user", id: "u1", ts: now, content: "请说明这次更新的功能，并检查配置文件。" },
        { role: "assistant", id: "a1", ts: now + 1000, blocks: [{ type: "text", text: "本次更新包含 **会话阅读器**、插件管理、MCP 连通性检查和增强统计。\n\n```toml\n[agents]\nmax_threads = 8\n```" }] },
        { role: "user", id: "u2", ts: now + 2000, content: "自动审批模型也可以单独设置吗？" },
        { role: "assistant", id: "a2", ts: now + 3000, content: "可以，在 Codex 供应商编辑页选择自动审批模型。" },
      ];
      const summary = { totalRequests: 120, totalCost: "4.82", totalInputTokens: 32000, totalOutputTokens: 18000, totalCacheCreationTokens: 6000, totalCacheReadTokens: 94000, successRate: 99.2, realTotalTokens: 150000, cacheHitRate: 0.712 };
      const callbacks = new Map();
      let callbackId = 0;
      window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
      window.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main", windowLabel: "main" } },
        transformCallback(callback) { callbacks.set(++callbackId, callback); return callbackId; },
        unregisterCallback(id) { callbacks.delete(id); },
        convertFileSrc: value => value,
        async invoke(command, args = {}) {
          if (command === "get_settings") return settings;
          if (command === "save_settings") { Object.assign(settings, args.settings); return true; }
          if (command === "get_providers" || command === "get_global_proxy_config" || command === "get_proxy_takeover_status") return {};
          if (command === "get_current_provider") return "";
          if (command === "get_proxy_status") return { running: false, activeConnections: 0, totalRequests: 0, successRequests: 0, failedRequests: 0, successRate: 100, activeTargets: [] };
          if (command === "get_mcp_servers") return { docs: { id: "docs", name: "Documentation MCP", server: { type: "http", url: "https://example.com/mcp" }, apps: { claude: true, codex: true }, tags: [] } };
          if (command === "start_mcp_connectivity_checks") { for (const serverId of args.serverIds) args.onResult.onmessage({ serverId, status: "connected" }); return "preview"; }
          if (command === "list_sessions") return [{ providerId: "claude", sessionId: "preview", title: "功能接入与配置检查", projectDir: "/workspace/cc-switch", createdAt: now, lastActiveAt: now, sourcePath: "/preview/session.jsonl", resumeCommand: "claude --resume preview" }];
          if (command === "sync_session_index") return { running: false, processed: 1, total: 1 };
          if (command === "search_session_content") return { hits: [], status: { running: false, processed: 1, total: 1 } };
          if (command === "get_session_messages") return messages;
          if (command === "stream_session_messages") {
            args.onChunk.onmessage({ type: "header", total: messages.length, turns: [], cached: false, parseMs: 1 });
            args.onChunk.onmessage({ type: "messages", start: 0, messages });
            args.onChunk.onmessage({ type: "done", payloadBytes: 500 });
            return null;
          }
          if (command === "list_installed_plugins") return [{ id: "frontend-design@official", name: "frontend-design", description: "创建清晰、实用的前端界面", marketplace: "official", version: "1.0", installed: true, enabled: true, manageable: true, removable: true, scope: "user" }];
          if (command === "list_plugin_catalog") return [{ id: "review@official", name: "review", description: "检查代码变更与配置", marketplace: "official", installed: false, installable: true }];
          if (command === "get_usage_summary" || command === "get_session_usage_summary") return summary;
          if (command === "get_usage_summary_by_app") return [{ appType: "claude", summary }];
          if (command === "get_usage_trends") return Array.from({ length: 7 }, (_, i) => ({ date: new Date(now - (6-i)*86400000).toISOString().slice(0,10), requestCount: 12+i, totalCost: String(0.4+i/10), totalTokens: 15000+i*1000, totalInputTokens: 4000, totalOutputTokens: 2000, totalCacheCreationTokens: 1000, totalCacheReadTokens: 8000+i*1000 }));
          if (command === "get_usage_first_date") return new Date(now-30*86400000).toISOString().slice(0,10);
          if (command === "get_request_logs") return { data: [], total: 0, page: 0, pageSize: 20 };
          if (command === "get_session_usage_last_sync") return now;
          if (command.startsWith("list_") || command === "get_installed_skills" || command === "get_live_provider_ids" || command === "get_provider_stats" || command === "get_model_stats" || command === "get_model_pricing") return [];
          if (command === "get_config_dir" || command.endsWith("config_path") || command === "plugin:path|resolve_directory") return "/home/preview/.cc-switch";
          if (command === "plugin:app|version") return "3.20.7";
          if (command === "plugin:event|listen") return 1;
          if (command.startsWith("is_") || command.startsWith("has_")) return false;
          return null;
        },
      };
    }, { view });
    try {
    await page.goto("http://127.0.0.1:4173");
    if (view === "plugins") await page.getByText("frontend-design", { exact: true }).waitFor();
    if (view === "sessions") {
      await page.getByRole("button", { name: "功能接入与配置检查", exact: true }).click();
      await page.getByText("请说明这次更新的功能，并检查配置文件。", { exact: true }).first().waitFor();
    }
    if (view === "mcp") await page.getByText("Documentation MCP", { exact: true }).waitFor();
    if (view === "settings") {
      await page.getByRole("tab", { name: /用量/ }).click();
      await page.getByText("120", { exact: true }).first().waitFor();
    }
    await page.screenshot({ path: `ui-preview/${view}.png`, fullPage: true });
    if (errors.length) throw new Error(`${view}: ${errors.join("; ")}`);
    } catch (error) {
      await page.screenshot({ path: `ui-preview/${view}-failure.png`, fullPage: true });
      await fs.writeFile(`ui-preview/${view}-failure.txt`, `${error}\n${errors.join("\n")}\n${await page.locator("body").innerText()}`);
      throw error;
    }
    await page.close();
  }
} finally {
  await browser?.close();
  server.kill();
}
