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

class SkillCdMonitor {
      constructor() {
        // 构建技能ID -> 技能配置 的映射表
        this.skillMap = new Map();
        let skillCount = 0;

        function registerSkill(skill) {
          if (skill.enabled === false) return;
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

    // ==============================================================
    // 配置面板 (仅 dev=1 时启用)
    // --------------------------------------------------------------
    // 提供按职业分类的技能配置界面，支持：
    // - 启用/禁用技能
    // - 修改 duration、advance
    // - 修改 reminders 的 at 和 tts
    // - 导出完整 data.js 代码
    // ==============================================================

    const ROLE_NAMES = {
      common: '📦 共通',
      tank: '🛡️ 防护',
      melee: '⚔️ 近战',
      ranged: '🏹 远程物理',
      caster: '🔮 远程魔法',
      healer: '💚 治疗',
    };

    const JOB_NAMES = {
      drk: '暗黑骑士', gnb: '绝枪战士', pld: '骑士', war: '战士',
      drg: '龙骑士', nin: '忍者', mnk: '武僧', sam: '武士', rpr: '钐镰客',
      dnc: '舞者', brd: '吟游诗人', mch: '机工士',
      blm: '黑魔法师', rdm: '赤魔法师', smn: '召唤师',
      whm: '白魔法师', sge: '贤者', sch: '学者', ast: '占星术士',
      common: '通用',
    };

    class SkillConfigPanel {
      constructor() {
        this.data = this._cloneData();
        this.contentEl = document.getElementById('config-content');
        this.modalEl = document.getElementById('config-export-modal');
        this.exportTextEl = document.getElementById('config-export-text');
        this.toggleLogBtn = document.getElementById('config-toggle-log');
        this.exportBtn = document.getElementById('config-export');
        this.copyBtn = document.getElementById('config-copy-btn');
        this.closeBtn = document.getElementById('config-close-btn');
        this._render();
        this._bindEvents();
      }

      _cloneData() {
        const cloned = {};
        cloned.common = SKILL_DATABASE.common.map((s, i) => ({
          ...JSON.parse(JSON.stringify(s)),
          _path: `common.${i}`,
          _enabled: s.enabled !== false,
        }));
        for (const role of ['tank', 'melee', 'ranged', 'caster', 'healer']) {
          cloned[role] = {};
          for (const [job, skills] of Object.entries(SKILL_DATABASE[role])) {
            cloned[role][job] = skills.map((s, i) => ({
              ...JSON.parse(JSON.stringify(s)),
              _path: `${role}.${job}.${i}`,
              _enabled: s.enabled !== false,
            }));
          }
        }
        return cloned;
      }

      _render() {
        this._renderRole('common', this.data.common, this.contentEl);
        for (const role of ['tank', 'melee', 'ranged', 'caster', 'healer']) {
          this._renderRole(role, this.data[role], this.contentEl);
        }
      }

      _renderRole(roleKey, roleData, parentEl) {
        const roleDiv = document.createElement('div');
        roleDiv.className = 'config-role';
        roleDiv.dataset.role = roleKey;

        const title = document.createElement('div');
        title.className = 'config-role-title';
        title.textContent = ROLE_NAMES[roleKey] || roleKey;
        title.addEventListener('click', () => roleDiv.classList.toggle('expanded'));
        roleDiv.appendChild(title);

        const content = document.createElement('div');
        content.className = 'config-role-content';

        if (roleKey === 'common') {
          for (let i = 0; i < roleData.length; i++) {
            this._renderSkill(roleData[i], content);
          }
        } else {
          for (const [jobKey, jobSkills] of Object.entries(roleData)) {
            this._renderJob(jobKey, jobSkills, content);
          }
        }

        roleDiv.appendChild(content);
        parentEl.appendChild(roleDiv);
      }

      _renderJob(jobKey, jobSkills, parentEl) {
        const jobDiv = document.createElement('div');
        jobDiv.className = 'config-job';
        jobDiv.dataset.job = jobKey;

        const title = document.createElement('div');
        title.className = 'config-job-title';
        title.textContent = JOB_NAMES[jobKey] || jobKey;
        title.addEventListener('click', (e) => {
          e.stopPropagation();
          jobDiv.classList.toggle('expanded');
        });
        jobDiv.appendChild(title);

        const content = document.createElement('div');
        content.className = 'config-job-content';

        for (const skill of jobSkills) {
          this._renderSkill(skill, content);
        }

        jobDiv.appendChild(content);
        parentEl.appendChild(jobDiv);
      }

      _renderSkill(skill, parentEl) {
        const row = document.createElement('div');
        row.className = 'config-skill';
        row.dataset.path = skill._path;

        // 启用开关
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = skill._enabled;
        cb.title = '启用/禁用';
        cb.addEventListener('change', () => { skill._enabled = cb.checked; });
        row.appendChild(cb);

        // ID (可编辑)
        const idWrap = document.createElement('div');
        idWrap.className = 'skill-id';
        const idInput = document.createElement('input');
        idInput.type = 'text';
        idInput.value = skill.ids.join(', ');
        idInput.title = '技能ID，多个用逗号分隔';
        idInput.addEventListener('change', () => {
          skill.ids = idInput.value.split(',').map(s => s.trim()).filter(Boolean);
        });
        idWrap.appendChild(idInput);
        row.appendChild(idWrap);

        // 名称 (可编辑)
        const nameWrap = document.createElement('div');
        nameWrap.className = 'skill-name';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = skill.name;
        nameInput.title = '技能名称';
        nameInput.addEventListener('change', () => { skill.name = nameInput.value; });
        nameWrap.appendChild(nameInput);
        row.appendChild(nameWrap);

        // 类型
        const typeSpan = document.createElement('span');
        typeSpan.className = 'skill-type';
        typeSpan.textContent = skill.type;
        typeSpan.title = '类型: cd=冷却提醒, dot=持续刷新';
        row.appendChild(typeSpan);

        // CD/持续时间
        const durLabel = document.createElement('span');
        durLabel.className = 'skill-dur-label';
        durLabel.textContent = 'CD:';
        row.appendChild(durLabel);

        const durInput = document.createElement('input');
        durInput.type = 'number';
        durInput.value = typeof skill.duration === 'number' ? skill.duration : '';
        durInput.title = 'CD/持续时间(秒)，空=不自动计算';
        durInput.addEventListener('change', () => {
          const v = parseFloat(durInput.value);
          skill.duration = isNaN(v) ? undefined : v;
        });
        row.appendChild(durInput);

        // 提前播报秒数
        const advLabel = document.createElement('span');
        advLabel.className = 'skill-adv-label';
        advLabel.textContent = '提前:';
        row.appendChild(advLabel);

        const advInput = document.createElement('input');
        advInput.type = 'number';
        advInput.value = typeof skill.advance === 'number' ? skill.advance : '';
        advInput.title = '提前播报秒数，空=使用默认值(2秒)';
        advInput.addEventListener('change', () => {
          const v = parseFloat(advInput.value);
          skill.advance = isNaN(v) ? undefined : v;
        });
        row.appendChild(advInput);

        // Reminders
        for (let ri = 0; ri < skill.reminders.length; ri++) {
          const r = skill.reminders[ri];
          const rRow = document.createElement('div');
          rRow.className = 'reminder-row';

          const atWrap = document.createElement('div');
          atWrap.className = 'reminder-at';
          const atInput = document.createElement('input');
          atInput.type = 'number';
          atInput.value = typeof r.at === 'number' ? r.at : '';
          atInput.title = '固定秒数(空=自动: duration - advance)';
          atInput.addEventListener('change', () => {
            const v = parseFloat(atInput.value);
            if (isNaN(v)) delete r.at;
            else r.at = v;
          });
          atWrap.appendChild(atInput);
          rRow.appendChild(atWrap);

          const ttsWrap = document.createElement('div');
          ttsWrap.className = 'reminder-tts';
          const ttsInput = document.createElement('input');
          ttsInput.type = 'text';
          ttsInput.value = r.tts;
          ttsInput.title = 'TTS播报内容';
          ttsInput.addEventListener('change', () => { r.tts = ttsInput.value; });
          ttsWrap.appendChild(ttsInput);
          rRow.appendChild(ttsWrap);

          row.appendChild(rRow);
        }

        parentEl.appendChild(row);
      }

      _bindEvents() {
        this.toggleLogBtn.addEventListener('click', () => {
          document.body.classList.toggle('show-log');
          this.toggleLogBtn.textContent = document.body.classList.contains('show-log')
            ? '⚙️ 打开配置'
            : '📋 查看日志';
        });

        this.exportBtn.addEventListener('click', () => {
          const code = this._generateDataJs();
          this.exportTextEl.value = code;
          this.modalEl.classList.add('show');
        });

        this.copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(this.exportTextEl.value);
            this.copyBtn.textContent = '✓ 已复制';
          } catch (e) {
            this.exportTextEl.select();
            document.execCommand('copy');
            this.copyBtn.textContent = '✓ 已复制';
          }
          setTimeout(() => { this.copyBtn.textContent = '📋 复制到剪贴板'; }, 1500);
        });

        this.closeBtn.addEventListener('click', () => {
          this.modalEl.classList.remove('show');
        });
      }

      _generateDataJs() {
        const lines = [];
        lines.push('// ==============================================================');
        lines.push('// 技能CD监控数据库 - 按职业分组 (由配置面板导出)');
        lines.push('// ==============================================================');
        lines.push('const DEFAULT_ADVANCE = 2;');
        lines.push('');
        lines.push('const SKILL_DATABASE = {');

        // common
        lines.push('  // 共通技能');
        lines.push('  common: [');
        for (const s of this.data.common) {
          lines.push(...this._skillToLines(s, '    '));
        }
        lines.push('  ],');

        // roles
        for (const role of ['tank', 'melee', 'ranged', 'caster', 'healer']) {
          const roleData = this.data[role];
          const jobs = Object.keys(roleData);

          lines.push('');
          lines.push(`  // ${role}`);
          lines.push(`  ${role}: {`);
          for (const job of jobs) {
            const jobSkills = roleData[job];
            lines.push(`    // ${JOB_NAMES[job] || job}`);
            lines.push(`    ${job}: [`);
            for (const s of jobSkills) {
              lines.push(...this._skillToLines(s, '      '));
            }
            lines.push('    ],');
          }
          lines.push('  },');
        }

        lines.push('};');
        return lines.join('\n');
      }

      _skillToLines(skill, indent) {
        const lines = [];
        lines.push(`${indent}{`);
        lines.push(`${indent}  ids: [${skill.ids.map(id => `"${id}"`).join(', ')}],`);
        lines.push(`${indent}  name: "${skill.name}",`);
        lines.push(`${indent}  type: "${skill.type}",`);
        lines.push(`${indent}  enabled: ${skill._enabled !== false},`);
        if (typeof skill.duration === 'number') {
          lines.push(`${indent}  duration: ${skill.duration},`);
        }
        if (typeof skill.advance === 'number') {
          lines.push(`${indent}  advance: ${skill.advance},`);
        }
        lines.push(`${indent}  reminders: [`);
        for (const r of skill.reminders) {
          if (typeof r.at === 'number') {
            lines.push(`${indent}    { at: ${r.at}, tts: "${r.tts}" },`);
          } else {
            lines.push(`${indent}    { tts: "${r.tts}" },`);
          }
        }
        lines.push(`${indent}  ],`);
        lines.push(`${indent}},`);
        return lines;
      }
    }

    // dev=1 时初始化配置面板
    if (IS_DEV) {
      new SkillConfigPanel();
    }


