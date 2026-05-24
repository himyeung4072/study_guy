---
inclusion: always
---

# 專案指引

- 繁體中文溝通，程式碼註解用繁體中文
- 文檔存 `docs/`，按類型建子目錄

## 日誌規範

- 記錄於 `docs/log/YYYY-MM-DD.md`，標題：`# YYYY-MM-DD 日誌`，按功能用 `##` 分組
- 格式：
  - `HH:MM - [新增|修改|刪除|更名|移動] 檔案路徑 - 說明`
  - `HH:MM - [DB] 操作描述 - 說明`
  - `HH:MM - [執行] 腳本路徑 - 說明`
  - `HH:MM - [驗證] 項目 - 結果`
- 「檔案路徑」位置只填路徑；非檔案操作改用 `[DB]`、`[執行]`、`[驗證]`
- **時間與日期規則（不可違反）**：首次寫入前執行 `(Get-Date).ToString('yyyy-MM-dd HH:mm')` 取系統時間，每 15 分鐘重取一次。日期部分決定日誌檔名，禁止寫入非當天日期的檔案，禁止自行估算或編造時間。

## 檔案命名（時間一律從系統指令取得）

- `docs/`（排除 `docs/log/` 及核心長期文檔）：`YYYYMMDD-HHMM-描述.副檔名`
- 核心長期文檔免時戳（檔名固定）：`docs/project-overview.md`、`docs/content-format.md`、`docs/TODO.md`、`docs/agent-prompt-pdf-to-json.md`
- Specs 資料夾：`yyyymmdd-hhmm-描述`

## TODO List

- 位置：`docs/TODO.md`，按階段／模組用 `##` 分組，項目用 `- [ ]` / `- [x]`
- 每完成一項即時更新狀態（勾選並標註完成日期）
- 每次專案開始前必須核對：(1) `docs/TODO.md` 與 `docs/log/` 是否同步；(2) 專案實際內容（檔案、結構）是否與 `docs/project-overview.md`、`docs/content-format.md` 一致；發現不一致先報告並修正再繼續工作

## Git

- Remote: `https://github.com/himyeung4072/study_guy/`
- 主分支：`master`；Push：`git push origin master`

## Steering 編寫原則

- 以最少 token 表達完整規範，避免冗長描述

## 審查與分析原則

- 審查時指出問題必須附具體證據（程式碼行號、違反的原則、重現步驟）；無法舉證則回覆「方案可行」
- 涉及 Kiro 功能（hooks、steering、skills、spec、MCP 等）必須先確認實際支援，不可用「如果支援」等不確定措辭；無法確認時須明確標註「待驗證」

## 檔案寫入

- `fsWrite` 單次上限約 50 行；超過時先 `fsWrite` 前段，再 `fsAppend` 逐段補齊，每段不超過 50 行（適用於設計報告、spec、migration SQL 等長文檔）

## 編碼紀律

- 最少 code 解決問題，不加未要求的功能、抽象或「彈性」設計
- 只改需求相關的 code，不順手重構、改格式或刪無關 dead code（發現可提出但不動）
- 自己改動產生的孤立 import/變數/函數須清理，既有的不動
- 多步驟任務先列計劃與驗證標準，逐步確認後才繼續

## 開發流程

- 收到新需求先盤點影響範圍，列出計劃後**必須停止執行**，等待用戶明確回覆「確認」或同等肯定語句才可開始寫 code；禁止自行假設用戶已確認
- 不確定的需求或技術決策，主動向用戶提問，不可自行假設

## 內容生成流程（PDF 課文 → JSON）

兩階段：
1. **階段 A（外部 AI 完成）**：用戶以 `docs/agent-prompt-pdf-to-json.md` 為提示詞，在外部 AI 把掃描 PDF OCR 為 markdown／txt，存放於 `study_source/<學生>/<科目>/*.md`，由用戶人類審閱、修正錯字。
2. **階段 B（Kiro 完成）**：用戶將 `study_source/` 內已校對的 markdown 交給 Kiro。Kiro 依照同一份 `docs/agent-prompt-pdf-to-json.md` 內的質素規則（用詞分級、distractor 三原則、多選打亂、source 統一、explanation 兩句法、題型分布、覆蓋率），把 markdown 轉為 schema 1.1 JSON，輸出到 `subjects/<subjectId>/`。

Kiro 接到「轉為 JSON」類請求時：
- 必先確認 `study_source/` 內目標 markdown 已存在；不存在則提醒用戶。
- 產出後跑 `tools/test-stage2.js` 與對應 subject 驗證腳本（如 `tools/test-subject-<subjectId>.js`），全綠才回報完成。
- 永遠用 `subjects/<subjectId>/` 作正式 JSON 位置，**不**把 JSON 存回 `study_source/`。
