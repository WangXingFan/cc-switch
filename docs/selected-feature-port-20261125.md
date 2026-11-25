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
