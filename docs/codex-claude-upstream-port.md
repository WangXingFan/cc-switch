# Codex and Claude upstream port

## Scope

- Fork baseline: `99d9bb2a2f82e8231e4d7366e6ff7716f87f2ecb`.
- Upstream baseline: `36d950411e622129f285635f43c17e5f35462413`.
- Import Codex and Claude fixes, provider presets, model compatibility, usage,
  tool management, and configuration-switching dependencies.
- Preserve all fork features, including Gemini multi-key support, round-robin,
  random and fixed key selection, key metadata and balance persistence, NewAPI
  balance queries, account balance synchronization, visible API keys, global
  window shortcuts, settings rollback, and collapsed multi-plan balances.
- Preserve existing unrelated application behavior and cost-multiplier settings.

## Verification

Compilation, formatting checks, and tests must run in GitHub Actions only.
Static review confirms the fork-specific Gemini multi-key rotation and balance
metadata, NewAPI balance queries, cost multipliers, global shortcuts, and
Codex official-auth preservation paths remain present. No GitHub Actions run has
verified this port yet.

## Progress

Codex/Claude changes and the shared live-config/mode dependencies are present
in the working tree. CI and release publication remain pending. The working
branch is `main` at version 3.20.6, while tag `v3.20.5` points to the separate
`codex-sync-upstream-20260911` branch.

## CI repair

The Windows run [36855872261](https://github.com/WangXingFan/cc-switch/actions/runs/36855872261)
failed in frontend checks: the draft editor callback was still destructured under
an unused alias, five files needed formatting, and imported tests assumed both
the old mutation signature and unrelated upstream catalog changes.

Keep the existing Pi, OpenCode, OpenClaw, and Hermes catalogs in this selective
port. Restore their baseline preset assertions, remove tests for unported Pi
PPIO/TokenHub presets, and retain the updated Claude/Codex assertions. The balance
test must exercise the fork's default-collapsed behavior. Mutation tests cover
the separate editor save payload, and the late-probe test waits for the relevant
Claude request instead of assuming an upstream-specific total tool count.

Windows checks now run as separate steps so an earlier native command failure
cannot be hidden by a later successful command in the same PowerShell step.
