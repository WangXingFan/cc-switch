import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { KeyRotationStrategy } from "@/types";

interface KeyStrategySelectProps {
  value: KeyRotationStrategy;
  onChange: (value: KeyRotationStrategy) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Key 调度策略选择组件
 *
 * 仅在 Key 数量 > 1 时显示
 * 支持轮询 (Round-Robin) 和随机 (Random) 两种策略
 */
export function KeyStrategySelect({
  value,
  onChange,
  disabled = false,
  className,
}: KeyStrategySelectProps) {
  const { t } = useTranslation();

  return (
    <div className={className}>
      <Label className="text-sm font-medium">
        {t("provider.multiKey.strategy")}
      </Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as KeyRotationStrategy)}
        disabled={disabled}
      >
        <SelectTrigger className="mt-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="round_robin">
            <div className="flex flex-col">
              <span>{t("provider.multiKey.roundRobin")}</span>
              <span className="text-xs text-muted-foreground">
                {t("provider.multiKey.roundRobinDesc")}
              </span>
            </div>
          </SelectItem>
          <SelectItem value="random">
            <div className="flex flex-col">
              <span>{t("provider.multiKey.random")}</span>
              <span className="text-xs text-muted-foreground">
                {t("provider.multiKey.randomDesc")}
              </span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export default KeyStrategySelect;
