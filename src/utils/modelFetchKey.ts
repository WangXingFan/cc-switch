import type { MultiKeyConfig } from "@/types";

/** Resolve the selected draft key without changing the persisted primary key. */
export function getModelFetchApiKey(
  apiKey: string,
  multiKeyConfig?: MultiKeyConfig,
): string {
  if (multiKeyConfig?.strategy !== "fixed") return apiKey;

  return (multiKeyConfig.keys[multiKeyConfig.fixedIndex ?? 0] ?? apiKey).trim();
}
