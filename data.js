// ==============================================================
    // 技能CD监控数据库 - 按职业分组
    // --------------------------------------------------------------
    // 数据结构:
    //   common : 共通技能数组
    //   tank   : { drk: [...], gnb: [...], pld: [...], war: [...] }
    //   melee  : { drg: [...], nin: [...], mnk: [...], sam: [...], rpr: [...] }
    //   ranged : { dnc: [...], brd: [...], mch: [...] }
    //   caster : { blm: [...], rdm: [...], smn: [...] }
    //   healer : { whm: [...], sge: [...], sch: [...], ast: [...], common: [...] }
    //
    // 每个技能条目:
    //   ids      : 技能ID数组(16进制字符串)
    //   name     : 技能名称
    //   type     : "cd" | "dot"
    //   duration : 技能CD/持续时间（秒），填写后自动计算延迟
    //   advance  : （可选）提前播报秒数，不填用全局 DEFAULT_ADVANCE
    //   reminders: [ { tts: "..." } ] 或 [ { at: 43, tts: "..." } ]
    //
    // 修改指南:
    // 1. 找到对应职业分组
    // 2. 添加/修改/删除技能对象
    // 3. duration 为CD秒数，实际延迟 = duration*1000 - advance*1000
    // ==============================================================
    const DEFAULT_ADVANCE = 2;

// ==============================================================
// 技能CD监控数据库 - 按职业分组
// ==============================================================
const SKILL_DATABASE = {
  // --------------------------------------------------------------
  // 共通技能
  // --------------------------------------------------------------
  common: [
    {
      ids: ["1D8A"],
      name: "醒梦",
      type: "cd",
      duration: 60,
      reminders: [
        { tts: "醒梦" },
      ],
    },
    {
      ids: ["1D89"],
      name: "即刻咏唱",
      type: "cd",
      duration: 55,
      reminders: [
        { tts: "即刻" },
      ],
    },
  ],

  // --------------------------------------------------------------
  // 防护职业
  // --------------------------------------------------------------
  tank: {
    // 暗黑骑士
    drk: [
      {
        ids: ["E29"],
        name: "嗜血",
        type: "dot",
        duration: 60,
        reminders: [
          { tts: "嗜血" },
        ],
      },
      {
        ids: ["E37"],
        name: "腐秽大地",
        type: "dot",
        duration: 90,
        reminders: [
          { tts: "腐秽大地" },
        ],
      },
      {
        ids: ["4058"],
        name: "掠影示现",
        type: "dot",
        duration: 100,
        reminders: [
          { tts: "弗雷弗雷注意能量" },
        ],
      },
    ],
    // 绝枪战士
    gnb: [
      {
        ids: ["3F0A"],
        name: "无情",
        type: "cd",
        duration: 55,
        reminders: [
          { tts: "无情" },
        ],
      },
      {
        ids: ["3F24"],
        name: "血壤",
        type: "cd",
        duration: 120,
        reminders: [
          { tts: "血壤" },
        ],
      },
      {
        ids: ["3F12"],
        name: "子弹连",
        type: "cd",
        duration: 30,
        reminders: [
          { tts: "子弹连" },
        ],
      },
      {
        ids: ["3F21", "649E"],
        name: "石之心|刚玉之心",
        type: "cd",
        duration: 25,
        reminders: [
          { tts: "石之心" },
        ],
      },
    ],
    // 骑士
    pld: [
      {
        ids: ["14"],
        name: "战逃反应",
        type: "cd",
        duration: 55,
        reminders: [
          { tts: "战逃" },
        ],
      },
      {
        ids: ["1CD7"],
        name: "安魂祈祷",
        type: "cd",
        duration: 55,
        reminders: [
          { tts: "安魂" },
        ],
      },
      {
        ids: ["1D", "6493"],
        name: "偿赎剑",
        type: "cd",
        duration: 30,
        reminders: [
          { tts: "偿赎剑" },
        ],
      },
      {
        ids: ["17"],
        name: "厄运流转",
        type: "cd",
        duration: 25,
        reminders: [
          { tts: "厄运流转" },
        ],
      },
      {
        ids: ["DD2"],
        name: "沥血剑",
        type: "cd",
        duration: 60,
        reminders: [
          { tts: "沥血" },
        ],
      },
    ],
    // 战士
    war: [
      {
        ids: ["1CDB", "6498"],
        name: "动乱|群山隆起",
        type: "cd",
        duration: 30,
        reminders: [
          { tts: "动乱" },
        ],
      },
      {
        ids: ["2D", "404E"],
        name: "战场风暴",
        type: "dot",
        duration: 30,
        reminders: [
          { tts: "红斩" },
        ],
      },
      {
        ids: ["DDF", "4050", "6497"],
        name: "原初的勇猛|原初的直觉|原初的血气",
        type: "cd",
        duration: 25,
        reminders: [
          { tts: "原初" },
        ],
      },
      {
        ids: ["1CDD"],
        name: "原初的解放",
        type: "cd",
        duration: 55,
        reminders: [
          { tts: "解放" },
        ],
      },
      {
        ids: ["DE0"],
        name: "泰然自若",
        type: "cd",
        duration: 60,
        reminders: [
          { tts: "泰然" },
        ],
      },
    ],
  },

  // --------------------------------------------------------------
  // 近战职业
  // --------------------------------------------------------------
  melee: {
    // 龙骑士
    drg: [
      {
        ids: ["405E"],
        name: "高跳",
        type: "cd",
        duration: 30,
        reminders: [
          { tts: "高跳" },
        ],
      },
      {
        ids: ["60"],
        name: "龙炎冲",
        type: "cd",
        duration: 120,
        reminders: [
          { tts: "龙炎冲" },
        ],
      },
      {
        ids: ["55"],
        name: "猛枪",
        type: "cd",
        duration: 55,
        reminders: [
          { tts: "舍身" },
        ],
      },
      {
        ids: ["DE5"],
        name: "战斗连祷",
        type: "cd",
        duration: 115,
        reminders: [
          { tts: "连祷" },
        ],
      },
      {
        ids: ["58", "64AC"],
        name: "樱花怒放",
        type: "dot",
        duration: 20,
        reminders: [
          { tts: "樱花连" },
        ],
      },
    ],
    // 忍者
    nin: [
      {
        ids: ["406D"],
        name: "分身之术",
        type: "cd",
        duration: 85,
        reminders: [
          { tts: "分身" },
        ],
      },
      {
        ids: ["8D2"],
        name: "攻其不备",
        type: "cd",
        duration: 55,
        reminders: [
          { tts: "背刺" },
        ],
      },
      {
        ids: ["1CEB"],
        name: "天地人",
        type: "cd",
        duration: 115,
        reminders: [
          { tts: "天地人" },
        ],
      },
      {
        ids: ["8C8"],
        name: "夺取",
        type: "cd",
        duration: 120,
        reminders: [
          { tts: "夺取" },
        ],
      },
    ],
    // 武僧
    mnk: [
      {
        ids: ["1CE3"],
        name: "红莲极意",
        type: "cd",
        duration: 60,
        reminders: [
          { tts: "红莲" },
        ],
      },
      {
        ids: ["1CE4"],
        name: "义结金兰 ",
        type: "cd",
        duration: 120,
        reminders: [
          { tts: "结义" },
        ],
      },
      {
        ids: ["64A6"],
        name: "疾风极意",
        type: "cd",
        duration: 90,
        reminders: [
          { tts: "疾风" },
        ],
      },
      {
        ids: ["42"],
        name: "Dot",
        type: "dot",
        duration: 15,
        reminders: [
          { tts: "破碎拳" },
        ],
      },
      {
        ids: ["1CE2"],
        name: "金刚极意",
        type: "cd",
        duration: 120,
        reminders: [
          { tts: "金刚" },
        ],
      },
    ],
    // 武士
    sam: [
      {
        ids: ["1D4B"],
        name: "明镜止水",
        type: "cd",
        duration: 55,
        reminders: [
          { tts: "明镜" },
        ],
      },
      {
        ids: ["1D48", "4061"],
        name: "必杀剑·闪影|必杀剑·红莲",
        type: "cd",
        duration: 115,
        reminders: [
          { tts: "闪影" },
        ],
      },
      {
        ids: ["4062"],
        name: "意气冲天",
        type: "cd",
        duration: 115,
        reminders: [
          { tts: "意气冲天" },
        ],
      },
      {
        ids: ["4064", "4065", "4066", "64B6"],
        name: "燕回返",
        type: "cd",
        duration: 55,
        reminders: [
          { tts: "燕返" },
        ],
      },
      {
        ids: ["1D41"],
        name: "彼岸花",
        type: "cd",
        duration: 55,
        reminders: [
          { tts: "彼岸花" },
        ],
      },
    ],
    // 钐镰客
    rpr: [
      {
        ids: ["5F55"],
        name: "神秘环",
        type: "cd",
        duration: 115,
        reminders: [
          { tts: "神秘环" },
        ],
      },
      {
        ids: ["5F49"],
        name: "暴食",
        type: "cd",
        duration: 60,
        reminders: [
          { tts: "暴食" },
        ],
      },
      {
        ids: ["5F3A"],
        name: "死亡之影",
        type: "dot",
        duration: 25,
        reminders: [
          { tts: "补Dot" },
        ],
      },
    ],
  },

  // --------------------------------------------------------------
  // 远程物理职业
  // --------------------------------------------------------------
  ranged: {
    // 舞者
    dnc: [
      {
        ids: ["3E7D"],
        name: "标准舞步",
        type: "cd",
        duration: 30,
        reminders: [
          { tts: "小舞" },
        ],
      },
      {
        ids: ["3E7E"],
        name: "技巧舞步",
        type: "cd",
        duration: 115,
        reminders: [
          { tts: "大舞" },
        ],
      },
      {
        ids: ["3E8D"],
        name: "百花争艳",
        type: "cd",
        duration: 55,
        reminders: [
          { tts: "百花" },
        ],
      },
    ],
    // 吟游诗人
    brd: [
      {
        ids: ["DEA"],
        name: "侧风诱导箭",
        type: "cd",
        duration: 60,
        reminders: [
          { tts: "侧风" },
        ],
      },
      {
        ids: ["76"],
        name: "战斗之声",
        type: "cd",
        duration: 115,
        reminders: [
          { tts: "战歌" },
        ],
      },
      {
        ids: ["6B"],
        name: "纷乱箭",
        type: "cd",
        duration: 120,
        reminders: [
          { tts: "纷乱" },
        ],
      },
      {
        ids: ["65"],
        name: "猛者强击",
        type: "cd",
        duration: 115,
        reminders: [
          { tts: "猛者" },
        ],
      },
      {
        ids: ["DE6"],
        name: "九天连箭",
        type: "cd",
        duration: 15,
        reminders: [
          { tts: "九天" },
        ],
      },
      {
        ids: ["DE7"],
        name: "放浪神的小步舞曲",
        type: "dot",
        reminders: [
          { at: 43, tts: "切歌" },
          { at: 75, tts: "旅神歌" },
        ],
      },
      {
        ids: ["64", "71", "1CEE", "1CEF", "DE8"],
        name: "Dot",
        type: "dot",
        duration: 40,
        reminders: [
          { tts: "补Dot" },
        ],
      },
      {
        ids: ["72"],
        name: "贤者的叙事谣",
        type: "dot",
        reminders: [
          { at: 33, tts: "切歌" },
          { at: 85, tts: "贤者歌" },
        ],
      },
      {
        ids: ["74"],
        name: "军神的叙事谣",
        type: "dot",
        reminders: [
          { at: 43, tts: "切歌" },
          { at: 75, tts: "军神歌" },
        ],
      },
      {
        ids: ["1CF0"],
        name: "大地神",
        type: "cd",
        duration: 115,
        reminders: [
          { tts: "大地神" },
        ],
      },
    ],
    // 机工士
    mch: [
      {
        ids: ["1CF6"],
        name: "枪管加热",
        type: "cd",
        duration: 115,
        reminders: [
          { tts: "枪管加热" },
        ],
      },
      {
        ids: ["4074"],
        name: "空气锚",
        type: "cd",
        duration: 35,
        reminders: [
          { tts: "空气锚" },
        ],
      },
      {
        ids: ["B3C"],
        name: "整备",
        type: "cd",
        duration: 55,
        reminders: [
          { tts: "整备" },
        ],
      },
      {
        ids: ["4072", "4073"],
        name: "钻头|毒菌冲击",
        type: "cd",
        duration: 20,
        reminders: [
          { tts: "钻头" },
        ],
      },
      {
        ids: ["64BC"],
        name: "回转飞锯",
        type: "cd",
        duration: 55,
        reminders: [
          { tts: "回转飞锯" },
        ],
      },
    ],
  },

  // --------------------------------------------------------------
  // 远程魔法职业
  // --------------------------------------------------------------
  caster: {
    // 黑魔法师
    blm: [
      {
        ids: ["DF6"],
        name: "激情咏唱",
        type: "dot",
        duration: 30,
        reminders: [
          { tts: "激情" },
        ],
      },
      {
        ids: ["1CFD"],
        name: "三连咏唱",
        type: "cd",
        duration: 60,
        reminders: [
          { tts: "三连魔" },
        ],
      },
      {
        ids: ["DF5"],
        name: "黑魔纹",
        type: "cd",
        duration: 120,
        reminders: [
          { tts: "黑魔纹" },
        ],
      },
      {
        ids: ["64C4"],
        name: "详述",
        type: "cd",
        duration: 120,
        reminders: [
          { tts: "详述" },
        ],
      },
      {
        ids: ["9E"],
        name: "魔泉",
        type: "cd",
        duration: 120,
        reminders: [
          { tts: "魔泉" },
        ],
      },
    ],
    // 赤魔法师
    rdm: [
      {
        ids: ["1D52"],
        name: "短兵相接",
        type: "dot",
        duration: 35,
        reminders: [
          { tts: "冲锋" },
        ],
      },
      {
        ids: ["1D60"],
        name: "鼓励",
        type: "cd",
        duration: 115,
        reminders: [
          { tts: "鼓励" },
        ],
      },
      {
        ids: ["1D5F"],
        name: "六分反击",
        type: "cd",
        duration: 35,
        reminders: [
          { tts: "六分反击" },
        ],
      },
      {
        ids: ["1D5D"],
        name: "飞刺",
        type: "cd",
        duration: 25,
        reminders: [
          { tts: "飞刺" },
        ],
      },
      {
        ids: ["1D5B", "408F"],
        name: "移转|交剑",
        type: "dot",
        duration: 35,
        reminders: [
          { tts: "后跳" },
        ],
      },
      {
        ids: ["1D61"],
        name: "倍增",
        type: "cd",
        duration: 105,
        reminders: [
          { tts: "倍增" },
        ],
      },
      {
        ids: ["1D5E"],
        name: "促进",
        type: "dot",
        duration: 55,
        reminders: [
          { tts: "促进" },
        ],
      },
    ],
    // 召唤师
    smn: [
      {
        ids: ["407C", "407E"],
        name: "能量吸收|能量抽取",
        type: "cd",
        duration: 60,
        reminders: [
          { tts: "能量吸收" },
        ],
      },
      {
        ids: ["1D03", "64E7"],
        name: "龙神附体|不死鸟附体",
        type: "cd",
        duration: 55,
        reminders: [
          { tts: "附体" },
        ],
      },
      {
        ids: ["64C7"],
        name: "守护之光",
        type: "cd",
        duration: 120,
        reminders: [
          { tts: "灵护" },
        ],
      },
    ],
  },

  // --------------------------------------------------------------
  // 治疗职业
  // --------------------------------------------------------------
  healer: {
    // 通用
    common: [
      {
        ids: ["4094", "409C", "40AA", "5EFA", "79", "84", "48C8", "45C9", "E0F", "E18", "5EE5", "5EF4"],
        name: "奶妈Dot",
        type: "dot",
        duration: 25,
        reminders: [
          { tts: "补Dot" },
        ],
      },
    ],
    // 白魔法师
    whm: [
      {
        ids: ["DF2"],
        name: "神名",
        type: "cd",
        duration: 60,
        reminders: [
          { tts: "神名" },
        ],
      },
      {
        ids: ["DF3"],
        name: "法令",
        type: "cd",
        duration: 40,
        reminders: [
          { tts: "法令" },
        ],
      },
      {
        ids: ["6506"],
        name: "礼仪之铃",
        type: "cd",
        duration: 180,
        reminders: [
          { tts: "礼仪之铃" },
        ],
      },
      {
        ids: ["1D08"],
        name: "神祝祷",
        type: "cd",
        duration: 30,
        reminders: [
          { tts: "神祝祷" },
        ],
      },
      {
        ids: ["6505"],
        name: "水流幕",
        type: "cd",
        duration: 60,
        reminders: [
          { tts: "水流幕" },
        ],
      },
      {
        ids: ["88"],
        name: "神速咏唱",
        type: "cd",
        duration: 120,
        reminders: [
          { tts: "神速咏唱" },
        ],
      },
    ],
    // 贤者
    sge: [
      {
        ids: ["5EF9"],
        name: "发炎",
        type: "cd",
        duration: 40,
        reminders: [
          { tts: "发炎" },
        ],
      },
      {
        ids: ["5EE6"],
        name: "拯救",
        type: "cd",
        duration: 90,
        reminders: [
          { tts: "拯救" },
        ],
      },
      {
        ids: ["5EEE"],
        name: "自生",
        type: "cd",
        duration: 60,
        reminders: [
          { tts: "自生" },
        ],
      },
      {
        ids: ["5EED"],
        name: "消化",
        type: "cd",
        duration: 30,
        reminders: [
          { tts: "消化" },
        ],
      },
      {
        ids: ["5EEC"],
        name: "活化",
        type: "cd",
        duration: 90,
        reminders: [
          { tts: "活化" },
        ],
      },
      {
        ids: ["5EF1"],
        name: "输血",
        type: "cd",
        duration: 120,
        reminders: [
          { tts: "输血" },
        ],
      },
      {
        ids: ["5EF7"],
        name: "泛输血",
        type: "cd",
        duration: 120,
        reminders: [
          { tts: "泛输血" },
        ],
      },
      {
        ids: ["5EFE"],
        name: "魂灵风息",
        type: "cd",
        duration: 120,
        reminders: [
          { tts: "魂灵风息" },
        ],
      },
      {
        ids: ["5EF6"],
        name: "整体论",
        type: "cd",
        duration: 120,
        reminders: [
          { tts: "整体论" },
        ],
      },
      {
        ids: ["5EF5"],
        name: "根素",
        type: "cd",
        duration: 90,
        reminders: [
          { tts: "根素" },
        ],
      },
    ],
    // 学者
    sch: [
      {
        ids: ["1D0A"],
        name: "深谋远虑之策",
        type: "cd",
        duration: 45,
        reminders: [
          { tts: "绿帽" },
        ],
      },
      {
        ids: ["1D0C"],
        name: "连环计",
        type: "cd",
        duration: 115,
        reminders: [
          { tts: "连环计" },
        ],
      },
      {
        ids: ["A6"],
        name: "以太超流",
        type: "cd",
        duration: 60,
        reminders: [
          { tts: "以太" },
        ],
      },
      {
        ids: ["650B"],
        name: "生命回生法",
        type: "cd",
        duration: 60,
        reminders: [
          { tts: "回生" },
        ],
      },
    ],
    // 占星术士
    ast: [
      {
        ids: ["40A8"],
        name: "占卜",
        type: "cd",
        duration: 115,
        reminders: [
          { tts: "占卜" },
        ],
      },
      {
        ids: ["1D0F"],
        name: "地星",
        type: "cd",
        duration: 55,
        reminders: [
          { tts: "地星" },
        ],
      },
      {
        ids: ["6511"],
        name: "擢升",
        type: "cd",
        duration: 60,
        reminders: [
          { tts: "擢升" },
        ],
      },
      {
        ids: ["E1E"],
        name: "先天",
        type: "cd",
        duration: 40,
        reminders: [
          { tts: "先天" },
        ],
      },
      {
        ids: ["1D13"],
        name: "小奥秘卡",
        type: "cd",
        duration: 60,
        reminders: [
          { tts: "小奥秘卡" },
        ],
      },
      {
        ids: ["E16"],
        name: "光速",
        type: "cd",
        duration: 90,
        reminders: [
          { tts: "光速" },
        ],
      },
    ],
  },
};
