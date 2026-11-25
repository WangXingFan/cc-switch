import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CodexCatalogModel } from "@/types";
import {
  extractCodexAgentsString, extractCodexAgentsMaxThreads, extractCodexMultiAgentV2Total,
  setCodexAgentsString, setCodexAgentsMaxThreads,
} from "@/utils/providerConfigUtils";

interface Props {
  config: string;
  onConfigChange: (value: string) => void;
  models: CodexCatalogModel[];
  official: boolean;
  autoReviewModel: string;
  onAutoReviewModelChange: (value: string) => void;
}

export function CodexAdvancedModels({ config, onConfigChange, models, official, autoReviewModel, onAutoReviewModelChange }: Props) {
  const { t } = useTranslation();
  const subagent = extractCodexAgentsString(config, "default_subagent_model") ?? "";
  const effort = extractCodexAgentsString(config, "default_subagent_reasoning_effort") ?? "";
  const maxThreads = extractCodexAgentsMaxThreads(config);
  const v2Total = extractCodexMultiAgentV2Total(config);
  const options = [...new Set(models.map(model => model.model.trim()).filter(Boolean))];
  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      {!official && <>
        <div className="space-y-1.5">
          <Label htmlFor="codexSubagentModel">{t("codexConfig.subagentModelLabel", { defaultValue: "Subagent model" })}</Label>
          <Input id="codexSubagentModel" list="codex-subagent-models" value={subagent}
            onChange={event => onConfigChange(setCodexAgentsString(config, "default_subagent_model", event.target.value.replace(/[\u0000-\u001f\u007f]/g, "")))} />
          <datalist id="codex-subagent-models">{options.map(model => <option key={model} value={model} />)}</datalist>
          <p className="text-xs text-muted-foreground">{t("codexConfig.subagentModelHint")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="codexSubagentEffort">{t("codexConfig.subagentEffortLabel", { defaultValue: "Subagent reasoning effort" })}</Label>
          <Select value={effort || "default"} onValueChange={value => onConfigChange(setCodexAgentsString(config, "default_subagent_reasoning_effort", value === "default" ? "" : value))}>
            <SelectTrigger id="codexSubagentEffort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">{t("common.default", { defaultValue: "Default" })}</SelectItem>
              {["none", "minimal", "low", "medium", "high", "xhigh", "max"].map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </>}
      <div className="space-y-1.5">
        <Label htmlFor="codexAgentMaxThreads">{t("codexConfig.agentMaxThreadsLabel", { defaultValue: "Maximum concurrent subagents" })}</Label>
        <Input id="codexAgentMaxThreads" inputMode="numeric" value={maxThreads ?? ""}
          onChange={event => {
            const value = event.target.value;
            if (/^\d*$/.test(value)) onConfigChange(setCodexAgentsMaxThreads(config, value ? Number(value) : undefined));
          }}
          placeholder={t("codexConfig.agentMaxThreadsPlaceholder", { defaultValue: "Codex default" })} />
        <p className="text-xs text-muted-foreground">{t("codexConfig.agentMaxThreadsHint")}</p>
        {v2Total !== undefined && <p className="text-xs text-muted-foreground">{t("codexConfig.agentMaxThreadsV2Override", { total: v2Total })}</p>}
      </div>
      {!official && options.length > 0 && <div className="space-y-1.5">
        <Label htmlFor="codexAutoReviewModel">{t("codexConfig.autoReviewModelLabel", { defaultValue: "Auto Review model" })}</Label>
        <Select value={options.includes(autoReviewModel) ? autoReviewModel : "default"} onValueChange={value => onAutoReviewModelChange(value === "default" ? "" : value)}>
          <SelectTrigger id="codexAutoReviewModel"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{t("common.default", { defaultValue: "Default" })}</SelectItem>
            {options.map(model => <SelectItem key={model} value={model}>{model}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t("codexConfig.autoReviewModelHint")}</p>
      </div>}
    </div>
  );
}
