/* ===== Content Loader 模組 =====
   負責：
   - 驗證 subject.json 與 lesson 檔的 schema
   - 將「subject + lessons」合成完整科目物件並寫入 Storage
   - 提供匯入錯誤詳細訊息（檔案／欄位）
*/
(function () {
  'use strict';
  const SG = window.StudyGuy = window.StudyGuy || {};

  const SUPPORTED_SCHEMA = ['2.0'];
  const VALID_QUESTION_TYPES = ['single', 'multiple'];

  // 驗證錯誤類別
  function ValidationError(message, location) {
    this.name = 'ValidationError';
    this.message = '[' + (location || '?') + '] ' + message;
    this.location = location;
  }
  ValidationError.prototype = Object.create(Error.prototype);

  function assert(cond, msg, loc) {
    if (!cond) throw new ValidationError(msg, loc);
  }

  // ===== 驗證 lesson 檔（schema 2.0）=====
  // schema 2.0：lesson 自包含 subjectId，無需 subject.json
  function validateLesson(les, expectedSubjectId, fileLabel) {
    var loc = fileLabel || (les && les.lessonId ? les.lessonId + '.json' : 'lesson.json');
    assert(les && typeof les === 'object', '不是有效的 JSON 物件', loc);
    assert(SUPPORTED_SCHEMA.indexOf(les.schemaVersion) >= 0,
      '不支援的 schemaVersion: ' + les.schemaVersion + '（僅支援 2.0）', loc);
    assert(typeof les.subjectId === 'string' && les.subjectId.trim(), 'subjectId 必填', loc);
    if (expectedSubjectId) {
      assert(les.subjectId === expectedSubjectId,
        'subjectId 不一致：期望 ' + expectedSubjectId + '，實際 ' + les.subjectId, loc);
    }
    assert(typeof les.lessonId === 'string' && les.lessonId.trim(), 'lessonId 必填', loc);
    assert(typeof les.lessonName === 'string' && les.lessonName.trim(), 'lessonName 必填', loc);
    assert(typeof les.lessonOrder === 'number' && Number.isFinite(les.lessonOrder),
      'lessonOrder 必填，必須為數字', loc);
    // notes
    assert(les.notes && typeof les.notes === 'object', 'notes 必填', loc);
    assert(typeof les.notes.summary === 'string' && les.notes.summary.trim(),
      'notes.summary 必填', loc);
    assert(Array.isArray(les.notes.keyPoints) && les.notes.keyPoints.length > 0,
      'notes.keyPoints 至少一條', loc);
    if (les.notes.sections != null) {
      assert(Array.isArray(les.notes.sections), 'notes.sections 必須是陣列', loc);
      les.notes.sections.forEach(function (sec, si) {
        var sl = loc + ' > notes.sections[' + si + ']';
        assert(sec && typeof sec === 'object', '不是物件', sl);
        assert(typeof sec.title === 'string' && sec.title.trim(), 'title 必填', sl);
        assert(Array.isArray(sec.points) && sec.points.length > 0, 'points 至少一條', sl);
        if (sec.icon != null) assert(typeof sec.icon === 'string', 'icon 必須是字串', sl);
      });
    }
    if (les.notes.highlights != null) {
      assert(Array.isArray(les.notes.highlights), 'notes.highlights 必須是陣列', loc);
      les.notes.highlights.forEach(function (h, hi) {
        var hl = loc + ' > notes.highlights[' + hi + ']';
        assert(h && typeof h === 'object', '不是物件', hl);
        assert(typeof h.title === 'string' && h.title.trim(), 'title 必填', hl);
        assert(Array.isArray(h.points) && h.points.length > 0, 'points 至少一條', hl);
      });
    }
    // questions
    assert(Array.isArray(les.questions), 'questions 必須是陣列', loc);
    var qIds = {};
    les.questions.forEach(function (q, qi) {
      validateQuestion(q, qi, loc, qIds);
    });
    return {
      questionCount: les.questions.length,
      warnings: les.questions.length < 5
        ? ['題數少於 5（' + les.questions.length + '），建議補充']
        : []
    };
  }

  function validateQuestion(q, qi, loc, idMap) {
    const ql = loc + ' > questions[' + qi + ']';
    assert(q && typeof q === 'object', '不是物件', ql);
    assert(typeof q.id === 'string' && q.id.trim(), 'id 必填', ql);
    assert(!idMap[q.id], '重複 id: ' + q.id, ql);
    idMap[q.id] = true;
    assert(VALID_QUESTION_TYPES.indexOf(q.type) >= 0,
      'type 必須為 single 或 multiple', ql);
    assert(typeof q.question === 'string' && q.question.trim(), 'question 必填', ql);
    assert(Array.isArray(q.options) && q.options.length >= 3,
      'options 至少 3 項', ql);
    assert(Array.isArray(q.answer) && q.answer.length >= 1,
      'answer 至少一項', ql);
    if (q.type === 'single') {
      assert(q.answer.length === 1, '單選題 answer 必須剛好 1 項', ql);
    }
    q.answer.forEach(function (idx) {
      assert(Number.isInteger(idx) && idx >= 0 && idx < q.options.length,
        'answer index 越界: ' + idx, ql);
    });
    assert(typeof q.explanation === 'string' && q.explanation.trim(),
      'explanation 必填', ql);
  }

  // ===== 從 File 物件陣列匯入（schema 2.0）=====
  // opts 必須提供：{ targetSubjectId, subjectName, grade }
  // 用戶在管理頁的標籤 UI 選擇後傳入。
  // 拖入的全部都應該是 lesson 檔，subject.json 已不再使用（會被略過並警告）。
  function importFromFiles(fileList, opts) {
    opts = opts || {};
    if (!opts.targetSubjectId) {
      return Promise.reject(new ValidationError('未指定 subjectId（請先選擇年級／學期／科目）', '匯入'));
    }
    if (!opts.subjectName) {
      return Promise.reject(new ValidationError('未指定 subjectName', '匯入'));
    }
    if (!opts.grade) {
      return Promise.reject(new ValidationError('未指定 grade', '匯入'));
    }
    return readAllFiles(fileList).then(function (parsed) {
      var lessons = [];
      var warnings = [];
      var skipped = [];
      parsed.forEach(function (p) {
        var lower = p.name.toLowerCase();
        if (lower.endsWith('subject.json')) {
          skipped.push(p.name);
          return;
        }
        // 標籤匯入時，覆寫 lesson 內 subjectId 為使用者選擇的值
        var lesson = Object.assign({}, p.json, { subjectId: opts.targetSubjectId });
        var v = validateLesson(lesson, opts.targetSubjectId, p.name);
        v.warnings.forEach(function (w) { warnings.push(p.name + ': ' + w); });
        lessons.push(lesson);
      });
      if (skipped.length) {
        warnings.push('已略過 ' + skipped.length + ' 個 subject.json（schema 2.0 不再使用，僅需匯入課別檔）');
      }
      if (!lessons.length) {
        throw new ValidationError('沒有任何有效的課別檔', '匯入');
      }
      var input = {
        subjectId: opts.targetSubjectId,
        subjectName: opts.subjectName,
        grade: opts.grade,
        _newLessons: lessons
      };
      var upsertResult = SG.Storage.upsertSubject(input);
      return {
        subject: upsertResult.subject,
        warnings: warnings,
        stats: upsertResult.stats
      };
    });
  }

  function readAllFiles(fileList) {
    const arr = Array.prototype.slice.call(fileList || []);
    return Promise.all(arr.map(function (f) {
      return readOne(f).then(function (text) {
        let json;
        try { json = JSON.parse(text); }
        catch (e) {
          throw new ValidationError('JSON 格式錯誤: ' + e.message, f.name);
        }
        // File.name 取最末段
        const baseName = (f.name || '').split(/[\\/]/).pop();
        return { name: baseName, json: json };
      });
    }));
  }

  function readOne(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsText(file);
    });
  }

  // 對外 API
  SG.ContentLoader = {
    validateLesson: validateLesson,
    importFromFiles: importFromFiles,
    ValidationError: ValidationError
  };
})();
