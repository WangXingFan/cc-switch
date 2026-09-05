import { describe, expect, it } from "vitest";
import { normalizeMultiKeyConfigForSave } from "@/utils/providerConfigUtils";

describe("multi-key config persistence", () => {
  it("keeps metadata aligned when draft-only empty keys are removed", () => {
    expect(
      normalizeMultiKeyConfigForSave({
        keys: ["key-1", "", " key-3 "],
        strategy: "fixed",
        fixedIndex: 2,
        keyMetadata: [
          { balanceQuery: { accessToken: "token-1", userId: "user-1" } },
          { balanceQuery: { accessToken: "stale", userId: "stale" } },
          { balanceQuery: { accessToken: "token-3", userId: "user-3" } },
        ],
      }),
    ).toEqual({
      keys: ["key-1", "key-3"],
      strategy: "fixed",
      fixedIndex: 1,
      keyMetadata: [
        { balanceQuery: { accessToken: "token-1", userId: "user-1" } },
        { balanceQuery: { accessToken: "token-3", userId: "user-3" } },
      ],
    });
  });

  it("retains a single key config when it owns balance metadata", () => {
    expect(
      normalizeMultiKeyConfigForSave({
        keys: ["key-1"],
        strategy: "round_robin",
        keyMetadata: [
          { balanceQuery: { accessToken: "token-1", userId: "user-1" } },
        ],
      }),
    ).toMatchObject({
      keys: ["key-1"],
      keyMetadata: [
        { balanceQuery: { accessToken: "token-1", userId: "user-1" } },
      ],
    });
  });
});
