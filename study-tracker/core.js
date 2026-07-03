export const STORAGE_KEY = "ml-platform-study-tracker:v1";
export const SCHEMA_VERSION = 1;
export const TASKS = [
  { id: "read", label: "阅读正文", weight: 20, hint: "完成本章阅读并标出3个关键判断" },
  { id: "draw", label: "重画模型", weight: 15, hint: "不看原图，重画一张架构、流程或状态图" },
  { id: "practice", label: "完成作业", weight: 25, hint: "提交章末实战作业的可检查结果" },
  { id: "teach", label: "讲给别人", weight: 15, hint: "用产品经理语言完成一次15分钟讲解" },
  { id: "review", label: "间隔复习", weight: 10, hint: "一周后使用评审清单复盘" },
];

const ACHIEVEMENT_DEFS = [
  { id: "first", title: "迈出第一步", description: "完成第一次学习打卡" },
  { id: "streak-3", title: "连续推进", description: "连续学习3天" },
  { id: "streak-7", title: "一周成习惯", description: "连续学习7天" },
  { id: "streak-14", title: "稳定节奏", description: "连续学习14天" },
  { id: "streak-30", title: "长期主义", description: "连续学习30天" },
  { id: "master-10", title: "进入状态", description: "掌握10章" },
  { id: "master-20", title: "体系成形", description: "掌握20章" },
  { id: "master-31", title: "全书掌握", description: "掌握全部31章" },
  { id: "upper", title: "看懂平台", description: "完成上篇全部章节" },
  { id: "middle", title: "设计平台", description: "完成中篇全部章节" },
  { id: "lower", title: "经营平台", description: "完成下篇全部章节" },
  { id: "graduate", title: "16周毕业", description: "三次阶段考试通过并掌握全书" },
];

export function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFrom(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function addDays(value, amount) {
  const date = typeof value === "string" ? dateFrom(value) : new Date(value);
  date.setDate(date.getDate() + amount);
  return localDate(date);
}

export function createDefaultState(startDate = localDate()) {
  const chapterProgress = {};
  for (let id = 1; id <= 31; id += 1) {
    chapterProgress[id] = {
      tasks: Object.fromEntries(TASKS.map((task) => [task.id, false])),
      quizBest: 0,
      quizAttempts: 0,
      completedAt: null,
    };
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    settings: { startDate, pauses: [], pausedAt: null, reducedMotion: false },
    chapterProgress,
    checkins: {},
    wrongAnswers: {},
    exams: {
      6: { best: 0, attempts: 0, lastScore: 0, passedAt: null },
      12: { best: 0, attempts: 0, lastScore: 0, passedAt: null },
      16: { best: 0, attempts: 0, lastScore: 0, passedAt: null },
    },
    achievements: [],
  };
}

export function validateState(value) {
  if (!value || typeof value !== "object") return { ok: false, error: "文件不是有效的学习数据" };
  if (value.schemaVersion !== SCHEMA_VERSION) return { ok: false, error: "数据版本不受支持" };
  if (!value.settings?.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(value.settings.startDate)) {
    return { ok: false, error: "缺少有效的学习开始日期" };
  }
  if (!value.chapterProgress || Object.keys(value.chapterProgress).length !== 31) {
    return { ok: false, error: "章节进度不完整" };
  }
  for (let id = 1; id <= 31; id += 1) {
    const progress = value.chapterProgress[id];
    if (!progress?.tasks || TASKS.some((task) => typeof progress.tasks[task.id] !== "boolean")) {
      return { ok: false, error: `第${id}章任务数据无效` };
    }
    if (typeof progress.quizBest !== "number" || progress.quizBest < 0 || progress.quizBest > 100) {
      return { ok: false, error: `第${id}章测验数据无效` };
    }
  }
  return { ok: true };
}

export function loadState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    return validateState(parsed).ok ? parsed : createDefaultState();
  } catch {
    return createDefaultState();
  }
}

export function saveState(state, storage = globalThis.localStorage) {
  storage?.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function recordActivity(state, action, date = localDate(), details = {}) {
  const current = state.checkins[date] || { minutes: 0, mood: 3, note: "", actions: [] };
  current.actions = [...new Set([...(current.actions || []), action])];
  Object.assign(current, details);
  state.checkins[date] = current;
  return state;
}

export function setTask(state, chapterId, taskId, checked, date = localDate()) {
  if (!TASKS.some((task) => task.id === taskId)) throw new Error("Unknown task");
  const progress = state.chapterProgress[chapterId];
  progress.tasks[taskId] = checked;
  if (checked) recordActivity(state, `chapter:${chapterId}:${taskId}`, date);
  updateMastery(state, chapterId, date);
  return state;
}

export function setQuizScore(state, chapterId, score, wrongQuestionIds = [], date = localDate()) {
  const progress = state.chapterProgress[chapterId];
  progress.quizAttempts += 1;
  progress.quizBest = Math.max(progress.quizBest, score);
  for (const questionId of wrongQuestionIds) {
    const previous = state.wrongAnswers[questionId] || { chapterId, attempts: 0 };
    state.wrongAnswers[questionId] = {
      ...previous,
      chapterId,
      attempts: previous.attempts + 1,
      lastAnsweredAt: new Date().toISOString(),
    };
  }
  if (score >= 75) {
    Object.keys(state.wrongAnswers).forEach((questionId) => {
      if (state.wrongAnswers[questionId].chapterId === chapterId && !wrongQuestionIds.includes(questionId)) {
        delete state.wrongAnswers[questionId];
      }
    });
  }
  recordActivity(state, `chapter:${chapterId}:quiz`, date);
  updateMastery(state, chapterId, date);
  return state;
}

export function chapterPercent(state, chapterId) {
  const progress = state.chapterProgress[chapterId];
  const taskScore = TASKS.reduce((sum, task) => sum + (progress.tasks[task.id] ? task.weight : 0), 0);
  return Math.round(taskScore + (Math.min(progress.quizBest, 100) / 100) * 15);
}

export function isMastered(state, chapterId) {
  const progress = state.chapterProgress[chapterId];
  return TASKS.every((task) => progress.tasks[task.id]) && progress.quizBest >= 75;
}

function updateMastery(state, chapterId, date) {
  const progress = state.chapterProgress[chapterId];
  progress.completedAt = isMastered(state, chapterId) ? progress.completedAt || date : null;
}

export function masteredIds(state) {
  return Array.from({ length: 31 }, (_, index) => index + 1).filter((id) => isMastered(state, id));
}

function pauseIntervals(state, today = localDate()) {
  const pauses = [...(state.settings.pauses || [])];
  if (state.settings.pausedAt) pauses.push({ start: state.settings.pausedAt, end: today });
  return pauses;
}

export function isPausedDate(state, value, today = localDate()) {
  return pauseIntervals(state, today).some(({ start, end }) => value >= start && value <= end);
}

export function addActiveDays(state, activeDays, today = localDate()) {
  let value = state.settings.startDate;
  let moved = 0;
  while (moved < activeDays) {
    value = addDays(value, 1);
    if (!isPausedDate(state, value, today)) moved += 1;
  }
  return value;
}

export function weekRange(state, week, today = localDate()) {
  return {
    start: addActiveDays(state, (week - 1) * 7, today),
    end: addActiveDays(state, week * 7 - 1, today),
  };
}

export function currentWeek(state, today = localDate()) {
  if (today < state.settings.startDate) return 1;
  if (state.settings.pausedAt) {
    const pauseStart = state.settings.pausedAt;
    return currentWeek({ ...state, settings: { ...state.settings, pausedAt: null } }, addDays(pauseStart, -1));
  }
  let activeDays = 0;
  let cursor = state.settings.startDate;
  while (cursor < today && activeDays < 112) {
    cursor = addDays(cursor, 1);
    if (!isPausedDate(state, cursor, today)) activeDays += 1;
  }
  return Math.min(16, Math.max(1, Math.floor(activeDays / 7) + 1));
}

export function startPause(state, date = localDate()) {
  if (!state.settings.pausedAt) state.settings.pausedAt = date;
  return state;
}

export function resumePause(state, date = localDate()) {
  if (state.settings.pausedAt) {
    state.settings.pauses.push({ start: state.settings.pausedAt, end: date });
    state.settings.pausedAt = null;
  }
  return state;
}

export function streak(state, today = localDate()) {
  const active = new Set(Object.entries(state.checkins).filter(([, value]) => (value.actions?.length || 0) > 0 || value.minutes > 0).map(([date]) => date));
  let cursor = active.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (active.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function totalMinutes(state) {
  return Object.values(state.checkins).reduce((sum, value) => sum + (Number(value.minutes) || 0), 0);
}

export function overallPercent(state) {
  const total = Array.from({ length: 31 }, (_, index) => chapterPercent(state, index + 1)).reduce((a, b) => a + b, 0);
  return Math.round(total / 31);
}

export function partPercent(state, start, end) {
  const ids = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  return Math.round(ids.reduce((sum, id) => sum + chapterPercent(state, id), 0) / ids.length);
}

export function saveExam(state, week, score, date = localDate()) {
  const exam = state.exams[week];
  exam.attempts += 1;
  exam.lastScore = score;
  exam.best = Math.max(exam.best, score);
  if (score >= 80) exam.passedAt ||= date;
  recordActivity(state, `exam:${week}`, date);
  return state;
}

export function refreshAchievements(state, today = localDate()) {
  const mastered = masteredIds(state);
  const run = streak(state, today);
  const hasActivity = Object.values(state.checkins).some((value) => value.actions?.length || value.minutes > 0);
  const earned = new Set(state.achievements.map((item) => item.id));
  const conditions = {
    first: hasActivity,
    "streak-3": run >= 3,
    "streak-7": run >= 7,
    "streak-14": run >= 14,
    "streak-30": run >= 30,
    "master-10": mastered.length >= 10,
    "master-20": mastered.length >= 20,
    "master-31": mastered.length === 31,
    upper: Array.from({ length: 12 }, (_, i) => i + 1).every((id) => mastered.includes(id)),
    middle: Array.from({ length: 11 }, (_, i) => i + 13).every((id) => mastered.includes(id)),
    lower: Array.from({ length: 8 }, (_, i) => i + 24).every((id) => mastered.includes(id)),
    graduate: mastered.length === 31 && [6, 12, 16].every((week) => state.exams[week].best >= 80),
  };
  for (const definition of ACHIEVEMENT_DEFS) {
    if (conditions[definition.id] && !earned.has(definition.id)) {
      state.achievements.push({ ...definition, earnedAt: new Date().toISOString() });
    }
  }
  return state;
}

export function encouragement(state) {
  const mastered = masteredIds(state).length;
  const run = streak(state);
  const wrong = Object.keys(state.wrongAnswers).length;
  if (mastered === 31) return "你已经把31章连成了一套完整方法。下一步不是继续看，而是用综合方案接受真实评审。";
  if (run >= 14) return `连续${run}天说明节奏已经稳定。今天优先完成一个可检查的输出，不要只增加阅读量。`;
  if (wrong >= 8) return `错题本还有${wrong}题。先解决重复误判，再继续推进新章节，掌握会更扎实。`;
  if (mastered >= 20) return "知识体系已经成形。接下来的经营篇要把技术指标真正换算成成本、SLA和利润。";
  if (mastered >= 10) return "你已经跨过零散知识阶段。继续用领域对象、状态机和指标把判断固定下来。";
  if (mastered > 0) return "进度已经启动。今天完成一个小闭环：读完、画出、讲清，而不是只勾选完成。";
  return "先从第1章建立平台边界。第一周的目标不是记术语，而是能解释平台为什么存在。";
}

export function achievementDefinitions() {
  return ACHIEVEMENT_DEFS;
}

export function exportState(state) {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}
