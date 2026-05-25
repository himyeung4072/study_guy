/* lint-lesson.js — 質素規則檢查（補 test-stage2.js 未覆蓋的 prompt 規則）
 * 用法：
 *   node tools/lint-lesson.js subjects/people-p4b/L12.json   （單檔）
 *   node tools/lint-lesson.js subjects/people-p4b/            （整個資料夾）
 *
 * 可選參數：
 *   --grade=p4   年級代碼（p2/p3/p4/p5/p6），預設 p4
 *
 * 退出碼：0 = 全綠，1 = 有 error
 */
'use strict';
const fs = require('fs');
const path = require('path');

// ─── 設定 ───
const GRADE_CONFIG = {
  p2: { maxSentLen: 20, singleRange: [23, 25], multiRange: [0, 2], reverseMax: 2 },
  p3: { maxSentLen: 20, singleRange: [23, 25], multiRange: [0, 2], reverseMax: 2 },
  p4: { maxSentLen: 30, singleRange: [20, 22], multiRange: [3, 5], reverseMax: 4 },
  p5: { maxSentLen: 30, singleRange: [20, 22], multiRange: [3, 5], reverseMax: 4 },
  p6: { maxSentLen: 40, singleRange: [19, 20], multiRange: [5, 6], reverseMax: 7 }
};

// 粵語口語黑名單（只掃 AI 自撰欄位）
const CANTONESE_BLACKLIST = [
  '嘅', '啲', '咩', '邊個', '點解', '俾', '嚟', '哋',
  '冇', '咗', '做嘢', '唔', '喺', '佢'
];

const SOURCE_REGEX = /^第\d+課 P\.\d+/;

// ─── 解析參數 ───
const args = process.argv.slice(2);
let gradeName = 'p4';
const paths = [];
args.forEach(a => {
  if (a.startsWith('--grade=')) gradeName = a.split('=')[1];
  else paths.push(a);
});
if (paths.length === 0) {
  console.error('用法: node tools/lint-lesson.js <file|dir> [--grade=p4]');
  process.exit(1);
}
const cfg = GRADE_CONFIG[gradeName];
if (!cfg) {
  console.error('不支援的年級:', gradeName, '（可用: p2 p3 p4 p5 p6）');
  process.exit(1);
}

// ─── 收集檔案 ───
const files = [];
paths.forEach(p => {
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    fs.readdirSync(p).filter(f => f.endsWith('.json') && f !== 'subject.json')
      .forEach(f => files.push(path.join(p, f)));
  } else {
    files.push(p);
  }
});

// ─── Lint 邏輯 ───
let totalErrors = 0;
let totalWarnings = 0;

files.forEach(filePath => {
  const errors = [];
  const warnings = [];
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const qs = json.questions || [];
  const fname = path.basename(filePath);

  // 1. 難度分佈
  const diff = { easy: 0, medium: 0, hard: 0 };
  qs.forEach(q => { if (q.difficulty) diff[q.difficulty]++; });
  if (diff.easy < 8 || diff.easy > 10) errors.push(`難度 easy=${diff.easy}，應 8–10`);
  if (diff.medium < 10 || diff.medium > 12) errors.push(`難度 medium=${diff.medium}，應 10–12`);
  if (diff.hard < 3 || diff.hard > 5) errors.push(`難度 hard=${diff.hard}，應 3–5`);

  // 2. 單／多選比例
  const singles = qs.filter(q => q.type === 'single').length;
  const multis = qs.filter(q => q.type === 'multiple').length;
  if (singles < cfg.singleRange[0] || singles > cfg.singleRange[1])
    errors.push(`single=${singles}，${gradeName} 應 ${cfg.singleRange[0]}–${cfg.singleRange[1]}`);
  if (multis < cfg.multiRange[0] || multis > cfg.multiRange[1])
    errors.push(`multiple=${multis}，${gradeName} 應 ${cfg.multiRange[0]}–${cfg.multiRange[1]}`);

  // 3. 反向題上限 + 粗體檢查
  const reverseQs = qs.filter(q =>
    /不是|不正確|不屬於|不包括/.test(q.question.replace(/\*\*/g, ''))
  );
  if (reverseQs.length > cfg.reverseMax)
    errors.push(`反向題=${reverseQs.length}，${gradeName} 上限 ${cfg.reverseMax}`);
  reverseQs.forEach(q => {
    if (!/\*\*不\*\*|\*\*不是\*\*|\*\*不正確\*\*|\*\*不屬於\*\*/.test(q.question))
      errors.push(`${q.id} 反向題缺粗體標示「**不**」`);
  });

  // 4. 多選題 answer 組合多樣性
  const multiQs = qs.filter(q => q.type === 'multiple');
  if (multiQs.length >= 2) {
    const combos = multiQs.map(q => JSON.stringify(q.answer));
    const unique = new Set(combos).size;
    // 任兩條不完全相同
    if (unique < combos.length)
      errors.push(`多選題有重複 answer 組合（${unique} 種 / ${combos.length} 條），每條應不同`);
    // 至少 3 種（當 ≥3 條時）
    if (multiQs.length >= 3 && unique < 3)
      errors.push(`多選題 answer 組合只有 ${unique} 種，≥3 條時至少要 3 種`);
  }

  // 5. source 格式
  qs.forEach(q => {
    if (q.source && !SOURCE_REGEX.test(q.source))
      errors.push(`${q.id} source 格式不符：「${q.source}」，應為「第NN課 P.<頁>」`);
  });

  // 6. 粵語口語掃描（summary / explanation / keywords.definition）
  const aiTexts = [];
  if (json.notes && json.notes.summary) aiTexts.push({ field: 'summary', text: json.notes.summary });
  if (json.notes && json.notes.keywords) {
    json.notes.keywords.forEach((kw, i) => {
      if (kw.definition) aiTexts.push({ field: `keywords[${i}].definition`, text: kw.definition });
    });
  }
  qs.forEach(q => {
    if (q.explanation) aiTexts.push({ field: `${q.id}.explanation`, text: q.explanation });
  });
  aiTexts.forEach(({ field, text }) => {
    CANTONESE_BLACKLIST.forEach(word => {
      if (text.includes(word))
        errors.push(`${field} 含粵語口語「${word}」`);
    });
  });

  // 7. summary 句長（按年級）
  if (json.notes && json.notes.summary) {
    // 以句號、分號、換行分句
    const sentences = json.notes.summary.split(/[。；\n]/).filter(s => s.trim());
    sentences.forEach(s => {
      const len = s.replace(/[a-zA-Z0-9\s\(\)（）\-—,，、：:「」]/g, '').length;
      if (len > cfg.maxSentLen)
        warnings.push(`summary 句長 ${len} 字超過 ${gradeName} 上限 ${cfg.maxSentLen}：「${s.trim().slice(0, 20)}…」`);
    });
  }

  // 8. 題數檢查（warning，非 error）
  if (qs.length < 23 || qs.length > 27)
    warnings.push(`題數=${qs.length}，建議 25（容差 23–27）`);

  // ─── 輸出 ───
  if (errors.length || warnings.length) {
    console.log(`\n── ${fname} ──`);
    errors.forEach(e => console.log(`  ❌ ${e}`));
    warnings.forEach(w => console.log(`  ⚠️  ${w}`));
  } else {
    console.log(`✓ ${fname}`);
  }
  totalErrors += errors.length;
  totalWarnings += warnings.length;
});

// ─── 總結 ───
console.log(`\n═══ 結果：${files.length} 檔，${totalErrors} error，${totalWarnings} warning ═══`);
if (totalErrors > 0) process.exit(1);
