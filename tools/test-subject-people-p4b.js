/* 驗證 subjects/people-p4b/ 通過 ContentLoader schema、抽題正常（schema 2.0） */
'use strict';
const fs = require('fs');
const vm = require('vm');

const store = {};
const localStorage = {
  getItem: k => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
const sandbox = {
  window: {}, localStorage, console, Promise, Number, Math, Date,
  Object, Array, JSON, Error, Set
};
sandbox.global = sandbox;
vm.createContext(sandbox);

['assets/js/storage.js', 'assets/js/content-loader.js',
 'assets/js/weakness-analyzer.js', 'assets/js/exam-engine.js'
].forEach(f => vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f }));

const SG = sandbox.window.StudyGuy;

// 讀取 subjects/people-p4b/ 內所有 lesson JSON
const lessons = [];
fs.readdirSync('subjects/people-p4b').forEach(f => {
  if (!f.endsWith('.json')) return;
  if (f === 'subject.json') return;
  const lesson = JSON.parse(fs.readFileSync('subjects/people-p4b/' + f, 'utf8'));
  SG.ContentLoader.validateLesson(lesson, 'people-p4b', f);
  lessons.push(lesson);
});

console.log('✓ schema OK，課數:', lessons.length);

const upsert = SG.Storage.upsertSubject({
  subjectId: 'people-p4b',
  subjectName: '常識（人民）',
  grade: '小四下',
  _newLessons: lessons
});
console.log('✓ upsert added:', upsert.stats.added, 'updated:', upsert.stats.updated);

const s = SG.Storage.getSubject('people-p4b');
const all = SG.Storage.flattenLessons(s);
console.log('✓ flatten 後課數:', all.length, '總題數:', all.reduce((n, l) => n + l.questions.length, 0));

const quiz = SG.Exam.buildQuiz(s, { total: 25 });
const sN = quiz.filter(q => q.type === 'single').length;
const mN = quiz.filter(q => q.type === 'multiple').length;
const byL = {};
quiz.forEach(q => { byL[q.lessonId] = (byL[q.lessonId] || 0) + 1; });
console.log('✓ 抽 25 題, single:', sN, 'multi:', mN, '課別分佈:', byL);
