//! Usage script execution
//!
//! Handles executing and formatting usage query results.

use crate::app_config::AppType;
use crate::error::AppError;
use crate::provider::{NewApiAccountConfig, UsageData, UsageResult, UsageScript};
use crate::settings;
use crate::store::AppState;
use crate::usage_script;
use serde_json::Value;
use std::time::Duration;
use url::Url;

const TEMPLATE_TYPE_NEWAPI: &str = "newapi";
const NEWAPI_QUOTA_PER_USD: f64 = 500_000.0;

/// Execute usage script and format result (private helper method)
pub(crate) async fn execute_and_format_usage_result(
    script_code: &str,
    api_key: &str,
    base_url: &str,
    timeout: u64,
    access_token: Option<&str>,
    user_id: Option<&str>,
    template_type: Option<&str>,
) -> Result<UsageResult, AppError> {
    match usage_script::execute_usage_script(
        script_code,
        api_key,
        base_url,
        timeout,
        access_token,
        user_id,
        template_type,
    )
    .await
    {
        Ok(data) => {
            let usage_list: Vec<UsageData> = if data.is_array() {
                serde_json::from_value(data).map_err(|e| {
                    AppError::localized(
                        "usage_script.data_format_error",
                        format!("数据格式错误: {e}"),
                        format!("Data format error: {e}"),
                    )
                })?
            } else {
                let single: UsageData = serde_json::from_value(data).map_err(|e| {
                    AppError::localized(
                        "usage_script.data_format_error",
                        format!("数据格式错误: {e}"),
                        format!("Data format error: {e}"),
                    )
                })?;
                vec![single]
            };

            Ok(UsageResult {
                success: true,
                data: Some(usage_list),
                error: None,
            })
        }
        Err(err) => {
            // Propagate transient transport failures so the caller can retry while
            // preserving the last successful usage result in the UI cache.
            if let AppError::Localized { key, .. } = &err {
                if matches!(
                    *key,
                    "usage_script.request_failed" | "usage_script.read_response_failed"
                ) {
                    return Err(err);
                }
            }

            let lang = settings::get_settings()
                .language
                .unwrap_or_else(|| "zh".to_string());

            let msg = match err {
                AppError::Localized { zh, en, .. } => {
                    if lang == "en" {
                        en
                    } else {
                        zh
                    }
                }
                other => other.to_string(),
            };

            Ok(UsageResult {
                success: false,
                data: None,
                error: Some(msg),
            })
        }
    }
}

/// Resolve `(api_key, base_url)` for the JS-script path. Explicit non-empty
/// script values win; otherwise use the same per-app provider resolver as the
/// native balance and coding-plan paths.
fn resolve_script_credentials(
    app_type: &AppType,
    provider: &crate::provider::Provider,
    api_key: Option<&str>,
    base_url: Option<&str>,
) -> (String, String) {
    let (provider_base_url, provider_api_key) = provider.resolve_usage_credentials(app_type);

    let api_key = api_key
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .unwrap_or(provider_api_key);
    let base_url = base_url
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.trim_end_matches('/').to_owned())
        .unwrap_or(provider_base_url);

    (api_key, base_url)
}

/// Query provider usage (using saved script configuration)
pub async fn query_usage(
    state: &AppState,
    app_type: AppType,
    provider_id: &str,
) -> Result<UsageResult, AppError> {
    let (
        script_code,
        timeout,
        api_key,
        base_url,
        access_token,
        user_id,
        template_type,
        new_api_accounts,
    ) = {
        let providers = state.db.get_all_providers(app_type.as_str())?;
        let provider = providers.get(provider_id).ok_or_else(|| {
            AppError::localized(
                "provider.not_found",
                format!("供应商不存在: {provider_id}"),
                format!("Provider not found: {provider_id}"),
            )
        })?;
        let (provider_base_url, _) = provider.resolve_usage_credentials(&app_type);
        let key_accounts = provider
            .meta
            .as_ref()
            .and_then(|m| m.multi_key_config.as_ref())
            .map(|config| accounts_from_key_metadata(config, &provider_base_url))
            .unwrap_or_default();
        if !key_accounts.is_empty() {
            return query_newapi_accounts(&key_accounts, &provider_base_url, 10).await;
        }

        let usage_script = provider
            .meta
            .as_ref()
            .and_then(|m| m.usage_script.as_ref())
            .ok_or_else(|| {
                AppError::localized(
                    "provider.usage.script.missing",
                    "未配置用量查询脚本",
                    "Usage script is not configured",
                )
            })?;
        if !usage_script.enabled {
            return Err(AppError::localized(
                "provider.usage.disabled",
                "用量查询未启用",
                "Usage query is disabled",
            ));
        }

        let (api_key, base_url) = resolve_script_credentials(
            &app_type,
            provider,
            usage_script.api_key.as_deref(),
            usage_script.base_url.as_deref(),
        );

        (
            usage_script.code.clone(),
            usage_script.timeout.unwrap_or(10),
            api_key,
            base_url,
            usage_script.access_token.clone(),
            usage_script.user_id.clone(),
            usage_script.template_type.clone(),
            usage_script.new_api_accounts.clone(),
        )
    };

    if template_type.as_deref() == Some(TEMPLATE_TYPE_NEWAPI) {
        let accounts = effective_newapi_accounts(
            new_api_accounts.as_deref(),
            &base_url,
            access_token.as_deref(),
            user_id.as_deref(),
        );
        if !accounts.is_empty() {
            return query_newapi_accounts(&accounts, &base_url, timeout).await;
        }
    }

    execute_and_format_usage_result(
        &script_code,
        &api_key,
        &base_url,
        timeout,
        access_token.as_deref(),
        user_id.as_deref(),
        template_type.as_deref(),
    )
    .await
}

/// Test usage script (using temporary script content, not saved)
#[allow(clippy::too_many_arguments)]
pub async fn test_usage_script(
    state: &AppState,
    app_type: AppType,
    provider_id: &str,
    script_code: &str,
    timeout: u64,
    api_key: Option<&str>,
    base_url: Option<&str>,
    access_token: Option<&str>,
    user_id: Option<&str>,
    template_type: Option<&str>,
    new_api_accounts: Option<&[NewApiAccountConfig]>,
) -> Result<UsageResult, AppError> {
    let providers = state.db.get_all_providers(app_type.as_str())?;
    let provider = providers.get(provider_id).ok_or_else(|| {
        AppError::localized(
            "provider.not_found",
            format!("供应商不存在: {provider_id}"),
            format!("Provider not found: {provider_id}"),
        )
    })?;
    let (api_key, base_url) = resolve_script_credentials(&app_type, provider, api_key, base_url);

    if template_type == Some(TEMPLATE_TYPE_NEWAPI) {
        let accounts = effective_newapi_accounts(
            new_api_accounts,
            &base_url,
            access_token,
            user_id,
        );
        if !accounts.is_empty() {
            return query_newapi_accounts(&accounts, &base_url, timeout).await;
        }
    }

    execute_and_format_usage_result(
        script_code,
        &api_key,
        &base_url,
        timeout,
        access_token,
        user_id,
        template_type,
    )
    .await
}

/// Validate UsageScript configuration (boundary checks)
pub(crate) fn validate_usage_script(script: &UsageScript) -> Result<(), AppError> {
    // Validate auto query interval (0-1440 minutes, max 24 hours)
    if let Some(interval) = script.auto_query_interval {
        if interval > 1440 {
            return Err(AppError::localized(
                "usage_script.interval_too_large",
                format!("自动查询间隔不能超过 1440 分钟（24小时），当前值: {interval}"),
                format!(
                    "Auto query interval cannot exceed 1440 minutes (24 hours), current: {interval}"
                ),
            ));
        }
    }

    Ok(())
}

fn effective_newapi_accounts(
    accounts: Option<&[NewApiAccountConfig]>,
    default_base_url: &str,
    access_token: Option<&str>,
    user_id: Option<&str>,
) -> Vec<NewApiAccountConfig> {
    let configured: Vec<NewApiAccountConfig> = accounts
        .unwrap_or(&[])
        .iter()
        .filter_map(|account| {
            let token = account.access_token.trim();
            let uid = account.user_id.trim();
            if token.is_empty() || uid.is_empty() {
                return None;
            }

            let base_url = account
                .base_url
                .as_deref()
                .unwrap_or(default_base_url)
                .trim();
            if base_url.is_empty() {
                return None;
            }

            Some(NewApiAccountConfig {
                id: account.id.clone(),
                name: account.name.clone(),
                base_url: Some(base_url.to_string()),
                access_token: token.to_string(),
                user_id: uid.to_string(),
            })
        })
        .collect();

    if !configured.is_empty() {
        return configured;
    }

    let token = access_token.unwrap_or("").trim();
    let uid = user_id.unwrap_or("").trim();
    if token.is_empty() || uid.is_empty() || default_base_url.trim().is_empty() {
        return Vec::new();
    }

    vec![NewApiAccountConfig {
        id: None,
        name: None,
        base_url: Some(default_base_url.trim().to_string()),
        access_token: token.to_string(),
        user_id: uid.to_string(),
    }]
}

fn accounts_from_key_metadata(
    config: &crate::provider::MultiKeyConfig,
    default_base_url: &str,
) -> Vec<NewApiAccountConfig> {
    config
        .key_metadata
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .enumerate()
        .filter_map(|(index, metadata)| {
            let account = metadata.balance_query.as_ref()?;
            let token = account.access_token.trim();
            let uid = account.user_id.trim();
            if token.is_empty() || uid.is_empty() {
                return None;
            }

            let base_url = account
                .base_url
                .as_deref()
                .unwrap_or(default_base_url)
                .trim();
            if base_url.is_empty() {
                return None;
            }

            Some(NewApiAccountConfig {
                id: account.id.clone().or_else(|| Some(format!("key-{index}"))),
                name: account
                    .name
                    .clone()
                    .or_else(|| Some(format!("Key {}", index + 1))),
                base_url: Some(base_url.to_string()),
                access_token: token.to_string(),
                user_id: uid.to_string(),
            })
        })
        .collect()
}

async fn query_newapi_accounts(
    accounts: &[NewApiAccountConfig],
    default_base_url: &str,
    timeout: u64,
) -> Result<UsageResult, AppError> {
    let mut data = Vec::with_capacity(accounts.len());

    for (index, account) in accounts.iter().enumerate() {
        data.push(query_newapi_account(account, default_base_url, index, timeout).await);
    }

    Ok(UsageResult {
        success: true,
        data: Some(data),
        error: None,
    })
}

async fn query_newapi_account(
    account: &NewApiAccountConfig,
    default_base_url: &str,
    index: usize,
    timeout: u64,
) -> UsageData {
    let label = newapi_account_label(account, None, index);
    let base_url = account
        .base_url
        .as_deref()
        .unwrap_or(default_base_url)
        .trim();
    let url = match newapi_account_url(base_url) {
        Ok(url) => url,
        Err(err) => return invalid_newapi_account(label, err),
    };

    let client = crate::proxy::http_client::get();
    let resp = client
        .get(url)
        .header("Authorization", format!("Bearer {}", account.access_token.trim()))
        .header("New-Api-User", account.user_id.trim())
        .header("Accept", "application/json")
        .timeout(Duration::from_secs(timeout.clamp(2, 30)))
        .send()
        .await;

    let resp = match resp {
        Ok(resp) => resp,
        Err(err) => return invalid_newapi_account(label, format!("Network error: {err}")),
    };

    let status = resp.status();
    let text = match resp.text().await {
        Ok(text) => text,
        Err(err) => return invalid_newapi_account(label, format!("Failed to read response: {err}")),
    };

    if !status.is_success() {
        return invalid_newapi_account(label, format!("HTTP {status}: {}", preview_text(&text)));
    }

    let body: Value = match serde_json::from_str(&text) {
        Ok(body) => body,
        Err(err) => return invalid_newapi_account(label, format!("Failed to parse response: {err}")),
    };

    let ok = response_is_success(&body);
    if !ok {
        let message = body
            .get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("Query failed");
        return invalid_newapi_account(label, message.to_string());
    }

    let account_data = match body.get("data").filter(|data| data.is_object()) {
        Some(data) => data,
        None => return invalid_newapi_account(label, "Missing data field".to_string()),
    };

    let quota = parse_f64_field(account_data, "quota").unwrap_or(0.0);
    let used_quota = parse_f64_field(account_data, "used_quota").unwrap_or(0.0);
    let group = account_data.get("group").and_then(|v| v.as_str());
    let plan_name = newapi_account_label(account, Some(account_data), index);

    UsageData {
        plan_name: Some(plan_name),
        remaining: Some(quota / NEWAPI_QUOTA_PER_USD),
        total: Some((quota + used_quota) / NEWAPI_QUOTA_PER_USD),
        used: Some(used_quota / NEWAPI_QUOTA_PER_USD),
        unit: Some("USD".to_string()),
        is_valid: Some(true),
        invalid_message: None,
        extra: group
            .filter(|group| !group.trim().is_empty())
            .map(|group| format!("Group: {group}")),
    }
}

fn newapi_account_url(base_url: &str) -> Result<String, String> {
    if base_url.trim().is_empty() {
        return Err("Base URL is empty".to_string());
    }

    let mut url = Url::parse(base_url.trim()).map_err(|err| format!("Invalid base URL: {err}"))?;
    url.set_path("/api/user/self");
    url.set_query(None);
    url.set_fragment(None);
    Ok(url.to_string())
}

fn newapi_account_label(
    account: &NewApiAccountConfig,
    data: Option<&Value>,
    index: usize,
) -> String {
    if let Some(name) = account
        .name
        .as_deref()
        .map(str::trim)
        .filter(|name| !name.is_empty())
    {
        return name.to_string();
    }

    if let Some(data) = data {
        for field in ["username", "name", "display_name", "group"] {
            if let Some(value) = data.get(field).and_then(|v| v.as_str()) {
                let value = value.trim();
                if !value.is_empty() {
                    return value.to_string();
                }
            }
        }
    }

    format!("NewAPI Account {}", index + 1)
}

fn invalid_newapi_account(plan_name: String, message: String) -> UsageData {
    UsageData {
        plan_name: Some(plan_name),
        remaining: None,
        total: None,
        used: None,
        unit: None,
        is_valid: Some(false),
        invalid_message: Some(message),
        extra: None,
    }
}

fn parse_f64_field(obj: &Value, field: &str) -> Option<f64> {
    obj.get(field).and_then(|v| {
        v.as_f64()
            .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
    })
}

fn response_is_success(body: &Value) -> bool {
    if let Some(value) = body.get("success") {
        if let Some(ok) = value.as_bool() {
            return ok;
        }
    }

    if let Some(value) = body.get("code") {
        if let Some(ok) = value.as_bool() {
            return ok;
        }
        if let Some(code) = value.as_i64() {
            return code == 0 || code == 200;
        }
        if let Some(code) = value.as_str() {
            let normalized = code.trim().to_ascii_lowercase();
            return matches!(normalized.as_str(), "true" | "ok" | "success" | "0" | "200");
        }
    }

    body.get("data").map(|data| data.is_object()).unwrap_or(false)
}

fn preview_text(text: &str) -> String {
    if text.len() <= 200 {
        return text.to_string();
    }

    let mut end = 200usize;
    while !text.is_char_boundary(end) {
        end = end.saturating_sub(1);
    }
    format!("{}...", &text[..end])
}
