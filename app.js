(function() {
      const subscribers = {};
      let inited = false;
      let pendingEvents = [];

      function processEvent(msg) {
        const subs = subscribers[msg.type];
        if (subs) {
          subs.forEach(cb => {
            try { cb(msg); } catch (e) { console.error(e); }
          });
        }
      }

      function subscribeEvent(event) {
        if (inited && window.OverlayPluginApi) {
          window.OverlayPluginApi.callHandler(JSON.stringify({
            call: 'subscribe', events: [event]
          }), function() {});
        } else {
          pendingEvents.push(event);
        }
      }

      function addOverlayListener(event, cb) {
        if (!subscribers[event]) {
          subscribers[event] = [];
          subscribeEvent(event);
        }
        subscribers[event].push(cb);
      }

      function callOverlayHandler(msg) {
        return new Promise((resolve, reject) => {
          if (window.OverlayPluginApi) {
            window.OverlayPluginApi.callHandler(JSON.stringify(msg), (data) => {
              if (data === null) { resolve(null); return; }
              try {
                const parsed = JSON.parse(data);
                if (parsed['$error']) reject(parsed);
                else resolve(parsed);
              } catch (e) { resolve(data); }
            });
          } else {
            reject(new Error('OverlayPluginApi not available'));
          }
        });
      }

      function init() {
        if (inited) return;
        const wait = () => {
          if (window.OverlayPluginApi && window.OverlayPluginApi.ready) {
            inited = true;
            window.__OverlayCallback = processEvent;
            pendingEvents.forEach(event => {
              window.OverlayPluginApi.callHandler(JSON.stringify({
                call: 'subscribe', events: [event]
              }), function() {});
            });
            pendingEvents = [];
          } else {
            setTimeout(wait, 300);
          }
        };
        wait();
      }

      init();
      window.addOverlayListener = addOverlayListener;
      window.callOverlayHandler = callOverlayHandler;
    })();

// 地址栏 ?dev=1 开启详细日志模式
    const IS_DEV = new URLSearchParams(location.search).get('dev') === '1';

    // ==============================================================
    // 缩放系统
    // --------------------------------------------------------------
    // 支持 URL 参数: ?scale=1.5
    // 支持快捷键: Alt + 滚轮上下 实时调整缩放
    // 范围: 0.5x ~ 3.0x
    // ==============================================================
    const urlParams = new URLSearchParams(location.search);
    let currentScale = parseFloat(urlParams.get('scale')) || 1.0;
    currentScale = Math.max(0.5, Math.min(3.0, currentScale));

    function applyScale() {
      document.body.style.zoom = currentScale.toFixed(2);
    }
    applyScale();

    // Alt + 滚轮调整缩放
    let scaleDebounce = null;
    document.addEventListener('wheel', (e) => {
      if (e.altKey) {
        e.preventDefault();
        const step = e.deltaY > 0 ? -0.05 : 0.05;
        currentScale = Math.max(0.5, Math.min(3.0, currentScale + step));
        applyScale();
        // 防抖输出当前缩放比例到日志
        if (scaleDebounce) clearTimeout(scaleDebounce);
        scaleDebounce = setTimeout(() => {
          console.log(`[SkillCD] 缩放比例: ${currentScale.toFixed(2)}x`);
        }, 200);
      }
    }, { passive: false });

class SkillCdMonitor {
      constructor() {
        // 构建技能ID -> 技能配置 的映射表
        this.skillMap = new Map();
        let skillCount = 0;

        function registerSkill(skill) {
          for (const id of skill.ids) {
            const upperId = id.toUpperCase();
            if (this.skillMap.has(upperId)) {
              this.warn(`技能ID冲突: ${upperId} 已被注册`);
            }
            this.skillMap.set(upperId, skill);
          }
          skillCount++;
        }

        // 共通技能
        for (const skill of SKILL_DATABASE.common) {
          registerSkill.call(this, skill);
        }

        // 各职能职业
        for (const role of ['tank', 'melee', 'ranged', 'caster', 'healer']) {
          const jobs = SKILL_DATABASE[role];
          for (const jobSkills of Object.values(jobs)) {
            for (const skill of jobSkills) {
              registerSkill.call(this, skill);
            }
          }
        }

        // 活跃计时器: Map<timerKey, { skillName, timeouts: number[] }>
        this.activeTimers = new Map();
        this.playerName = '';
        this.logEl = document.getElementById('log');
        this.skillCount = skillCount;
      }

      init() {
        // dev=1 时显示日志面板
        if (IS_DEV) {
          document.body.classList.add('dev-mode');
        }

        addOverlayListener('LogLine', (e) => this.handleLogLine(e));
        addOverlayListener('ChangePrimaryPlayer', (e) => {
          this.playerName = e.charName || '';
          this.info(`玩家: ${this.playerName}`);
        });
        addOverlayListener('onInCombatChangedEvent', (e) => {
          // 当游戏内脱离战斗时（怪全死了），清除所有计时器
          if (e.detail && e.detail.inGameCombat === false) {
            this.info('检测到脱离战斗，清除所有计时器');
            this.clearAllTimers();
          }
        });
        this.info('技能CD监控已启动');
        this.info(`已加载 ${this.skillCount} 个技能配置`);
        if (IS_DEV) {
          this.info('开发模式已开启 (dev=1)，将输出详细日志');
        }
      }

      /**
       * 计算 reminder 的实际延迟毫秒数
       */
      calcDelayMs(skill, reminder) {
        // 如果 reminder 显式指定了 at（秒），直接使用
        if (typeof reminder.at === 'number') {
          return reminder.at * 1000;
        }
        // 否则使用 duration - advance 计算
        if (typeof skill.duration !== 'number') {
          this.warn(`[${skill.name}] 缺少 duration 且 reminder 无 at，无法计算延迟`);
          return 0;
        }
        const advance = typeof skill.advance === 'number' ? skill.advance : DEFAULT_ADVANCE;
        const delayMs = skill.duration * 1000 - advance * 1000;
        return Math.max(0, delayMs);
      }

      handleLogLine(e) {
        const line = e.line;
        if (!line || line.length < 5) return;
        const type = line[0];

        // 团灭/战斗重置检测
        // 方式1: 33(ActorControl) 中的特定command
        if (type === '33') {
          const cmd = line[3] || '';
          if (cmd === '4000000F' || cmd === '40000010') {
            this.info('检测到团灭/战斗重置，清除所有计时器');
            this.clearAllTimers();
            return;
          }
        }
        // 方式2: 21(Ability) 中 sourceId 为特殊团灭标记 (兼容原XML逻辑)
        if (type === '21') {
          const sourceId = line[2] || '';
          if (sourceId === '40000010' || sourceId === '40000012' || sourceId === '40000016') {
            this.info('检测到团灭/战斗重置，清除所有计时器');
            this.clearAllTimers();
            return;
          }
        }

        // 21 = Ability, 22 = AOEAbility (仅当flags表明是真实技能使用时)
        if (type !== '21' && type !== '22') return;

        // AOEAbility (22) 需要额外判断是否是真实技能使用
        if (type === '22' && line[45] !== '0') return;

        const sourceName = line[3] || '';
        const actionId = (line[4] || '').toUpperCase();

        // 仅监控当前玩家自身的技能
        if (!this.playerName || sourceName !== this.playerName) return;
        if (!actionId) return;

        const skill = this.skillMap.get(actionId);
        if (!skill) return;

        this.triggerSkill(actionId, skill);
      }

      triggerSkill(actionId, skill) {
        const timerKey = actionId;
        const existing = this.activeTimers.get(timerKey);

        if (skill.type === 'dot') {
          // dot类型: 取消旧计时器，使用新的
          if (existing) {
            this.clearTimer(timerKey);
            this.dev(`[${skill.name}] 刷新计时器`);
          }
        } else if (skill.type === 'cd') {
          // cd类型: 如果已有活跃计时器，忽略重复触发
          if (existing) {
            this.dev(`[${skill.name}] CD中，忽略重复触发`);
            return;
          }
        }

        // 创建新的计时器
        const timeouts = [];
        for (const reminder of skill.reminders) {
          const delayMs = this.calcDelayMs(skill, reminder);
          if (delayMs <= 0) continue;

          const tid = setTimeout(() => {
            this.speak(reminder.tts);
            this.info(`[${skill.name}] 播报: ${reminder.tts}`);
          }, delayMs);
          timeouts.push(tid);

          // dev模式下打印计时器详情
          this.dev(`[${skill.name}] 设定提醒: "${reminder.tts}" 将在 ${(delayMs/1000).toFixed(1)}秒后播报`);
        }

        if (timeouts.length > 0) {
          this.activeTimers.set(timerKey, {
            skillName: skill.name,
            timeouts: timeouts,
          });
          this.info(`[${skill.name}] 开始计时 (${skill.reminders.length}个提醒)`);
        }
      }

      clearTimer(timerKey) {
        const entry = this.activeTimers.get(timerKey);
        if (!entry) return;
        for (const tid of entry.timeouts) {
          clearTimeout(tid);
        }
        this.activeTimers.delete(timerKey);
      }

      clearAllTimers() {
        for (const [key, entry] of this.activeTimers) {
          for (const tid of entry.timeouts) {
            clearTimeout(tid);
          }
        }
        this.activeTimers.clear();
      }

      async speak(text) {
        if (!text) return;
        // 优先尝试 cactbotSay (需要安装cactbot)
        try {
          await callOverlayHandler({ call: 'cactbotSay', text: text });
          return;
        } catch (e) {
          // cactbotSay 不可用，fallback 到浏览器原生TTS
        }
        // 浏览器原生语音合成
        if (window.speechSynthesis) {
          const utter = new SpeechSynthesisUtterance(text);
          utter.lang = 'zh-CN';
          utter.rate = 1.1;
          window.speechSynthesis.speak(utter);
        } else {
          console.warn('[SkillCD] 语音合成不可用');
        }
      }

      // 日志级别控制
      // info: 始终输出（关键信息）
      // dev:  仅在 dev=1 时输出（详细调试）
      // warn: 始终输出（警告）

      info(msg) {
        this._log('info', msg);
      }

      dev(msg) {
        if (IS_DEV) {
          this._log('dev', msg);
        }
      }

      warn(msg) {
        this._log('warn', msg);
        console.warn('[SkillCD] ' + msg);
      }

      _log(level, msg) {
        const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        const line = `[${time}] ${msg}`;
        console.log(line);

        // 仅在 dev=1 时显示在页面上
        if (IS_DEV && this.logEl) {
          const el = document.createElement('div');
          el.className = 'log-line log-' + level;
          el.textContent = line;
          this.logEl.appendChild(el);
          // 自动滚动到底部，显示最新日志
          this.logEl.scrollTop = this.logEl.scrollHeight;
        }
      }
    }

    // 启动
    const monitor = new SkillCdMonitor();
    monitor.init();
