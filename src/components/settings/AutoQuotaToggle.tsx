import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/api";
import { useSettingsQuery } from "@/lib/query/queries";
import { toast } from "sonner";
import { extractErrorMessage } from "@/utils/errorUtils";
import { Switch } from "@/components/ui/switch";

/** 官方账号自动额度查询设置，前端与托盘共用。 */
export function AutoQuotaToggle() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: settings } = useSettingsQuery();
  const [saving, setSaving] = useState(false);
  const save = async (autoQuery: boolean) => {
    setSaving(true);
    try {
      const current = await settingsApi.get();
      await settingsApi.save({
        ...current,
        officialQuotaManualOnly: !autoQuery,
      });
    } catch (error) {
      toast.error(t("common.error"), {
        description: extractErrorMessage(error) || String(error),
      });
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaving(false);
    }
  };
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/60 p-6">
      <div className="space-y-1">
        <label htmlFor="official-auto-quota" className="font-medium">{t("authCenter.autoQuota.title", { defaultValue: "自动查询额度" })}</label>
        <p id="official-auto-quota-hint" className="text-sm text-muted-foreground">{t("authCenter.autoQuota.description", { defaultValue: "关闭后，官方账号的额度只在点击刷新时查询。第三方供应商余额查询不受影响。" })}</p>
      </div>
      <Switch id="official-auto-quota" aria-describedby="official-auto-quota-hint" checked={settings?.officialQuotaManualOnly !== true} disabled={!settings || saving} onCheckedChange={(checked) => void save(checked)} />
    </div>
  );
}
