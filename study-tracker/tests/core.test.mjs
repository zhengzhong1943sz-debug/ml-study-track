import test from "node:test";
import assert from "node:assert/strict";
import { CHAPTERS, WEEKS } from "../data.js";
import {
  TASKS,
  addActiveDays,
  chapterPercent,
  createDefaultState,
  currentWeek,
  isMastered,
  loadState,
  localDate,
  resumePause,
  saveExam,
  saveState,
  setQuizScore,
  setTask,
  startPause,
  streak,
  validateState,
  weekRange,
} from "../core.js";

test("curriculum contains 31 ordered chapters and 124 valid questions", () => {
  assert.deepEqual(CHAPTERS.map((chapter) => chapter.id), Array.from({ length: 31 }, (_, index) => index + 1));
  assert.equal(CHAPTERS.reduce((sum, chapter) => sum + chapter.quiz.length, 0), 124);
  for (const chapter of CHAPTERS) {
    assert.equal(chapter.goals.length, 3);
    assert.ok(chapter.practice.length > 10);
    assert.equal(chapter.quiz.length, 4);
    for (const question of chapter.quiz) {
      assert.equal(question.options.length, 4);
      assert.equal(new Set(question.options).size, 4);
      assert.ok(question.answer >= 0 && question.answer < 4);
      assert.ok(question.explanation.includes(question.options[question.answer]));
    }
  }
});

test("every chapter is mapped to exactly one of the 16 weeks", () => {
  assert.equal(WEEKS.length, 16);
  const mapped = WEEKS.flatMap((week) => week.chapterIds).sort((a, b) => a - b);
  assert.deepEqual(mapped, Array.from({ length: 31 }, (_, index) => index + 1));
});

test("chapter mastery requires all tasks and a 75 percent quiz score", () => {
  const state = createDefaultState("2026-01-01");
  for (const task of TASKS) setTask(state, 1, task.id, true, "2026-01-02");
  assert.equal(chapterPercent(state, 1), 85);
  assert.equal(isMastered(state, 1), false);
  setQuizScore(state, 1, 75, [], "2026-01-02");
  assert.equal(chapterPercent(state, 1), 96);
  assert.equal(isMastered(state, 1), true);
  assert.equal(state.chapterProgress[1].completedAt, "2026-01-02");
});

test("pause freezes the current week and shifts later ranges", () => {
  const state = createDefaultState("2026-12-28");
  assert.equal(currentWeek(state, "2027-01-04"), 2);
  startPause(state, "2027-01-04");
  assert.equal(currentWeek(state, "2027-01-10"), 1);
  resumePause(state, "2027-01-10");
  assert.equal(addActiveDays(state, 7, "2027-01-10"), "2027-01-11");
  assert.deepEqual(weekRange(state, 2, "2027-01-12"), { start: "2027-01-11", end: "2027-01-17" });
});

test("state can round-trip through browser-like storage", () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
  const state = createDefaultState("2026-07-03");
  setTask(state, 2, "read", true, "2026-07-03");
  saveState(state, storage);
  const loaded = loadState(storage);
  assert.equal(loaded.settings.startDate, "2026-07-03");
  assert.equal(loaded.chapterProgress[2].tasks.read, true);
  assert.equal(validateState(loaded).ok, true);
  assert.equal(validateState({ schemaVersion: 1 }).ok, false);
});

test("streak and stage exam results are recorded", () => {
  const state = createDefaultState("2026-07-01");
  setTask(state, 1, "read", true, "2026-07-01");
  setTask(state, 1, "draw", true, "2026-07-02");
  setTask(state, 1, "practice", true, "2026-07-03");
  assert.equal(streak(state, "2026-07-03"), 3);
  saveExam(state, 6, 80, "2026-07-03");
  assert.equal(state.exams[6].best, 80);
  assert.equal(state.exams[6].passedAt, "2026-07-03");
});

test("localDate uses local calendar values", () => {
  assert.equal(localDate(new Date(2026, 0, 2, 23, 30)), "2026-01-02");
});
