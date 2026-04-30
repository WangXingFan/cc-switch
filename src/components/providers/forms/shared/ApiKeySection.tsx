import { useTranslation } from "react-i18next";
import ApiKeyInput from "../ApiKeyInput";
import { MultiKeyInput } from "./MultiKeyInput";
import { KeyStrategySelect } from "./KeyStrategySelect";
import type {
  ProviderCategory,
  KeyRotationStrategy,
  MultiKeyConfig,
  MultiKeyMetadata,
} from "@/types";

interface ApiKeySectionProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  category?: ProviderCategory;
  shouldShowLink: boolean;
  websiteUrl: string;
  placeholder?: {
    official: string;
    thirdParty: string;
  };
  disabled?: boolean;
  isPartner?: boolean;
  partnerPromotionKey?: string;
  // 多 Key 支持
  multiKeyConfig?: MultiKeyConfig;
  onMultiKeyConfigChange?: (config: MultiKeyConfig | undefined) => void;
  enableMultiKey?: boolean;
  showBalanceMetadata?: boolean;
}

export function ApiKeySection({
  id,
  label,
  value,
  onChange,
  category,
  shouldShowLink,
  websiteUrl,
  placeholder,
  disabled,
  partnerPromotionKey,
  multiKeyConfig,
  onMultiKeyConfigChange,
  enableMultiKey = false,
  showBalanceMetadata = false,
}: ApiKeySectionProps) {
  const { t } = useTranslation();

  const defaultPlaceholder = {
    official: t("providerForm.officialNoApiKey", {
      defaultValue: "官方供应商无需 API Key",
    }),
    thirdParty: t("providerForm.apiKeyAutoFill", {
      defaultValue: "输入 API Key，将自动填充到配置",
    }),
  };

  const finalPlaceholder = placeholder || defaultPlaceholder;
  const isDisabled = disabled ?? category === "official";

  // 获取有效的 Key 列表
  const effectiveKeys =
    multiKeyConfig?.keys && multiKeyConfig.keys.length > 0
      ? multiKeyConfig.keys
      : value
        ? [value]
        : [""];

  // 多 Key 模式：检查是否有多个 Key 条目（含空的正在编辑的）
  const isMultiKeyMode =
    enableMultiKey && onMultiKeyConfigChange && effectiveKeys.length > 1;

  // 处理多 Key 变更
  const hasMetadata = (metadata?: MultiKeyMetadata[]) =>
    metadata?.some((item) => {
      const query = item.balanceQuery;
      return Boolean(
        query?.name?.trim() ||
          query?.baseUrl?.trim() ||
          query?.accessToken?.trim() ||
          query?.userId?.trim(),
      );
    }) ?? false;

  const handleMultiKeysChange = (
    keys: string[],
    fixedIndex?: number,
    keyMetadata?: MultiKeyMetadata[],
  ) => {
    if (!onMultiKeyConfigChange) return;

    const nonEmptyKeys = keys.filter((k) => k.trim() !== "");
    const nextFixedIndex = fixedIndex ?? multiKeyConfig?.fixedIndex;
    const nextMetadata = keyMetadata ?? multiKeyConfig?.keyMetadata;
    const shouldKeepMetadata =
      nonEmptyKeys.length === 1 && hasMetadata(nextMetadata);

    if (keys.length <= 1) {
      // 退化为单 Key 模式
      onChange(nonEmptyKeys[0] || "");
      onMultiKeyConfigChange(
        shouldKeepMetadata
          ? {
              keys,
              strategy: multiKeyConfig?.strategy || "round_robin",
              fixedIndex: nextFixedIndex,
              keyMetadata: nextMetadata,
            }
          : undefined,
      );
    } else {
      // 多 Key 模式：第一个非空 Key 同步到 settings_config
      onChange(nonEmptyKeys[0] || "");
      onMultiKeyConfigChange({
        keys,
        strategy: multiKeyConfig?.strategy || "round_robin",
        fixedIndex: nextFixedIndex,
        keyMetadata: hasMetadata(nextMetadata) ? nextMetadata : undefined,
      });
    }
  };

  // 处理策略变更
  const handleStrategyChange = (strategy: KeyRotationStrategy) => {
    if (!onMultiKeyConfigChange || !multiKeyConfig) return;
    onMultiKeyConfigChange({
      ...multiKeyConfig,
      strategy,
      // 切换到固定模式时，默认选中第一个 key
      fixedIndex:
        strategy === "fixed"
          ? (multiKeyConfig.fixedIndex ?? 0)
          : multiKeyConfig.fixedIndex,
    });
  };

  // 处理固定索引变更
  const handleFixedIndexChange = (index: number) => {
    if (!onMultiKeyConfigChange || !multiKeyConfig) return;
    onMultiKeyConfigChange({
      ...multiKeyConfig,
      fixedIndex: index,
    });
  };

  return (
    <div className="space-y-1">
      {enableMultiKey && onMultiKeyConfigChange ? (
        // 多 Key 模式
        <div className="space-y-3">
          <MultiKeyInput
            keys={effectiveKeys}
            onChange={handleMultiKeysChange}
            disabled={isDisabled}
            label={label || "API Key"}
            placeholder={
              category === "official"
                ? finalPlaceholder.official
                : finalPlaceholder.thirdParty
            }
            strategy={multiKeyConfig?.strategy}
            fixedIndex={multiKeyConfig?.fixedIndex ?? 0}
            onFixedIndexChange={handleFixedIndexChange}
            keyMetadata={multiKeyConfig?.keyMetadata}
            showBalanceMetadata={showBalanceMetadata}
          />

          {/* 仅在多 Key 时显示策略选择 */}
          {isMultiKeyMode && (
            <KeyStrategySelect
              value={multiKeyConfig?.strategy || "round_robin"}
              onChange={handleStrategyChange}
              disabled={isDisabled}
            />
          )}
        </div>
      ) : (
        // 单 Key 模式（向下兼容）
        <ApiKeyInput
          id={id}
          label={label}
          value={value}
          onChange={onChange}
          placeholder={
            category === "official"
              ? finalPlaceholder.official
              : finalPlaceholder.thirdParty
          }
          disabled={isDisabled}
        />
      )}

      {/* API Key 获取链接 */}
      {shouldShowLink && websiteUrl && (
        <div className="space-y-2 -mt-1 pl-1">
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 dark:text-blue-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            {t("providerForm.getApiKey", {
              defaultValue: "获取 API Key",
            })}
          </a>

          {/* 促销信息（与 isPartner 解耦：仅凭 partnerPromotionKey 即可展示，星标仍由 isPartner 控制） */}
          {partnerPromotionKey && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-2.5 border border-blue-200 dark:border-blue-800">
              <p className="text-xs leading-relaxed text-blue-700 dark:text-blue-300">
                💡{" "}
                {t(`providerForm.partnerPromotion.${partnerPromotionKey}`, {
                  defaultValue: "",
                })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
