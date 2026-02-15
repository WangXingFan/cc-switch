// 供应商配置处理工具函数

import type { TemplateValueConfig } from "../config/claudeProviderPresets";
import { normalizeQuotes } from "@/utils/textNormalization";

// 验证JSON配置格式
export const validateJsonConfig = (
  value: string,
  fieldName: string = "配置",
): string => {
  if (!value.trim()) {
    return "";
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return `${fieldName}必须是 JSON 对象`;
    }
    return "";
  } catch {
    return `${fieldName}JSON格式错误，请检查语法`;
  }
};

// 读取配置中的 API Key（支持 Claude, Codex, Gemini）
export const getApiKeyFromConfig = (
  jsonString: string,
  appType?: string,
): string => {
  try {
    const config = JSON.parse(jsonString);

    // 优先检查顶层 apiKey 字段（用于 Bedrock API Key 等预设）
    if (
      typeof config?.apiKey === "string" &&
      config.apiKey &&
      !config.apiKey.includes("${")
    ) {
      return config.apiKey;
    }

    const env = config?.env;

    if (!env) return "";

    // Gemini API Key
    if (appType === "gemini") {
      const geminiKey = env.GEMINI_API_KEY;
      return typeof geminiKey === "string" ? geminiKey : "";
    }

    // Codex API Key
    if (appType === "codex") {
      const codexKey = env.CODEX_API_KEY;
      return typeof codexKey === "string" ? codexKey : "";
    }

    // Claude API Key (优先 ANTHROPIC_AUTH_TOKEN，其次 ANTHROPIC_API_KEY)
    const token = env.ANTHROPIC_AUTH_TOKEN;
    const apiKey = env.ANTHROPIC_API_KEY;
    const value =
      typeof token === "string"
        ? token
        : typeof apiKey === "string"
          ? apiKey
          : "";
    return value;
  } catch (err) {
    return "";
  }
};

// 模板变量替换
export const applyTemplateValues = (
  config: any,
  templateValues: Record<string, TemplateValueConfig> | undefined,
): any => {
  const resolvedValues = Object.fromEntries(
    Object.entries(templateValues ?? {}).map(([key, value]) => {
      const resolvedValue =
        value.editorValue !== undefined
          ? value.editorValue
          : (value.defaultValue ?? "");
      return [key, resolvedValue];
    }),
  );

  const replaceInString = (str: string): string => {
    return Object.entries(resolvedValues).reduce((acc, [key, value]) => {
      const placeholder = `\${${key}}`;
      if (!acc.includes(placeholder)) {
        return acc;
      }
      return acc.split(placeholder).join(value ?? "");
    }, str);
  };

  const traverse = (obj: any): any => {
    if (typeof obj === "string") {
      return replaceInString(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map(traverse);
    }
    if (obj && typeof obj === "object") {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = traverse(value);
      }
      return result;
    }
    return obj;
  };

  return traverse(config);
};

// 判断配置中是否存在 API Key 字段
export const hasApiKeyField = (
  jsonString: string,
  appType?: string,
): boolean => {
  try {
    const config = JSON.parse(jsonString);

    // 检查顶层 apiKey 字段（用于 Bedrock API Key 等预设）
    if (Object.prototype.hasOwnProperty.call(config, "apiKey")) {
      return true;
    }

    const env = config?.env ?? {};

    if (appType === "gemini") {
      return Object.prototype.hasOwnProperty.call(env, "GEMINI_API_KEY");
    }

    if (appType === "codex") {
      return Object.prototype.hasOwnProperty.call(env, "CODEX_API_KEY");
    }

    return (
      Object.prototype.hasOwnProperty.call(env, "ANTHROPIC_AUTH_TOKEN") ||
      Object.prototype.hasOwnProperty.call(env, "ANTHROPIC_API_KEY")
    );
  } catch (err) {
    return false;
  }
};

// 写入/更新配置中的 API Key，默认不新增缺失字段
export const setApiKeyInConfig = (
  jsonString: string,
  apiKey: string,
  options: {
    createIfMissing?: boolean;
    appType?: string;
    apiKeyField?: string;
  } = {},
): string => {
  const { createIfMissing = false, appType, apiKeyField } = options;
  try {
    const config = JSON.parse(jsonString);

    // 优先检查顶层 apiKey 字段（用于 Bedrock API Key 等预设）
    if (Object.prototype.hasOwnProperty.call(config, "apiKey")) {
      config.apiKey = apiKey;
      return JSON.stringify(config, null, 2);
    }

    if (!config.env) {
      if (!createIfMissing) return jsonString;
      config.env = {};
    }
    const env = config.env as Record<string, any>;

    // Gemini API Key
    if (appType === "gemini") {
      if ("GEMINI_API_KEY" in env) {
        env.GEMINI_API_KEY = apiKey;
      } else if (createIfMissing) {
        env.GEMINI_API_KEY = apiKey;
      } else {
        return jsonString;
      }
      return JSON.stringify(config, null, 2);
    }

    // Codex API Key
    if (appType === "codex") {
      if ("CODEX_API_KEY" in env) {
        env.CODEX_API_KEY = apiKey;
      } else if (createIfMissing) {
        env.CODEX_API_KEY = apiKey;
      } else {
        return jsonString;
      }
      return JSON.stringify(config, null, 2);
    }

    // Claude API Key (优先写入已存在的字段；若两者均不存在且允许创建，则使用 apiKeyField 指定的字段名)
    if ("ANTHROPIC_AUTH_TOKEN" in env) {
      env.ANTHROPIC_AUTH_TOKEN = apiKey;
    } else if ("ANTHROPIC_API_KEY" in env) {
      env.ANTHROPIC_API_KEY = apiKey;
    } else if (createIfMissing) {
      env[apiKeyField ?? "ANTHROPIC_AUTH_TOKEN"] = apiKey;
    } else {
      return jsonString;
    }
    return JSON.stringify(config, null, 2);
  } catch (err) {
    return jsonString;
  }
};

// ========== Codex base_url utils ==========

// 从 Codex 的 TOML 配置文本中提取 base_url（支持单/双引号）
export const extractCodexBaseUrl = (
  configText: string | undefined | null,
): string | undefined => {
  try {
    const raw = typeof configText === "string" ? configText : "";
    // 归一化中文/全角引号，避免正则提取失败
    const text = normalizeQuotes(raw);
    if (!text) return undefined;
    const m = text.match(/base_url\s*=\s*(['"])([^'\"]+)\1/);
    return m && m[2] ? m[2] : undefined;
  } catch {
    return undefined;
  }
};

// 从 Provider 对象中提取 Codex base_url（当 settingsConfig.config 为 TOML 字符串时）
export const getCodexBaseUrl = (
  provider: { settingsConfig?: Record<string, any> } | undefined | null,
): string | undefined => {
  try {
    const text =
      typeof provider?.settingsConfig?.config === "string"
        ? (provider as any).settingsConfig.config
        : "";
    return extractCodexBaseUrl(text);
  } catch {
    return undefined;
  }
};

// 在 Codex 的 TOML 配置文本中写入或更新 base_url 字段
export const setCodexBaseUrl = (
  configText: string,
  baseUrl: string,
): string => {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return configText;
  }
  // 归一化原文本中的引号（既能匹配，也能输出稳定格式）
  const normalizedText = normalizeQuotes(configText);

  const normalizedUrl = trimmed.replace(/\s+/g, "");
  const replacementLine = `base_url = "${normalizedUrl}"`;
  const pattern = /base_url\s*=\s*(["'])([^"']+)\1/;

  if (pattern.test(normalizedText)) {
    return normalizedText.replace(pattern, replacementLine);
  }

  const prefix =
    normalizedText && !normalizedText.endsWith("\n")
      ? `${normalizedText}\n`
      : normalizedText;
  return `${prefix}${replacementLine}\n`;
};

// ========== Codex model name utils ==========

// 从 Codex 的 TOML 配置文本中提取 model 字段（支持单/双引号）
export const extractCodexModelName = (
  configText: string | undefined | null,
): string | undefined => {
  try {
    const raw = typeof configText === "string" ? configText : "";
    // 归一化中文/全角引号，避免正则提取失败
    const text = normalizeQuotes(raw);
    if (!text) return undefined;

    // 匹配 model = "xxx" 或 model = 'xxx'
    const m = text.match(/^model\s*=\s*(['"])([^'"]+)\1/m);
    return m && m[2] ? m[2] : undefined;
  } catch {
    return undefined;
  }
};

// 在 Codex 的 TOML 配置文本中写入或更新 model 字段
export const setCodexModelName = (
  configText: string,
  modelName: string,
): string => {
  const trimmed = modelName.trim();
  if (!trimmed) {
    return configText;
  }

  // 归一化原文本中的引号（既能匹配，也能输出稳定格式）
  const normalizedText = normalizeQuotes(configText);

  const replacementLine = `model = "${trimmed}"`;
  const pattern = /^model\s*=\s*["']([^"']+)["']/m;

  if (pattern.test(normalizedText)) {
    return normalizedText.replace(pattern, replacementLine);
  }

  // 如果不存在 model 字段，尝试在 model_provider 之后插入
  // 如果 model_provider 也不存在，则插入到开头
  const providerPattern = /^model_provider\s*=\s*["'][^"']+["']/m;
  const match = normalizedText.match(providerPattern);

  if (match && match.index !== undefined) {
    // 在 model_provider 行之后插入
    const endOfLine = normalizedText.indexOf("\n", match.index);
    if (endOfLine !== -1) {
      return (
        normalizedText.slice(0, endOfLine + 1) +
        replacementLine +
        "\n" +
        normalizedText.slice(endOfLine + 1)
      );
    }
  }

  // 在文件开头插入
  const lines = normalizedText.split("\n");
  return `${replacementLine}\n${lines.join("\n")}`;
};

// ============================================================================
// 多 Key 配置工具函数
// ============================================================================

import type { MultiKeyConfig, KeyRotationStrategy, ProviderMeta } from "@/types";

/**
 * 从 ProviderMeta 中获取多 Key 配置
 */
export const getMultiKeyConfig = (
  meta: ProviderMeta | undefined
): MultiKeyConfig | undefined => {
  return meta?.multiKeyConfig;
};

/**
 * 创建或更新 ProviderMeta 中的多 Key 配置
 */
export const setMultiKeyConfig = (
  meta: ProviderMeta | undefined,
  config: MultiKeyConfig | undefined
): ProviderMeta => {
  const baseMeta = meta || {};

  if (!config || config.keys.length === 0) {
    // 移除多 Key 配置
    const { multiKeyConfig: _, ...rest } = baseMeta;
    return rest;
  }

  // 如果只有一个 Key，也移除多 Key 配置（使用 settings_config 中的单 Key）
  if (config.keys.length === 1) {
    const { multiKeyConfig: _, ...rest } = baseMeta;
    return rest;
  }

  return {
    ...baseMeta,
    multiKeyConfig: config,
  };
};

/**
 * 从多 Key 列表和 settings_config 中同步获取有效的 Key 列表
 *
 * 规则：
 * - 如果有多 Key 配置，返回多 Key 列表
 * - 否则返回 settings_config 中的单 Key 作为数组
 */
export const getEffectiveKeys = (
  multiKeyConfig: MultiKeyConfig | undefined,
  singleKey: string | undefined
): string[] => {
  if (multiKeyConfig && multiKeyConfig.keys.length > 0) {
    return multiKeyConfig.keys;
  }
  return singleKey ? [singleKey] : [];
};

/**
 * 将 Key 列表同步回 settings_config 和 meta
 *
 * 规则：
 * - 第一个 Key 写入 settings_config（保持与 CLI 工具兼容）
 * - 完整列表写入 meta.multiKeyConfig（仅当 > 1 个 Key 时）
 */
export const syncKeysToConfig = (
  keys: string[],
  strategy: KeyRotationStrategy = "round_robin"
): { firstKey: string; multiKeyConfig: MultiKeyConfig | undefined } => {
  const validKeys = keys.filter((k) => k.trim() !== "");

  if (validKeys.length === 0) {
    return { firstKey: "", multiKeyConfig: undefined };
  }

  if (validKeys.length === 1) {
    return { firstKey: validKeys[0], multiKeyConfig: undefined };
  }

  return {
    firstKey: validKeys[0],
    multiKeyConfig: {
      keys: validKeys,
      strategy,
    },
  };
};

