<div align="center">

# CC Switch - 二开自用版

[![Base Version](https://img.shields.io/badge/base-v3.11.1-blue.svg)](https://github.com/farion1231/cc-switch)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](https://github.com/WangXingFan/cc-switch/releases)

**基于 [CC Switch](https://github.com/farion1231/cc-switch) 的个人二次开发版本**

</div>

---

## 致谢

本项目基于 **[farion1231/cc-switch](https://github.com/farion1231/cc-switch)** 二次开发。

感谢原作者 **Jason Young** 创建了如此优秀的 Claude Code / Codex / Gemini CLI 供应商切换工具！

原项目采用 MIT 协议开源，本二开版本同样遵循 MIT 协议。

---

## 说明

这是一个**个人自用**的二开版本，主要针对个人使用场景进行功能增强。

如需使用完整功能和官方支持，请访问原项目：https://github.com/farion1231/cc-switch

---

## 二开新增功能

### 1. 多 API Key 轮询/随机调用

**适用范围**：Claude 和 Codex 供应商

为同一个供应商配置多个 API Key，代理转发请求时自动按策略选择 Key：

- **轮询模式 (Round-Robin)**：按顺序依次使用每个 Key
- **随机模式 (Random)**：随机选择一个 Key 开始

**智能故障转移**：
- 当某个 Key 请求失败（429 限流、401 无效、5xx 服务错误）时，自动跳过该 Key 尝试下一个
- 所有 Key 都失败后，才触发 Provider 级别的故障转移

**使用方法**：
1. 编辑供应商配置
2. 在 API Key 区域点击「添加 Key」按钮
3. 添加多个 API Key
4. 选择轮询策略（轮询 / 随机）
5. 保存配置

**技术实现**：
- 多 Key 配置存储在 `meta.multiKeyConfig`（SSOT）
- 第一个 Key 同步到 `settingsConfig`，保持与 CLI 工具兼容
- Key 级别重试在代理 forwarder 层实现，零侵入原有逻辑

### 2. 全局快捷键切换窗口

通过系统级全局快捷键，在任何应用中快速显示/隐藏 CC Switch 主窗口。

- **自定义录制**：在设置页面点击录制按钮，按下你想要的组合键即可完成设置
- **持久化**：快捷键配置保存到本地，重启应用后自动恢复
- **一键清除**：不需要时随时清除快捷键绑定

**使用方法**：
1. 打开设置 → 窗口设置
2. 找到「全局快捷键」，点击录制区域
3. 按下组合键（如 `Ctrl+Shift+S`），需包含至少一个修饰键
4. 设置即时生效，在任何应用中按下该快捷键即可切换窗口

**技术实现**：
- 基于 `tauri-plugin-global-shortcut` 实现系统级热键监听
- 前端键盘事件录制，自动转换为 Tauri 兼容的快捷键格式
- 窗口切换复用现有 show/hide 逻辑，支持 Windows/macOS 平台特性

---

## 安装

从 [Releases](../../releases) 页面下载最新的 Windows 构建版本。

---

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 类型检查
pnpm typecheck

# 构建
pnpm build
```

---

## License

MIT © Jason Young (原作者)

二开维护者：WangXingFan
