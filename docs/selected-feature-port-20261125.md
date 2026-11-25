# Selected upstream features

Source: upstream v4.0.40 (`f19a9d4f4`). Fork baseline: `9940a570c`.

Scope: structured session reader and message-content search; plugin management
for the fork's existing supported applications; on-demand MCP handshakes;
Codex subagent model, reasoning, concurrency and Auto Review model settings;
usage heatmap, currency/exchange-rate display and provider/model cache metrics.

The existing application shell, custom provider creation, multi-key rotation,
NewAPI balance queries, cost multipliers, global shortcut and live configuration
write engine remain the basis of the integration. New upstream applications and
aggregation mode are outside this port.

Compilation, formatting, tests and builds run in GitHub Actions only.
CI run links and final results will be recorded when integration is complete.

## Feature entry points

- Sessions: use the existing session-history button. The reader groups messages
  into turns, renders tool calls and results, and loads long content on demand.
  Message-content search is optional and uses a local index.
- Plugins: the puzzle button in the provider toolbar opens unified management
  for Claude Code, Codex, Grok Build, OpenClaw and Pi. Available actions follow
  each application's own CLI capabilities.
- MCP: the existing unified MCP page has individual and batch connectivity
  checks, including authenticated-server and failure states.
- Codex: the provider editor exposes the subagent model, reasoning effort,
  concurrency and Auto Review model. Concurrency remains a global Codex setting;
  model choices belong to the provider. Auto Review is included in every
  generated catalog entry and preserved when reading the catalog back.
- Settings → Usage: trend charts and heatmaps, provider/model cache metrics,
  selectable log columns, and currency display with manual or automatic rates.
  Stored costs remain in USD. Automatic rates are cached and fall back to saved
  rates if fetching fails. Existing model pricing and cost multipliers are kept.

The new statistics distinguish measured generation speed from estimates based
on session timestamps. Requests without adequate timing show no measured speed.
