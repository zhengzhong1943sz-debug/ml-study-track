import { CHAPTERS, PARTS, WEEKS } from "./data.js";
import {
  TASKS,
  achievementDefinitions,
  addDays,
  chapterPercent,
  createDefaultState,
  currentWeek,
  encouragement,
  exportState,
  isMastered,
  loadState,
  localDate,
  masteredIds,
  overallPercent,
  partPercent,
  recordActivity,
  refreshAchievements,
  resumePause,
  saveExam,
  saveState,
  setQuizScore,
  setTask,
  startPause,
  streak,
  totalMinutes,
  validateState,
  weekRange,
} from "./core.js";

const app = document.querySelector("#app");
const weekPill = document.querySelector("#week-pill");
const toast = document.querySelector("#toast");
const installButton = document.querySelector("#install-button");
const updateBanner = document.querySelector("#update-banner");
const reloadButton = document.querySelector("#reload-button");
const chapterById = new Map(CHAPTERS.map((chapter) => [chapter.id, chapter]));
const questionById = new Map(CHAPTERS.flatMap((chapter) => chapter.quiz.map((question) => [question.id, { ...question, chapterId: chapter.id }])));

let state = refreshAchievements(loadState());
let activeQuiz = null;
let deferredInstall = null;
let resetArmed = false;
saveState(state);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function partInfo(partId) {
  return PARTS.find((part) => part.id === partId);
}

function partRange(partId) {
  if (partId === "upper") return [1, 12];
  if (partId === "middle") return [13, 23];
  return [24, 31];
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatMinutes(value) {
  if (value < 60) return `${value}分钟`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours}小时${minutes ? `${minutes}分` : ""}`;
}

function route() {
  const raw = location.hash.replace(/^#\/?/, "") || "dashboard";
  const [name, id] = raw.split("/");
  return { name, id };
}

function setActiveNav(name) {
  document.querySelectorAll("[data-route]").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === name);
    if (link.dataset.route === name) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 2800);
}

function commit(message, shouldRender = true) {
  const before = new Set(state.achievements.map((item) => item.id));
  refreshAchievements(state);
  const newAchievement = state.achievements.find((item) => !before.has(item.id));
  saveState(state);
  if (shouldRender) render();
  showToast(newAchievement ? `解锁成就：${newAchievement.title}` : message);
}

function partStyle(partId) {
  return `--part-color:${partInfo(partId).color}`;
}

function progressTrack(value, partId) {
  return `<div class="progress-track" style="--part-color:${partInfo(partId).color}"><span style="--value:${value}%"></span></div>`;
}

function renderPageHead(eyebrow, title, subtitle, action = "") {
  return `<header class="page-head"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p class="subtitle">${escapeHtml(subtitle)}</p></div>${action}</header>`;
}

function renderPartCards() {
  return `<div class="grid-3">${PARTS.map((part) => {
    const [start, end] = partRange(part.id);
    const percent = partPercent(state, start, end);
    const complete = Array.from({ length: end - start + 1 }, (_, index) => start + index).filter((id) => isMastered(state, id)).length;
    return `<article class="card phase-card" style="--part-color:${part.color}">
      <h3>${escapeHtml(part.name)}</h3>
      <div class="meta"><span>第${part.weeks[0]}—${part.weeks[1]}周</span><span>${complete}/${end - start + 1}章</span></div>
      ${progressTrack(percent, part.id)}
      <footer><span>阶段进度</span><strong>${percent}%</strong></footer>
    </article>`;
  }).join("")}</div>`;
}

function renderChapterRow(chapter) {
  const value = chapterPercent(state, chapter.id);
  return `<a class="chapter-row" href="#/chapter/${chapter.id}" style="${partStyle(chapter.part)}">
    <span class="chapter-number">${chapter.id}</span>
    <span><strong>${escapeHtml(chapter.title)}</strong><small>${chapter.minutes}分钟 · ${isMastered(state, chapter.id) ? "已掌握" : "学习中"}</small></span>
    <span class="mini-progress">${value}%${progressTrack(value, chapter.part)}</span>
  </a>`;
}

function nextLearningAction(week) {
  const chapterIds = WEEKS.find((item) => item.week === week).chapterIds;
  for (const id of chapterIds) {
    const progress = state.chapterProgress[id];
    const openTask = TASKS.find((task) => !progress.tasks[task.id]);
    if (openTask) return { chapter: chapterById.get(id), label: openTask.label };
    if (progress.quizBest < 75) return { chapter: chapterById.get(id), label: "完成章节测验" };
  }
  const nextChapter = CHAPTERS.find((chapter) => !isMastered(state, chapter.id));
  return nextChapter ? { chapter: nextChapter, label: "继续下一章" } : null;
}

function renderDashboard() {
  const week = currentWeek(state);
  const current = WEEKS.find((item) => item.week === week);
  const range = weekRange(state, week);
  const percent = overallPercent(state);
  const mastered = masteredIds(state).length;
  const next = nextLearningAction(week);
  const today = localDate();
  const todayRecord = state.checkins[today] || { minutes: 0, mood: 3, note: "" };
  return `
    <section class="card hero">
      <div><p class="eyebrow" style="color:#a7f3d0">第${week}周 · ${escapeHtml(current.goal)}</p>
        <h1>${next ? `下一步：${escapeHtml(next.label)}` : "31章已经全部掌握"}</h1>
        <p>${escapeHtml(encouragement(state))}</p>
        <div class="hero-actions">
          ${next ? `<a class="button" href="#/chapter/${next.chapter.id}">进入第${next.chapter.id}章</a>` : `<a class="button" href="#/stats">查看毕业成果</a>`}
          <a class="button ghost" href="#/plan">查看16周计划</a>
        </div>
      </div>
      <div class="hero-progress"><div class="progress-ring" style="--value:${percent}"><span>${percent}%</span><small>全书进度</small></div></div>
    </section>
    <section class="stat-grid" aria-label="学习概览">
      <article class="card stat"><span>已掌握</span><strong>${mastered}/31</strong><small>章节</small></article>
      <article class="card stat"><span>连续学习</span><strong>${streak(state)}</strong><small>天</small></article>
      <article class="card stat"><span>学习投入</span><strong>${totalMinutes(state)}</strong><small>分钟</small></article>
      <article class="card stat"><span>待复习</span><strong>${Object.keys(state.wrongAnswers).length}</strong><small>道错题</small></article>
    </section>
    <div class="section-title"><h2>三阶段进度</h2><small>看懂 → 设计 → 经营</small></div>
    ${renderPartCards()}
    <div class="section-title"><h2>本周任务</h2><small>${formatDate(range.start)}—${formatDate(range.end)}</small></div>
    <section class="card week-card current" style="${partStyle(current.part)}">
      <div class="week-head"><div><span class="number">WEEK ${week}</span><h3>${escapeHtml(current.goal)}</h3></div><div class="week-dates">${formatDate(range.start)}<br>${formatDate(range.end)}</div></div>
      <div class="deliverable"><strong>本周产出：</strong>${escapeHtml(current.deliverable)}</div>
      <div class="chapter-list">${current.chapterIds.map((id) => renderChapterRow(chapterById.get(id))).join("")}</div>
    </section>
    <div class="section-title"><h2>今日打卡与补卡</h2><small>实际学习日期可以回填</small></div>
    <form class="card pad form-grid" data-form="checkin">
      <div class="field"><label for="checkin-date">学习日期</label><input id="checkin-date" name="date" type="date" value="${today}" max="${today}" required></div>
      <div class="field"><label for="checkin-minutes">学习分钟</label><input id="checkin-minutes" name="minutes" type="number" min="0" max="1440" value="${todayRecord.minutes || 0}" required></div>
      <div class="field"><label for="checkin-mood">学习状态</label><select id="checkin-mood" name="mood">
        ${[[1,"很吃力"],[2,"有些卡顿"],[3,"正常推进"],[4,"状态很好"],[5,"完全投入"]].map(([value,label]) => `<option value="${value}" ${Number(todayRecord.mood) === value ? "selected" : ""}>${label}</option>`).join("")}
      </select></div>
      <div class="field"><label for="checkin-note">复盘笔记</label><textarea id="checkin-note" name="note" placeholder="今天形成了什么判断？还有什么没讲清？">${escapeHtml(todayRecord.note || "")}</textarea></div>
      <div class="button-row"><button class="button" type="submit">保存学习记录</button></div>
    </form>`;
}

function renderPlan() {
  const week = currentWeek(state);
  return `${renderPageHead("16 WEEK ROADMAP", "16周渐进学习计划", "每一周都以可检查的产品输出结束。计划会按照暂停区间自动顺延，章节仍可自由提前学习。")}
    ${renderPartCards()}
    <div class="section-title"><h2>周计划</h2><small>当前第${week}周</small></div>
    <div class="grid-2">${WEEKS.map((item) => {
      const range = weekRange(state, item.week);
      return `<article class="card week-card ${item.week === week ? "current" : ""}" style="${partStyle(item.part)}">
        <div class="week-head"><div><span class="number">WEEK ${item.week}</span><h3>${escapeHtml(item.goal)}</h3></div><div class="week-dates">${formatDate(range.start)}<br>${formatDate(range.end)}</div></div>
        <div class="deliverable"><strong>阶段产出：</strong>${escapeHtml(item.deliverable)}</div>
        <div class="chapter-list">${item.chapterIds.map((id) => renderChapterRow(chapterById.get(id))).join("")}</div>
      </article>`;
    }).join("")}</div>`;
}

function renderChapter(id) {
  const chapter = chapterById.get(Number(id));
  if (!chapter) return renderNotFound();
  const part = partInfo(chapter.part);
  const progress = state.chapterProgress[chapter.id];
  const percent = chapterPercent(state, chapter.id);
  return `<div style="${partStyle(chapter.part)}">
    <div class="breadcrumbs"><a class="text-link" href="#/plan">16周计划</a>　/　${escapeHtml(chapter.partName)}　/　第${chapter.id}章</div>
    <section class="card chapter-hero">
      <p class="eyebrow" style="color:${part.color}">${escapeHtml(chapter.partName)}</p>
      <h1>第${chapter.id}章 ${escapeHtml(chapter.title)}</h1>
      <div class="chapter-meta"><span class="tag">预计${chapter.minutes}分钟</span>${chapter.labels.map((label) => `<span class="tag">${escapeHtml(label)}</span>`).join("")}</div>
      <div class="chapter-progress"><header><span>${isMastered(state, chapter.id) ? "已掌握" : "章节完成度"}</span><strong>${percent}%</strong></header>${progressTrack(percent, chapter.part)}</div>
      ${isMastered(state, chapter.id) ? `<span class="mastery-badge">✓ 已达到掌握标准 · ${escapeHtml(progress.completedAt || "")}</span>` : ""}
    </section>
    <div class="grid-2" style="margin-top:18px">
      <section class="card pad"><div class="section-title" style="margin-top:0"><h2>学习目标</h2><small>3项</small></div><ol class="list-clean">${chapter.goals.map((goal) => `<li>${escapeHtml(goal)}</li>`).join("")}</ol></section>
      <section class="card pad"><div class="section-title" style="margin-top:0"><h2>关键术语</h2><small>先能解释，再做选型</small></div><div class="tag-row">${chapter.keywords.map((keyword) => `<span class="tag">${escapeHtml(keyword)}</span>`).join("")}</div><div class="section-title"><h2>核心判断</h2></div><ul class="list-clean">${chapter.conclusions.slice(0,3).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
    </div>
    <div class="section-title"><h2>五步学习闭环</h2><small>任务85%＋测验15%</small></div>
    <section class="card pad task-list">${TASKS.map((task) => `<label class="task-item">
      <input type="checkbox" data-task="${task.id}" data-chapter="${chapter.id}" ${progress.tasks[task.id] ? "checked" : ""}>
      <span><strong>${escapeHtml(task.label)}</strong><small>${escapeHtml(task.hint)}</small></span><span class="weight">${task.weight}%</span>
    </label>`).join("")}</section>
    <div class="section-title"><h2>实战作业</h2><small>必须形成可评审产物</small></div>
    <section class="practice-box"><strong>本章输出</strong><p>${escapeHtml(chapter.practice)}</p></section>
    <div class="section-title"><h2>章节测验</h2><small>4题 · 75%通过</small></div>
    <section class="card pad"><p class="subtitle" style="margin-top:0">最高成绩：<strong>${progress.quizBest}%</strong>　·　尝试${progress.quizAttempts}次。通过测验且完成五项任务后，本章才标记为掌握。</p><a class="button" href="#/quiz/${chapter.id}">${progress.quizAttempts ? "重新测验" : "开始测验"}</a></section>
  </div>`;
}

function newChapterQuiz(chapterId) {
  const chapter = chapterById.get(chapterId);
  return { type: "chapter", id: chapterId, title: `第${chapterId}章测验`, questions: chapter.quiz, index: 0, selected: null, locked: false, correct: 0, wrongIds: [], finished: false };
}

function seededShuffle(values, seed) {
  const output = [...values];
  let value = seed || 1;
  for (let index = output.length - 1; index > 0; index -= 1) {
    value = (value * 9301 + 49297) % 233280;
    const selected = Math.floor((value / 233280) * (index + 1));
    [output[index], output[selected]] = [output[selected], output[index]];
  }
  return output;
}

function questionsThroughWeek(week) {
  const chapterIds = WEEKS.filter((item) => item.week <= week).flatMap((item) => item.chapterIds);
  return chapterIds.flatMap((id) => chapterById.get(id).quiz.map((question) => ({ ...question, chapterId: id })));
}

function newExam(week) {
  const attempt = state.exams[week].attempts + 1;
  const questions = seededShuffle(questionsThroughWeek(week), week * 101 + attempt * 17).slice(0, 10);
  return { type: "exam", id: week, title: `第${week}周阶段考试`, questions, index: 0, selected: null, locked: false, correct: 0, wrongIds: [], finished: false };
}

function renderQuiz(id, type = "chapter") {
  const numericId = Number(id);
  const key = `${type}:${numericId}`;
  if (!activeQuiz || `${activeQuiz.type}:${activeQuiz.id}` !== key) activeQuiz = type === "exam" ? newExam(numericId) : newChapterQuiz(numericId);
  if (activeQuiz.finished) return renderQuizResult();
  const question = activeQuiz.questions[activeQuiz.index];
  const chapterId = question.chapterId || numericId;
  const chapter = chapterById.get(chapterId);
  const selected = activeQuiz.selected;
  return `<div class="quiz-shell" style="${partStyle(chapter.part)}">
    <div class="breadcrumbs"><a class="text-link" href="${type === "exam" ? "#/review" : `#/chapter/${numericId}`}">退出测验</a>　/　${escapeHtml(activeQuiz.title)}</div>
    <div class="quiz-progress"><span>第${activeQuiz.index + 1}/${activeQuiz.questions.length}题${type === "exam" ? ` · 来自第${chapterId}章` : ""}</span><span>当前答对${activeQuiz.correct}题</span></div>
    ${progressTrack(Math.round((activeQuiz.index / activeQuiz.questions.length) * 100), chapter.part)}
    <section class="card question-card" style="margin-top:16px">
      <p class="eyebrow" style="color:${partInfo(chapter.part).color}">${escapeHtml(chapter.title)}</p>
      <h2>${escapeHtml(question.prompt)}</h2>
      <div class="option-list">${question.options.map((option, index) => {
        const correct = activeQuiz.locked && index === question.answer;
        const wrong = activeQuiz.locked && index === selected && index !== question.answer;
        return `<button class="option ${correct ? "correct" : ""} ${wrong ? "wrong" : ""}" type="button" data-quiz-option="${index}" ${activeQuiz.locked ? "disabled" : ""}><span class="letter">${String.fromCharCode(65 + index)}</span><span>${escapeHtml(option)}</span></button>`;
      }).join("")}</div>
      ${activeQuiz.locked ? `<div class="feedback ${selected === question.answer ? "correct" : "wrong"}"><strong>${selected === question.answer ? "判断正确" : "需要修正"}</strong><br>${escapeHtml(question.explanation)}</div>` : ""}
      <div class="quiz-actions"><span class="subtitle">${activeQuiz.locked ? "先理解解释，再进入下一题。" : "选择后会立即显示答案依据。"}</span>${activeQuiz.locked ? `<button class="button" type="button" data-quiz-next>${activeQuiz.index + 1 === activeQuiz.questions.length ? "查看结果" : "下一题"}</button>` : ""}</div>
    </section>
  </div>`;
}

function renderQuizResult() {
  const total = activeQuiz.questions.length;
  const score = Math.round((activeQuiz.correct / total) * 100);
  const passed = score >= (activeQuiz.type === "exam" ? 80 : 75);
  const target = activeQuiz.type === "exam" ? "#/review" : `#/chapter/${activeQuiz.id}`;
  return `<div class="quiz-shell"><section class="card question-card" style="text-align:center">
    <p class="eyebrow">${activeQuiz.type === "exam" ? "STAGE EXAM" : "CHAPTER QUIZ"}</p>
    <h1>${passed ? "通过" : "本次未通过"}</h1>
    <div class="result-score">${score}%</div>
    <p class="subtitle" style="margin:0 auto 22px">答对${activeQuiz.correct}/${total}题。${passed ? "成绩已经记录，继续把判断落实到实战产出。" : "错题已进入错题本，理解后可以重新挑战。"}</p>
    <div class="button-row" style="justify-content:center"><a class="button" href="${target}">返回</a><button class="button secondary" type="button" data-retry-quiz>重新挑战</button></div>
  </section></div>`;
}

function examUnlocked(week) {
  const ids = WEEKS.filter((item) => item.week <= week).flatMap((item) => item.chapterIds);
  return currentWeek(state) >= week || ids.every((id) => isMastered(state, id));
}

function renderReview() {
  const wrong = Object.values(state.wrongAnswers).sort((a, b) => b.attempts - a.attempts);
  return `${renderPageHead("REVIEW & EXAM", "测验、错题与阶段考试", "章节题用于校准判断，阶段考试用于确认知识能否跨章节迁移。")}
    <div class="section-title"><h2>阶段考试</h2><small>10题 · 80%通过</small></div>
    <div class="exam-grid">${[6, 12, 16].map((week) => {
      const exam = state.exams[week];
      const unlocked = examUnlocked(week);
      return `<article class="card exam-card ${unlocked ? "" : "locked"}"><p class="eyebrow">第${week}周</p><h3>${week === 6 ? "看懂平台" : week === 12 ? "设计平台" : "经营平台与毕业"}</h3><p>最高成绩${exam.best}% · 已尝试${exam.attempts}次${exam.passedAt ? ` · ${exam.passedAt}通过` : ""}</p><a class="button ${unlocked ? "" : "ghost"}" href="${unlocked ? `#/exam/${week}` : "#/review"}" ${unlocked ? "" : "aria-disabled=\"true\""}>${unlocked ? "开始考试" : `第${week}周解锁`}</a></article>`;
    }).join("")}</div>
    <div class="section-title"><h2>错题本</h2><small>${wrong.length}题待复习</small></div>
    ${wrong.length ? `<div class="wrong-list">${wrong.map((item) => {
      const chapter = chapterById.get(item.chapterId);
      return `<article class="card wrong-item"><div><strong>第${chapter.id}章 · ${escapeHtml(chapter.title)}</strong><p>累计答错${item.attempts}次，建议先重读核心判断。</p></div><a class="button secondary compact" href="#/quiz/${chapter.id}">重做测验</a></article>`;
    }).join("")}</div>` : `<section class="card empty-state"><div class="empty-icon">✓</div><h2>当前没有错题</h2><p>完成章节测验后，错误判断会自动进入这里。</p><a class="button" href="#/plan">继续学习</a></section>`}`;
}

function heatmapCells() {
  const cells = [];
  const today = localDate();
  for (let offset = 83; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const item = state.checkins[date] || {};
    const amount = (Number(item.minutes) || 0) + (item.actions?.length || 0) * 15;
    const level = amount === 0 ? 0 : amount < 30 ? 1 : amount < 60 ? 2 : amount < 120 ? 3 : 4;
    cells.push(`<span class="heat-cell ${level ? `l${level}` : ""}" title="${date} · ${amount ? `${amount}学习量` : "未打卡"}"></span>`);
  }
  return cells.join("");
}

function recentWeekMinutes() {
  const today = localDate();
  const rows = [];
  for (let week = 7; week >= 0; week -= 1) {
    const end = addDays(today, -week * 7);
    const start = addDays(end, -6);
    const minutes = Object.entries(state.checkins).filter(([date]) => date >= start && date <= end).reduce((sum, [, item]) => sum + (Number(item.minutes) || 0), 0);
    rows.push({ label: `${formatDate(start)}起`, minutes });
  }
  const max = Math.max(1, ...rows.map((row) => row.minutes));
  return rows.map((row) => `<div class="bar-row"><span>${row.label}</span><div class="bar"><span style="width:${Math.round(row.minutes / max * 100)}%"></span></div><strong>${row.minutes}分</strong></div>`).join("");
}

function renderStats() {
  const earned = new Map(state.achievements.map((item) => [item.id, item]));
  return `${renderPageHead("LEARNING ANALYTICS", "学习统计与成就", "统计只服务于调整学习策略：看进度、识别断点、减少重复误判。")}
    <section class="stat-grid">
      <article class="card stat"><span>全书进度</span><strong>${overallPercent(state)}%</strong><small>加权完成度</small></article>
      <article class="card stat"><span>章节掌握</span><strong>${masteredIds(state).length}</strong><small>共31章</small></article>
      <article class="card stat"><span>连续学习</span><strong>${streak(state)}</strong><small>天</small></article>
      <article class="card stat"><span>累计时长</span><strong>${formatMinutes(totalMinutes(state))}</strong><small>主动记录</small></article>
    </section>
    <div class="section-title"><h2>近12周学习热力图</h2><small>颜色越深，学习投入越高</small></div>
    <section class="card pad"><div class="heatmap" aria-label="学习热力图">${heatmapCells()}</div></section>
    <div class="section-title"><h2>近8周学习时长</h2><small>分钟</small></div>
    <section class="card pad bar-list">${recentWeekMinutes()}</section>
    <div class="section-title"><h2>成就</h2><small>${earned.size}/${achievementDefinitions().length}项</small></div>
    <div class="achievement-grid">${achievementDefinitions().map((definition) => `<article class="card achievement ${earned.has(definition.id) ? "" : "locked"}"><span class="achievement-icon">${earned.has(definition.id) ? "✓" : "○"}</span><h3>${escapeHtml(definition.title)}</h3><p>${escapeHtml(definition.description)}</p>${earned.has(definition.id) ? `<small>解锁于${new Date(earned.get(definition.id).earnedAt).toLocaleDateString("zh-CN")}</small>` : `<small>尚未解锁</small>`}</article>`).join("")}</div>`;
}

function renderSettings() {
  const paused = Boolean(state.settings.pausedAt);
  return `${renderPageHead("SETTINGS & BACKUP", "计划与数据设置", "全部数据只保存在当前浏览器。请定期导出备份，换设备时再导入。")}
    <section class="card settings-section"><h2>学习排期</h2>
      <form data-form="start-date" class="form-grid"><div class="field"><label for="start-date">16周计划开始日期</label><input id="start-date" name="startDate" type="date" value="${state.settings.startDate}" required><small>修改日期不会清空已有进度。</small></div><div class="button-row" style="align-items:end"><button class="button" type="submit">更新排期</button></div></form>
      <div class="pause-status">${paused ? `计划已从${state.settings.pausedAt}暂停，当前周次不会继续推进。` : `计划运行中，历史累计暂停${state.settings.pauses.length}次。`}</div>
      <button class="button ${paused ? "" : "secondary"}" type="button" data-pause>${paused ? "恢复并自动顺延" : "暂停学习计划"}</button>
    </section>
    <section class="card settings-section"><h2>备份与恢复</h2><p class="subtitle">备份包含章节、测验、错题、学习记录、排期和成就，不包含书籍PDF。</p><div class="button-row"><button class="button" type="button" data-export>导出JSON备份</button><button class="button ghost" type="button" data-import-trigger>导入JSON备份</button><input id="import-file" type="file" accept="application/json,.json" hidden></div></section>
    <section class="card settings-section"><h2>离线与发布</h2><p class="subtitle">安装后可像独立应用一样打开。首次联网加载后，核心页面、课程和测验可离线使用。</p><div class="button-row"><button class="button secondary" type="button" data-install ${deferredInstall ? "" : "disabled"}>${deferredInstall ? "安装到设备" : "当前浏览器暂无安装入口"}</button></div></section>
    <section class="card settings-section danger-zone"><h2>清空学习数据</h2><p class="subtitle">该操作不可撤销。建议先导出JSON备份。</p>${resetArmed ? `<div class="pause-status">请再次确认：所有章节、测验、错题和打卡记录都会被清空。</div><div class="button-row"><button class="button danger" type="button" data-reset-confirm>再次确认并清空</button><button class="button ghost" type="button" data-reset-cancel>取消</button></div>` : `<button class="button danger" type="button" data-reset>重置全部数据</button>`}</section>`;
}

function renderNotFound() {
  return `<section class="card empty-state"><div class="empty-icon">?</div><h1>页面不存在</h1><p>目标页面可能已经移动，请返回学习首页。</p><a class="button" href="#/dashboard">返回首页</a></section>`;
}

function render() {
  const current = route();
  const baseRoute = ["chapter", "quiz", "exam"].includes(current.name) ? (current.name === "exam" || current.name === "quiz" ? "review" : "plan") : current.name;
  setActiveNav(baseRoute);
  weekPill.textContent = state.settings.pausedAt ? `第${currentWeek(state)}周 · 已暂停` : `第${currentWeek(state)}周`;
  if (current.name === "dashboard") app.innerHTML = renderDashboard();
  else if (current.name === "plan") app.innerHTML = renderPlan();
  else if (current.name === "chapter") app.innerHTML = renderChapter(current.id);
  else if (current.name === "quiz") app.innerHTML = renderQuiz(current.id, "chapter");
  else if (current.name === "exam") app.innerHTML = examUnlocked(Number(current.id)) ? renderQuiz(current.id, "exam") : renderReview();
  else if (current.name === "review") app.innerHTML = renderReview();
  else if (current.name === "stats") app.innerHTML = renderStats();
  else if (current.name === "settings") app.innerHTML = renderSettings();
  else app.innerHTML = renderNotFound();
  app.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
}

function finishQuiz() {
  const score = Math.round(activeQuiz.correct / activeQuiz.questions.length * 100);
  if (activeQuiz.type === "chapter") {
    setQuizScore(state, activeQuiz.id, score, activeQuiz.wrongIds);
  } else {
    saveExam(state, activeQuiz.id, score);
    for (const questionId of activeQuiz.wrongIds) {
      const question = questionById.get(questionId);
      const previous = state.wrongAnswers[questionId] || { chapterId: question.chapterId, attempts: 0 };
      state.wrongAnswers[questionId] = { ...previous, attempts: previous.attempts + 1, lastAnsweredAt: new Date().toISOString() };
    }
  }
  activeQuiz.finished = true;
  commit(score >= (activeQuiz.type === "exam" ? 80 : 75) ? "测验通过" : "成绩已记录，错题已加入复习", false);
  render();
}

app.addEventListener("click", async (event) => {
  const option = event.target.closest("[data-quiz-option]");
  if (option && activeQuiz && !activeQuiz.locked) {
    const question = activeQuiz.questions[activeQuiz.index];
    const selected = Number(option.dataset.quizOption);
    activeQuiz.selected = selected;
    activeQuiz.locked = true;
    if (selected === question.answer) activeQuiz.correct += 1;
    else activeQuiz.wrongIds.push(question.id);
    render();
    return;
  }
  if (event.target.closest("[data-quiz-next]") && activeQuiz?.locked) {
    if (activeQuiz.index + 1 === activeQuiz.questions.length) finishQuiz();
    else {
      activeQuiz.index += 1;
      activeQuiz.selected = null;
      activeQuiz.locked = false;
      render();
    }
    return;
  }
  if (event.target.closest("[data-retry-quiz]") && activeQuiz) {
    activeQuiz = activeQuiz.type === "exam" ? newExam(activeQuiz.id) : newChapterQuiz(activeQuiz.id);
    render();
    return;
  }
  if (event.target.closest("[data-pause]")) {
    if (state.settings.pausedAt) resumePause(state);
    else startPause(state);
    commit(state.settings.pausedAt ? "学习计划已暂停" : "学习计划已恢复并顺延");
    return;
  }
  if (event.target.closest("[data-export]")) {
    const blob = new Blob([exportState(state)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ml-platform-study-${localDate()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("学习数据已导出");
    return;
  }
  if (event.target.closest("[data-import-trigger]")) {
    document.querySelector("#import-file")?.click();
    return;
  }
  if (event.target.closest("[data-reset]")) {
    resetArmed = true;
    render();
    return;
  }
  if (event.target.closest("[data-reset-cancel]")) {
    resetArmed = false;
    render();
    return;
  }
  if (event.target.closest("[data-reset-confirm]")) {
    state = createDefaultState();
    activeQuiz = null;
    resetArmed = false;
    commit("学习数据已重置");
    location.hash = "#/dashboard";
    return;
  }
  if (event.target.closest("[data-install]") && deferredInstall) {
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    installButton.hidden = true;
    render();
  }
});

app.addEventListener("change", async (event) => {
  const task = event.target.closest("[data-task]");
  if (task) {
    setTask(state, Number(task.dataset.chapter), task.dataset.task, task.checked);
    commit(task.checked ? "学习任务已打卡" : "已取消该任务");
    return;
  }
  if (event.target.id === "import-file" && event.target.files?.[0]) {
    try {
      const imported = JSON.parse(await event.target.files[0].text());
      const validation = validateState(imported);
      if (!validation.ok) throw new Error(validation.error);
      const mastered = Array.from({ length: 31 }, (_, index) => index + 1).filter((id) => imported.chapterProgress[id].completedAt).length;
      if (window.confirm(`备份包含${mastered}个已完成章节，将整体替换当前浏览器数据。是否继续？`)) {
        state = imported;
        activeQuiz = null;
        commit("备份已导入");
        location.hash = "#/dashboard";
      }
    } catch (error) {
      showToast(`导入失败：${error.message}`);
    } finally {
      event.target.value = "";
    }
  }
});

app.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  if (form.dataset.form === "checkin") {
    const date = String(data.get("date"));
    recordActivity(state, "daily-checkin", date, {
      minutes: Math.max(0, Math.min(1440, Number(data.get("minutes")) || 0)),
      mood: Number(data.get("mood")) || 3,
      note: String(data.get("note") || "").trim(),
    });
    commit(date === localDate() ? "今日学习记录已保存" : `${date}补卡已保存`);
  }
  if (form.dataset.form === "start-date") {
    state.settings.startDate = String(data.get("startDate"));
    commit("16周排期已更新");
  }
});

window.addEventListener("hashchange", () => {
  const current = route();
  if (!["quiz", "exam"].includes(current.name)) activeQuiz = null;
  render();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstall = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  installButton.hidden = true;
});

reloadButton.addEventListener("click", () => location.reload());

if ("serviceWorker" in navigator) {
  const hadServiceWorkerController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.register("./sw.js").then((registration) => {
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && hadServiceWorkerController) updateBanner.hidden = false;
      });
    });
  }).catch(() => {});
}

if (!location.hash) location.hash = "#/dashboard";
else render();
