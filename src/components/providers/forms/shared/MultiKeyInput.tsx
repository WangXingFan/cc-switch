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
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TEMPLATE_TYPES } from "@/config/constants";
import { usageApi, type AppId } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  KeyRotationStrategy,
  MultiKeyMetadata,
  NewApiAccountConfig,
  UsageData,
} from "@/types";

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
  appId?: AppId;
  providerId?: string;
  balanceQueryBaseUrl?: string;
}

type QueryableBalanceEntry = {
  index: number;
  account: NewApiAccountConfig;
};

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
  appId,
  providerId,
  balanceQueryBaseUrl,
}: MultiKeyInputProps) {
  const { t } = useTranslation();
  const [hiddenKeys, setHiddenKeys] = useState<Set<number>>(new Set());
  const [visibleAccessTokens, setVisibleAccessTokens] = useState<Set<number>>(
    new Set(),
  );
  const [activeBalanceIndex, setActiveBalanceIndex] = useState<number | null>(
    null,
  );
  const [balanceResults, setBalanceResults] = useState<
    Record<number, UsageData | undefined>
  >({});
  const [isQueryingBalances, setIsQueryingBalances] = useState(false);

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
      setBalanceResults((prev) => {
        if (!(index in prev)) return prev;
        const next = { ...prev };
        delete next[index];
        return next;
      });
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
      setActiveBalanceIndex((prev) => {
        if (prev === null) return null;
        if (prev === index) return null;
        if (prev > index) return prev - 1;
        return prev;
      });
      setBalanceResults((prev) => {
        const next: Record<number, UsageData | undefined> = {};
        Object.entries(prev).forEach(([rawIndex, data]) => {
          const currentIndex = Number(rawIndex);
          if (currentIndex < index) next[currentIndex] = data;
          else if (currentIndex > index) next[currentIndex - 1] = data;
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
  const queryableBalanceEntries = effectiveKeys.reduce<QueryableBalanceEntry[]>(
    (entries, _, index) => {
      const query = keyMetadata?.[index]?.balanceQuery;
      const accessToken = query?.accessToken?.trim() || "";
      const userId = query?.userId?.trim() || "";
      const baseUrl =
        query?.baseUrl?.trim() || balanceQueryBaseUrl?.trim() || "";
      if (!accessToken || !userId || !baseUrl) return entries;

      entries.push({
        index,
        account: {
          id: query?.id || `key-${index}`,
          name: query?.name?.trim() || `Key ${index + 1}`,
          baseUrl,
          accessToken,
          userId,
        },
      });
      return entries;
    },
    [],
  );
  const canQueryBalances = Boolean(appId) && queryableBalanceEntries.length > 0;
  const hasActiveBalanceDialog =
    activeBalanceIndex !== null &&
    activeBalanceIndex >= 0 &&
    activeBalanceIndex < effectiveKeys.length;
  const activeBalanceQuery =
    activeBalanceIndex !== null &&
    activeBalanceIndex >= 0 &&
    activeBalanceIndex < effectiveKeys.length
      ? keyMetadata?.[activeBalanceIndex]?.balanceQuery
      : undefined;
  const activeBalanceKeyNumber = (activeBalanceIndex ?? 0) + 1;
  const isActiveBalanceConfigured = hasBalanceConfig(activeBalanceQuery);

  const handleQueryAllBalances = useCallback(async () => {
    if (!appId || queryableBalanceEntries.length === 0) {
      toast.info(t("provider.multiKey.balanceQueryAllNoConfig"));
      return;
    }

    setIsQueryingBalances(true);
    try {
      const result = await usageApi.testScript(
        providerId || "draft-provider",
        appId,
        "",
        10,
        undefined,
        balanceQueryBaseUrl?.trim() || undefined,
        undefined,
        undefined,
        TEMPLATE_TYPES.NEW_API,
        queryableBalanceEntries.map((entry) => entry.account),
      );

      if (!result.success) {
        toast.error(result.error || t("provider.multiKey.balanceQueryFailed"));
        return;
      }

      const nextResults: Record<number, UsageData | undefined> = {};
      result.data?.forEach((data, resultIndex) => {
        const entry = queryableBalanceEntries[resultIndex];
        if (entry) {
          nextResults[entry.index] = data;
        }
      });
      setBalanceResults(nextResults);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("provider.multiKey.balanceQueryFailed"),
      );
    } finally {
      setIsQueryingBalances(false);
    }
  }, [appId, balanceQueryBaseUrl, providerId, queryableBalanceEntries, t]);

  const formatBalanceValue = (data: UsageData | undefined) => {
    if (!data || data.isValid === false || data.remaining === undefined) {
      return "--";
    }

    return Number.isInteger(data.remaining)
      ? data.remaining.toFixed(0)
      : data.remaining.toFixed(2);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          <div className="flex items-center gap-2">
            {showBalanceMetadata && !disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleQueryAllBalances}
                disabled={isQueryingBalances || !canQueryBalances}
                className="h-6 gap-1 px-2 text-xs"
                title={
                  canQueryBalances
                    ? t("provider.multiKey.balanceQueryAll")
                    : t("provider.multiKey.balanceQueryAllNoConfig")
                }
              >
                {isQueryingBalances ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {t("provider.multiKey.balanceQueryAll")}
              </Button>
            )}
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
          const isBalanceConfigured = hasBalanceConfig(balanceQuery);
          const balanceResult = balanceResults[index];
          return (
            <div key={index} className="flex items-center gap-2">
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

              {showBalanceMetadata && !disabled && (
                <>
                  <span
                    className={cn(
                      "flex h-9 min-w-12 flex-shrink-0 items-center justify-end rounded-md px-1.5 text-xs tabular-nums",
                      balanceResult?.isValid === false
                        ? "text-destructive"
                        : balanceResult?.remaining !== undefined
                          ? "font-semibold text-green-600 dark:text-green-400"
                          : "text-muted-foreground",
                    )}
                    title={
                      balanceResult?.isValid === false
                        ? balanceResult.invalidMessage ||
                          t("provider.multiKey.balanceInvalid")
                        : balanceResult?.remaining !== undefined
                          ? String(balanceResult.remaining)
                          : isBalanceConfigured
                            ? t("provider.multiKey.balanceNotQueried")
                            : t("provider.multiKey.balanceNotConfigured")
                    }
                  >
                    {isQueryingBalances && isBalanceConfigured ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      formatBalanceValue(balanceResult)
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setActiveBalanceIndex(index)}
                    className={cn(
                      "hidden h-9 w-9 flex-shrink-0 border sm:inline-flex",
                      isBalanceConfigured
                        ? "border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/15 dark:text-green-400"
                        : "border-border-default text-muted-foreground hover:text-foreground",
                    )}
                    title={t("provider.multiKey.balanceOpen", {
                      index: index + 1,
                    })}
                    aria-label={t("provider.multiKey.balanceOpen", {
                      index: index + 1,
                    })}
                  >
                    <Wallet className="h-4 w-4" />
                  </Button>
                </>
              )}

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
          );
        })}
      </div>

      <Dialog
        open={hasActiveBalanceDialog}
        onOpenChange={(open) => {
          if (!open) setActiveBalanceIndex(null);
        }}
      >
        <DialogContent className="max-w-xl" zIndex="top">
          <DialogHeader>
            <DialogTitle>{t("provider.multiKey.balanceTitle")}</DialogTitle>
            <DialogDescription>
              {t("provider.multiKey.balanceDialogDescription", {
                index: activeBalanceKeyNumber,
              })}
            </DialogDescription>
          </DialogHeader>

          {hasActiveBalanceDialog && activeBalanceIndex !== null && (
            <div className="space-y-4 px-6 py-5">
              <div className="flex items-center justify-between rounded-lg border border-border-default bg-muted/20 px-3 py-2">
                <span className="text-sm font-medium">
                  {t("provider.multiKey.placeholder", {
                    index: activeBalanceKeyNumber,
                  })}
                </span>
                <span
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-xs",
                    isActiveBalanceConfigured
                      ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                      : "border-border-default bg-background/60 text-muted-foreground",
                  )}
                >
                  {t(
                    isActiveBalanceConfigured
                      ? "provider.multiKey.balanceConfigured"
                      : "provider.multiKey.balanceNotConfigured",
                  )}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="multi-key-balance-name">
                    {t("provider.multiKey.balanceName")}
                  </Label>
                  <Input
                    id="multi-key-balance-name"
                    value={activeBalanceQuery?.name || ""}
                    onChange={(e) =>
                      handleBalanceMetadataChange(activeBalanceIndex, {
                        name: e.target.value,
                      })
                    }
                    placeholder={t("provider.multiKey.balanceName")}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="multi-key-balance-base-url">
                    {t("provider.multiKey.balanceBaseUrl")}
                  </Label>
                  <Input
                    id="multi-key-balance-base-url"
                    value={activeBalanceQuery?.baseUrl || ""}
                    onChange={(e) =>
                      handleBalanceMetadataChange(activeBalanceIndex, {
                        baseUrl: e.target.value,
                      })
                    }
                    placeholder={t("provider.multiKey.balanceBaseUrl")}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="multi-key-balance-access-token">
                    {t("provider.multiKey.balanceAccessToken")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="multi-key-balance-access-token"
                      type={
                        visibleAccessTokens.has(activeBalanceIndex)
                          ? "text"
                          : "password"
                      }
                      value={activeBalanceQuery?.accessToken || ""}
                      onChange={(e) =>
                        handleBalanceMetadataChange(activeBalanceIndex, {
                          accessToken: e.target.value,
                        })
                      }
                      placeholder={t("provider.multiKey.balanceAccessToken")}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full w-10"
                      onClick={() =>
                        toggleAccessTokenVisibility(activeBalanceIndex)
                      }
                      tabIndex={-1}
                    >
                      {visibleAccessTokens.has(activeBalanceIndex) ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="multi-key-balance-user-id">
                    {t("provider.multiKey.balanceUserId")}
                  </Label>
                  <Input
                    id="multi-key-balance-user-id"
                    value={activeBalanceQuery?.userId || ""}
                    onChange={(e) =>
                      handleBalanceMetadataChange(activeBalanceIndex, {
                        userId: e.target.value,
                      })
                    }
                    placeholder={t("provider.multiKey.balanceUserId")}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("common.close")}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
