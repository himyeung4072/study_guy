# 課別內容模板（Lesson Template）

本資料夾示範 Study Guy 一個課別檔的最小結構（schema 2.0），**僅供參考／複製用**。

> 詳細格式請參考 `docs/content-format.md`。
> 由 PDF 自動產出 JSON 時請使用 `docs/agent-prompt-pdf-to-md.md`（階段 A）與 `docs/agent-prompt-md-to-json.md`（階段 B）內的提示詞。

## 製作新課別步驟

1. 複製 `L01.json` 到您慣用位置。
2. 編輯內容（subjectId、lessonId、lessonName、lessonOrder、notes、questions）。
3. 不需建立 `subject.json`。schema 2.0 的科目資訊由匯入時的標籤 UI 提供。
4. 把 lesson JSON 拖入 Study Guy 「管理 → 匯入課別」拖放區即可。
5. 同一科目可分多次匯入；只要選相同的年級／學期／科目標籤，新課別會自動合併到同一科目。

## 必填欄位速查

- `schemaVersion`: `"2.0"`
- `subjectId`: 例如 `"people-p4b"`（參考用，匯入時系統會用標籤覆寫）
- `lessonId`: 全科目內唯一，建議 `"L01"`、`"L12"` 等 zero-pad 格式
- `lessonName`: 顯示名稱，例如 `"第12課 香港故事之旅"`
- `lessonOrder`: 排序用整數（例如 12）
- `notes`: `{ summary, keyPoints, sections?, highlights?, keywords?, examples? }`
- `questions`: 至少 5 條（建議 25 條）
