/** 复训星球 v16-E 版本信息 */
export const APP_VERSION = "v16-E";
export const APP_NAME = "复训星球";
export const APP_TAGLINE = "错题复训清零，家庭陪伴成长。";
export const SW_CACHE_ID = "fuxun-planet-v16e";
export const DEMO_CACHE_BUST = "16e";

export const MODULE_SLOGANS = {
  home: APP_TAGLINE,
  train: "老师课后资料、答案和错题可以导入这里。系统会识别错题，生成一题一屏复训，直到错题清零。",
  checkin: "孩子每天用 3 分钟记录学习、能力、复盘和特别表现。系统会生成成长摘要，供爸爸妈妈优培参考。",
  coach: "先看见努力，再给出方法。",
  profile: "资料、隐私和成长记录，都由你掌控。",
};

/** v16-D3 客户演示引导文案 */
export const PAGE_GUIDES = {
  home: "复训星球不是普通打卡，而是孩子复训、父母优培、积分激励、荣誉沉淀和成长大盘组成的家庭学习成长系统。",
  father: "爸爸在这里看见孩子的关键成长瞬间，把坚持、责任和目标完成转化为积分、奖章和表扬信。",
  fatherReward: "每发一次贺卡、表扬信或奖章，默认消耗 500 优培积分，并进入孩子荣誉室。",
  mother: "妈妈在这里看见孩子的状态、压力和计划，用鼓励卡、荣誉徽章和亲子奖励帮助孩子继续前进。",
  motherCompanion: "陪伴不是额外任务，而是孩子成长路上的能量补给。",
  checkinSpecial: "不只是分数值得记录，坚持、主动、责任和温暖行动，也值得被看见。",
  honor: (name) => `这里不是消息列表，而是 ${name || "孩子"} 的成长资产中心。每一次努力、奖励、奖章和表扬信，都会沉淀成成长记录。`,
};

export const EMPTY_HINTS = {
  trainNoMaterial: "今天还没有导入老师资料。可以粘贴题库、上传 TXT，或用手机拍图开始复训。",
  trainNoMistakes: "太棒了，今天暂时没有错题。你可以继续导入新资料，或查看训练成绩。",
  trainNoScore: "还没有训练记录。导入资料并标记错题后，即可开始一题一屏复训。",
  hearts: "今天还没有新的爱心。完成打卡和复训后，可以邀请爸爸妈妈给你一个鼓励。",
  checkin: "今天还没有完成打卡。花 3 分钟记录一下今天的学习状态吧。",
  poster: "完成打卡后，可以生成一张成长海报，记录今天的进步。",
};