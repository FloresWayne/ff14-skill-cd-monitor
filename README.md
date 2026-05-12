# 技能CD监控

FF14 ACT Cactbot 技能CD监控悬浮窗，基于 OverlayPlugin API 实现。

## 功能

- 自动监控玩家自身技能使用，在CD/持续时间结束后语音播报提醒
- 支持 **dot 刷新** 和 **CD 防重** 两种逻辑
- 支持 **多阶段播报**（如吟游诗人切歌）
- 团灭/脱离战斗时自动清除计时器
- 101 个技能内置数据库，按职业分组

## 使用方式

在 ACT → OverlayPlugin → 新建悬浮窗 → URL 填入：

`https://github.com/FloresWayne/ff14-skill-cd-monitor/`

或开启开发日志模式：

`https://github.com/FloresWayne/ff14-skill-cd-monitor/?dev=1`

## 自定义技能数据

用文本编辑器打开 `skill-cd-monitor.html`，找到 `SKILL_DATABASE` 部分即可修改：

```javascript
{
  ids: ["1D8A"],
  name: "醒梦",
  type: "cd",
  duration: 60,        // CD/持续时间（秒）
  advance: 2,          // 提前播报秒数（可选）
  reminders: [{ tts: "醒梦" }],
}
```

- `duration`: 技能CD或持续时间（秒）
- `advance`: 提前播报秒数，不填则用全局默认值 `DEFAULT_ADVANCE = 2`
- 实际延迟 = `duration × 1000 - advance × 1000` 毫秒

## 数据来源

技能数据从 Triggernometry 导出文件 `技能CD监控v2.54.xml` 迁移而来。
