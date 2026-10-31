# Selected upstream compatibility fixes (2026-10-31)

Base: `f3814dcf9` on the local fork. Upstream reviewed: `91a76cfd5`.

| Change | Upstream source |
| --- | --- |
| Preserve `CLAUDE_CODE_AUTO_MODE_SERVER` when switching providers | `cf567ca64` / #7893 |
| Optional Auto Mode server-check toggle in the existing editor | selected parts of `146f3196f` |
| Bearer authentication for Claude requests converted to OpenAI formats | Claude adapter part of `6e7811e5e` |
| Honor thinking-off and accepted reasoning-effort floors | `140038221` |
| Native Anthropic Messages for supported Copilot models | adapted `9403960f8` / #8908 |
| Distinguish one-hour Claude cache writes in proxy and session costs | adapted `533055bbe` / #7653 |
| Fall through zero-valued OpenAI cache fields | `5667b287c` / #8045 |
| Reject upstream URLs pointing back to the local listener | adapted `cd9c72108` / #8598 |
| Filter the unsupported xAI Responses include marker | `8355f1f1f` / #8997 |

## Fork adaptations

- Keep the current interface and custom-only provider creation. The Auto Mode
  toggle is opt-in; existing providers and new-provider defaults are retained.
  Disabling server checks keeps the client's billed classifier, as explained
  in the checkbox help text.
- Keep multi-key selection, rotation, metadata, balance queries and cost
  multipliers. The Bearer fix uses the existing per-request key override.
- Copilot retains its current OpenAI Responses / Chat transport fallbacks.
  Only an Anthropic model advertising `/v1/messages` selects native Messages.
  Model metadata includes hidden models for protocol lookup while the UI
  continues to show only models enabled for its picker. Native responses use
  passthrough and keep thinking blocks; converted requests retain stripping.
- Apply the one-hour cache rate to the fork's existing session insertion path;
  do not import the unrelated upstream session-timing rewrite or MiniMax app.
- Keep the loopback-domain helper inside the new upstream guard because this
  fork does not have the newer shared HTTP-client helper.

## Verification

Compilation, formatting checks and tests run in GitHub Actions only. The port
includes regression coverage for protocol selection, response passthrough,
model metadata, authentication, cache accounting, loopback rejection and the
Auto Mode setting. CI outcome is recorded with the delivered commit/run links.
No local compilation, formatting check, build or test was run.
