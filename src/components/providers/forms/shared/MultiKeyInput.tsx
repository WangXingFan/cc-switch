import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  GripVertical,
  CircleDot,
  Circle,
  Wallet,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { KeyRotationStrategy, MultiKeyMetadata } from "@/types";

interface MultiKeyInputProps {
  keys: string[];
  onChange: (
    keys: string[],
    fixedIndex?: number,
    keyMetadata?: MultiKeyMetadata[],
  ) => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  className?: string;
  /** Current rotation strategy - controls fixed mode UI */
  strategy?: KeyRotationStrategy;
  /** Index of the fixed key (only used in fixed mode) */
  fixedIndex?: number;
  /** Callback when fixed index changes */
  onFixedIndexChange?: (index: number) => void;
  keyMetadata?: MultiKeyMetadata[];
  showBalanceMetadata?: boolean;
}

/**
 * 多 API Key 输入组件
 *
 * 支持添加、删除、编辑多个 API Key
 * 固定模式下显示 radio 选择按钮，让用户指定使用哪个 Key
 */
export function MultiKeyInput({
  keys,
  onChange,
  disabled = false,
  placeholder,
  label,
  className,
  strategy,
  fixedIndex = 0,
  onFixedIndexChange,
  keyMetadata,
  showBalanceMetadata = false,
}: MultiKeyInputProps) {
  const { t } = useTranslation();
  const [hiddenKeys, setHiddenKeys] = useState<Set<number>>(new Set());
  const [visibleAccessTokens, setVisibleAccessTokens] = useState<Set<number>>(
    new Set(),
  );
  const [expandedBalanceRows, setExpandedBalanceRows] = useState<Set<number>>(
    new Set(),
  );

  // 确保至少有一个空字符串
  const effectiveKeys = keys.length > 0 ? keys : [""];
  const isFixedMode = strategy === "fixed";

  const toggleVisibility = useCallback((index: number) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleKeyChange = useCallback(
    (index: number, value: string) => {
      const newKeys = [...effectiveKeys];
      newKeys[index] = value;
      onChange(newKeys, undefined, keyMetadata);
    },
    [effectiveKeys, onChange, keyMetadata],
  );

  const handleAddKey = useCallback(() => {
    onChange([...effectiveKeys, ""], undefined, [
      ...(keyMetadata || []),
      { balanceQuery: undefined },
    ]);
  }, [effectiveKeys, keyMetadata, onChange]);

  const handleBalanceMetadataChange = useCallback(
    (
      index: number,
      patch: Partial<NonNullable<MultiKeyMetadata["balanceQuery"]>>,
    ) => {
      const nextMetadata = [...(keyMetadata || [])];
      while (nextMetadata.length < effectiveKeys.length) {
        nextMetadata.push({});
      }
      const current = nextMetadata[index]?.balanceQuery || {
        accessToken: "",
        userId: "",
      };
      nextMetadata[index] = {
        ...nextMetadata[index],
        balanceQuery: {
          ...current,
          ...patch,
        },
      };
      onChange(effectiveKeys, undefined, nextMetadata);
    },
    [effectiveKeys, keyMetadata, onChange],
  );

  const toggleAccessTokenVisibility = useCallback((index: number) => {
    setVisibleAccessTokens((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const toggleBalanceRow = useCallback((index: number) => {
    setExpandedBalanceRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleRemoveKey = useCallback(
    (index: number) => {
      if (effectiveKeys.length <= 1) return;
      const newKeys = effectiveKeys.filter((_, i) => i !== index);
      let nextFixedIndex: number | undefined;
      if (isFixedMode) {
        if (fixedIndex === index) {
          nextFixedIndex = 0;
        } else if (fixedIndex > index) {
          nextFixedIndex = fixedIndex - 1;
        } else {
          nextFixedIndex = fixedIndex;
        }
      }

      const nextMetadata = keyMetadata?.filter((_, i) => i !== index);
      onChange(newKeys, nextFixedIndex, nextMetadata);
      // 调整隐藏状态索引
      setHiddenKeys((prev) => {
        const next = new Set<number>();
        prev.forEach((i) => {
          if (i < index) next.add(i);
          else if (i > index) next.add(i - 1);
        });
        return next;
      });
      setVisibleAccessTokens((prev) => {
        const next = new Set<number>();
        prev.forEach((i) => {
          if (i < index) next.add(i);
          else if (i > index) next.add(i - 1);
        });
        return next;
      });
      setExpandedBalanceRows((prev) => {
        const next = new Set<number>();
        prev.forEach((i) => {
          if (i < index) next.add(i);
          else if (i > index) next.add(i - 1);
        });
        return next;
      });
    },
    [effectiveKeys, onChange, isFixedMode, fixedIndex, keyMetadata],
  );

  const showMultiKeyControls = effectiveKeys.length > 1 || disabled === false;
  const hasBalanceConfig = (
    balanceQuery: MultiKeyMetadata["balanceQuery"] | undefined,
  ) =>
    Boolean(
      balanceQuery?.name?.trim() ||
        balanceQuery?.baseUrl?.trim() ||
        balanceQuery?.accessToken?.trim() ||
        balanceQuery?.userId?.trim(),
    );

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          <div className="flex items-center gap-2">
            {isFixedMode && effectiveKeys.length > 1 && (
              <span className="text-xs text-blue-500">
                {t("provider.multiKey.fixedSelectHint")}
              </span>
            )}
            {effectiveKeys.length > 1 && (
              <span className="text-xs text-muted-foreground">
                {t("provider.multiKey.count", { count: effectiveKeys.length })}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {effectiveKeys.map((key, index) => {
          const balanceQuery = keyMetadata?.[index]?.balanceQuery;
          const isBalanceExpanded = expandedBalanceRows.has(index);
          const isBalanceConfigured = hasBalanceConfig(balanceQuery);
          return (
            <div key={index} className="space-y-2">
              <div className="flex items-center gap-2">
                {/* 固定模式：radio 选择按钮 */}
                {isFixedMode && effectiveKeys.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "flex-shrink-0 h-8 w-8",
                      fixedIndex === index
                        ? "text-blue-500"
                        : "text-muted-foreground hover:text-blue-400",
                    )}
                    onClick={() => onFixedIndexChange?.(index)}
                    disabled={disabled}
                    title={
                      fixedIndex === index
                        ? t("provider.multiKey.fixedActive")
                        : t("provider.multiKey.fixedSelectHint")
                    }
                  >
                    {fixedIndex === index ? (
                      <CircleDot className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </Button>
                )}

                {/* 非固定模式：拖拽手柄 */}
                {!isFixedMode && effectiveKeys.length > 1 && (
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-grab" />
                )}

                <div className="relative flex-1">
                  <Input
                    type={hiddenKeys.has(index) ? "password" : "text"}
                    value={key}
                    onChange={(e) => handleKeyChange(index, e.target.value)}
                    placeholder={
                      placeholder ||
                      (effectiveKeys.length > 1
                        ? t("provider.multiKey.placeholder", {
                            index: index + 1,
                          })
                        : t("provider.apiKeyPlaceholder"))
                    }
                    disabled={disabled}
                    className={cn(
                      "pr-10",
                      isFixedMode &&
                        fixedIndex === index &&
                        effectiveKeys.length > 1 &&
                        "border-blue-500/50 ring-1 ring-blue-500/20",
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full w-10"
                    onClick={() => toggleVisibility(index)}
                    tabIndex={-1}
                  >
                    {hiddenKeys.has(index) ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {effectiveKeys.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveKey(index)}
                    disabled={disabled || effectiveKeys.length <= 1}
                    className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={t("provider.multiKey.removeKey", {
                      index: index + 1,
                      defaultValue: "Remove API Key {{index}}",
                    })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {showBalanceMetadata && !disabled && (
                <div className="ml-6 rounded-lg border border-border-default bg-muted/20 p-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 text-left"
                    onClick={() => toggleBalanceRow(index)}
                    aria-expanded={isBalanceExpanded}
                    aria-label={t(
                      isBalanceExpanded
                        ? "provider.multiKey.balanceCollapse"
                        : "provider.multiKey.balanceExpand",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Wallet className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{t("provider.multiKey.balanceTitle")}</span>
                      <span
                        className={cn(
                          "rounded-md border px-1.5 py-0.5 text-[11px] font-normal",
                          isBalanceConfigured
                            ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                            : "border-border-default bg-background/60 text-muted-foreground",
                        )}
                      >
                        {t(
                          isBalanceConfigured
                            ? "provider.multiKey.balanceConfigured"
                            : "provider.multiKey.balanceNotConfigured",
                        )}
                      </span>
                    </span>
                    {isBalanceExpanded ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    )}
                  </button>

                  {isBalanceExpanded && (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <Input
                        value={balanceQuery?.name || ""}
                        onChange={(e) =>
                          handleBalanceMetadataChange(index, {
                            name: e.target.value,
                          })
                        }
                        placeholder={t("provider.multiKey.balanceName")}
                        className="h-8"
                      />
                      <Input
                        value={balanceQuery?.baseUrl || ""}
                        onChange={(e) =>
                          handleBalanceMetadataChange(index, {
                            baseUrl: e.target.value,
                          })
                        }
                        placeholder={t("provider.multiKey.balanceBaseUrl")}
                        className="h-8"
                      />
                      <div className="relative">
                        <Input
                          type={
                            visibleAccessTokens.has(index)
                              ? "text"
                              : "password"
                          }
                          value={balanceQuery?.accessToken || ""}
                          onChange={(e) =>
                            handleBalanceMetadataChange(index, {
                              accessToken: e.target.value,
                            })
                          }
                          placeholder={t(
                            "provider.multiKey.balanceAccessToken",
                          )}
                          className="h-8 pr-9"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full w-9"
                          onClick={() => toggleAccessTokenVisibility(index)}
                          tabIndex={-1}
                        >
                          {visibleAccessTokens.has(index) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <Input
                        value={balanceQuery?.userId || ""}
                        onChange={(e) =>
                          handleBalanceMetadataChange(index, {
                            userId: e.target.value,
                          })
                        }
                        placeholder={t("provider.multiKey.balanceUserId")}
                        className="h-8"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showMultiKeyControls && !disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddKey}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-1" />
          {t("provider.multiKey.addKey")}
        </Button>
      )}

      {effectiveKeys.length > 1 && (
        <p className="text-xs text-muted-foreground">
          {t("provider.multiKey.hint")}
        </p>
      )}
    </div>
  );
}

export default MultiKeyInput;
