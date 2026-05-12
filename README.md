# FF14 技能 Dot 监控

FF14 ACT 技能 Dot/Debuff 监控悬浮窗，基于 OverlayPlugin API 实现。使用 TTS 语音播报提醒补 Dot。

## 功能

- **Dot 监控**：自动检测自身 Dot 技能使用，在持续时间结束前语音提醒
- **Dot 刷新逻辑**：重复触发同一 Dot 时，自动重置计时器
- **CD 防重逻辑**：CD 类技能在冷却期间忽略重复触发
- **团灭检测**：通过 `ActorControl` 信号自动清除计时器
- **木桩兼容**：不依赖 `inGameCombat` 状态，打木桩也能正常工作
- **静默运行**：非 dev 模式下不输出任何日志，零干扰
- **配置面板**：`dev=1` 模式下可图形化编辑技能配置并导出 `data.js`

## 使用方式

在 ACT → OverlayPlugin → 新建悬浮窗 → URL 填入：

```
https://floreswayne.github.io/ff14-skill-cd-monitor/
```

### 开发模式（调试用）

```
https://floreswayne.github.io/ff14-skill-cd-monitor/?dev=1
```

`dev=1` 会显示：
- 日志面板：查看技能触发、计时器设定等运行日志
- 配置面板：按职业分类编辑技能数据，导出后覆盖 `data.js`

## 自定义技能数据

推荐方式（无需手写代码）：

1. 打开 `?dev=1` 进入配置面板
2. 勾选/取消勾选技能，修改 duration、advance、TTS 内容
3. 点击「导出 data.js」→ 复制代码
4. 覆盖仓库的 `data.js` → `git push`

手动编辑方式：

用文本编辑器打开 `data.js`，修改 `SKILL_DATABASE`：

```javascript
{
  ids: ["1D8A"],
  name: "醒梦",
  type: "dot",
  duration: 60,        // 持续时间（秒）
  advance: 2,          // 提前播报秒数（可选）
  enabled: true,       // 是否启用
  reminders: [{ tts: "醒梦" }],
}
```

| 字段 | 说明 |
|---|---|
| `ids` | 技能 ID 数组（十六进制字符串） |
| `name` | 技能名称 |
| `type` | `"cd"` 冷却提醒 / `"dot"` 持续刷新 |
| `duration` | CD 或持续时间（秒） |
| `advance` | 提前播报秒数，不填则用全局默认值 `DEFAULT_ADVANCE = 2` |
| `enabled` | `true` 启用 / `false` 禁用（保留数据但不监控） |
| `reminders` | 播报列表，`{ tts: "..." }` 自动计算时间，`{ at: 43, tts: "..." }` 固定秒数触发 |

## 项目结构

```
├── index.html    # 入口文件，OverlayPlugin 加载此文件
├── data.js       # 技能数据库
└── app.js        # 核心逻辑：API 通信、计时器、TTS、配置面板
```

## 数据来源

技能数据从 Triggernometry 导出文件 `技能CD监控v2.54.xml` 迁移而来。

## 更新记录

- **配置面板**：`dev=1` 模式下支持按职业分类编辑技能，导出完整 `data.js`
- **白色主题**：配置面板采用浅色主题，便于阅读
- **背景透明**：悬浮窗主体背景透明，不遮挡游戏画面
- **木桩兼容**：移除 `onInCombatChangedEvent` 监听，避免木桩时误清除计时器
- **隐私保护**：日志中不输出玩家名称
