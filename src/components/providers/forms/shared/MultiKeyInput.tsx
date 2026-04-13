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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { KeyRotationStrategy } from "@/types";

interface MultiKeyInputProps {
  keys: string[];
  onChange: (keys: string[]) => void;
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
}: MultiKeyInputProps) {
  const { t } = useTranslation();
  const [visibleKeys, setVisibleKeys] = useState<Set<number>>(new Set());

  // 确保至少有一个空字符串
  const effectiveKeys = keys.length > 0 ? keys : [""];
  const isFixedMode = strategy === "fixed";

  const toggleVisibility = useCallback((index: number) => {
    setVisibleKeys((prev) => {
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
      onChange(newKeys);
    },
    [effectiveKeys, onChange],
  );

  const handleAddKey = useCallback(() => {
    onChange([...effectiveKeys, ""]);
  }, [effectiveKeys, onChange]);

  const handleRemoveKey = useCallback(
    (index: number) => {
      if (effectiveKeys.length <= 1) return;
      const newKeys = effectiveKeys.filter((_, i) => i !== index);
      onChange(newKeys);
      // 调整可见性索引
      setVisibleKeys((prev) => {
        const next = new Set<number>();
        prev.forEach((i) => {
          if (i < index) next.add(i);
          else if (i > index) next.add(i - 1);
        });
        return next;
      });
      // 固定模式下调整 fixedIndex
      if (isFixedMode && onFixedIndexChange) {
        if (fixedIndex === index) {
          // 删除的正是选中的，回退到 0
          onFixedIndexChange(0);
        } else if (fixedIndex > index) {
          // 删除的在选中之前，索引前移
          onFixedIndexChange(fixedIndex - 1);
        }
      }
    },
    [effectiveKeys, onChange, isFixedMode, fixedIndex, onFixedIndexChange],
  );

  const showMultiKeyControls = effectiveKeys.length > 1 || disabled === false;

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
        {effectiveKeys.map((key, index) => (
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
                type={visibleKeys.has(index) ? "text" : "password"}
                value={key}
                onChange={(e) => handleKeyChange(index, e.target.value)}
                placeholder={
                  placeholder ||
                  (effectiveKeys.length > 1
                    ? t("provider.multiKey.placeholder", { index: index + 1 })
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
                {visibleKeys.has(index) ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
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
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
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
