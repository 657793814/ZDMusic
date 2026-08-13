<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ⚠️ 配置修改注意：不要改错文件

本项目的**运行时配置**（AI Key / Base URL / 模型 / B站 Cookie / ACRCloud 等）
由 `app/lib/config.ts` 读取，**优先级**为：

1. **用户保存配置** `~/.zdmusic/config.json`（设置界面保存到这里，优先级最高）
2. **打包配置** `$ZD_CONFIG_FILE`（Tauri 注入，仅补全未设置键）

**改配置一律改 `~/.zdmusic/config.json`（或在设置界面里改），不要直接改 `.env.local` / `.env.example`** —— 它们不会被运行时读取。

`.env.local` 只是示例/开发兜底，改了不生效。

AI 当前生效配置（2026-08 确认可用）：
- `ANTHROPIC_BASE_URL=https://api.agnes-ai.cn/v1`（注意是 `api`，不是 `apihub`；`apihub.agnes-ai.cn` 是控制台，不是 API 网关）
- `ANTHROPIC_MODEL=agnes-2.5-flash`
- `ANTHROPIC_API_KEY=sk-P3MJiF...`（见 `~/.zdmusic/config.json`）

若设置界面显示旧值，检查 `~/.zdmusic/config.json` 是否已同步，并 POST `/api/config/reload` 清缓存。
