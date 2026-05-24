# Study Guy 內容格式規範 v2.0

> 版本歷史：
> - **2.0**（2026-05-25）：重大簡化。**廢除 `subject.json`** 與 `units` 結構，改為「一份 JSON = 一課」的扁平模型。科目資訊（subjectId、subjectName、grade）改由匯入時的標籤 UI 提供。lesson 檔新增必填欄位 `lessonOrder`。**不再向後相容 1.0／1.1**。
> - 1.1：notes 加入 sections / highlights（已棄用）
> - 1.0：基本欄位定義（已棄用）

本文件定義 Study Guy 系統的內容檔案格式（schema 2.0）。所有課文重點及試題以一份 JSON 檔代表一課儲存，由系統匯入後使用。

## 一、目錄結構

每個科目使用一個資料夾，內含若干份「一課一檔」的 lesson JSON。**不需 `subject.json`**。

```
subjects/
  <subject-id>/
    <lesson-id>.json
    <lesson-id>.json
    ...
```

範例：

```
subjects/
  people-p4b/
    L12.json
    L13.json
    L14.json
    L16.json
  science-p4b/
    L14.json
    L15.json
    L16.json
    L17.json
```

> 檔名建議使用 lesson id + `.json`，例如 `L12.json`。

## 二、課別檔（lesson JSON）

### 頂層欄位

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `schemaVersion` | string | ✓ | 必為 `"2.0"` |
| `subjectId` | string | ✓ | 該課所屬科目 ID（例：`"people-p4b"`）。匯入時系統會用標籤 UI 選擇的值覆寫此欄位，所以這個欄位主要作人類審稿時的參考 |
| `lessonId` | string | ✓ | 全科目內唯一，建議 `"L12"`、`"L01"` 等 zero-pad 格式（保證字典序與 lessonOrder 一致） |
| `lessonName` | string | ✓ | 課別顯示名稱，例如 `"第12課 香港故事之旅"` |
| `lessonOrder` | number | ✓ | 排序用整數（建議用課數，例 `12`），溫習頁與抽題分佈會以此排序 |
| `notes` | object | ✓ | 溫習筆記（見下） |
| `questions` | array | ✓ | 試題列表（建議 25 題） |

### `notes` 物件

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `summary` | string | ✓ | 課文總覽（建議兩段：30 秒摘要 + 結構分點） |
| `keyPoints` | string[] | ✓ | 重點列表（5–10 條，作為不支援 sections 顯示時的 fallback） |
| `sections` | object[] | ✗ | 分區顯示嘅重點（含 emoji + 小標題），UI 會優先用 sections 而非 keyPoints |
| `highlights` | object[] | ✗ | 加框「重點摘要」小卡（例如「轉口港三大原因」） |
| `keywords` | array | ✗ | 關鍵詞與定義 |
| `examples` | string[] | ✗ | 例子或補充說明 |

#### `sections[]` 物件

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `icon` | string | ✗ | 該區的代表 emoji，例如 `"🔤"`、`"⚔️"` |
| `title` | string | ✓ | 該區標題，例如 `"香港名字的由來"` |
| `points` | string[] | ✓ | 該區的重點列表，至少 1 條 |

#### `highlights[]` 物件

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `title` | string | ✓ | 摘要框標題，例如 `"香港成為轉口港的三大原因"` |
| `points` | string[] | ✓ | 摘要重點，至少 1 條（顯示為有序列表） |

#### `keywords[]` 物件

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `term` | string | ✓ | 詞語 |
| `definition` | string | ✓ | 定義 |

### `questions[]` 物件

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `id` | string | ✓ | 試題唯一 ID，建議格式 `<lessonId>-Q<NN>`，如 `"L12-Q01"` |
| `type` | `"single"` 或 `"multiple"` | ✓ | 單選或多選 |
| `question` | string | ✓ | 題目文字 |
| `options` | string[] | ✓ | 選項列表，至少 3 個（建議 4 個） |
| `answer` | number[] | ✓ | 正確選項的 index（由 0 開始）；單選為單一元素陣列 |
| `explanation` | string | ✓ | 答案解釋 |
| `source` | string | ✗ | 課文出處，建議格式 `"第12課 P.45"` |
| `difficulty` | `"easy"`/`"medium"`/`"hard"` | ✗ | 難度，預設 `"medium"` |
| `tags` | string[] | ✗ | 主題標籤，方便後續分析 |

### 課別檔範例

```json
{
  "schemaVersion": "2.0",
  "subjectId": "people-p4b",
  "lessonId": "L12",
  "lessonName": "第12課 香港故事之旅",
  "lessonOrder": 12,
  "notes": {
    "summary": "本課介紹香港由開埠之前到 1841 年開埠成為轉口港的變化……",
    "keyPoints": [
      "「香港」名稱有四個傳說",
      "「香港」最早見於明朝《粵大記》地圖",
      "..."
    ],
    "sections": [
      {
        "icon": "🔤",
        "title": "香港名字的由來",
        "points": ["「香港」最早見於明朝萬曆年間《粵大記》地圖", "..."]
      }
    ],
    "highlights": [
      {
        "title": "香港成為轉口港的三大原因",
        "points": ["地理位置優越——位於中國南海沿岸", "..."]
      }
    ],
    "keywords": [
      { "term": "開埠", "definition": "開放港口讓外國商船進來進行貿易。" }
    ],
    "examples": ["西貢鹽田梓四面環海，居民利用海水曬鹽。"]
  },
  "questions": [
    {
      "id": "L12-Q01",
      "type": "single",
      "question": "「香港」最早見於哪一本書的地圖？",
      "options": ["《粵大記》", "《明史》", "《香港志》", "《廣東通志》"],
      "answer": [0],
      "explanation": "答案是《粵大記》……",
      "source": "第12課 P.22",
      "difficulty": "easy",
      "tags": ["地名文獻"]
    }
  ]
}
```

## 三、驗證規則

匯入時系統會檢查：

1. `schemaVersion` 必為 `"2.0"`，舊版本會被擋下並提示。
2. `subjectId` 必填（匯入時會被標籤 UI 的選擇覆寫，但仍須有值供人類審稿）。
3. `lessonId`、`lessonName`、`lessonOrder` 必填，`lessonOrder` 必為數字。
4. `notes.summary` 與 `notes.keyPoints` 必填。
5. `notes.sections[]`、`notes.highlights[]` 若提供，每項必有 `title` 與 `points`。
6. 每條 question：
   - `id` 在同科內唯一
   - `options.length` ≥ 3
   - `answer` 內的 index 必須在 `[0, options.length - 1]` 範圍內
   - 若 `type` 為 `"single"`，`answer.length` 必須為 1
   - 若 `type` 為 `"multiple"`，`answer.length` 必須 ≥ 1
7. 每課 `questions.length` 應 ≥ 5（少於 5 題會警告但仍可匯入）。

匯入失敗會顯示明確錯誤訊息及位置（檔案名 + 欄位）。

## 四、同一科目多次匯入（合併行為）

系統以 `subjectId` 為唯一識別。同一 `subjectId` 多次匯入時：

| 情況 | 行為 |
|------|------|
| 新 `lessonId` | 加入到該科目末端 |
| 已有 `lessonId` | 以新匯入的課別覆蓋（更新） |
| Subject metadata（subjectName、grade） | 以匯入時的標籤選擇為準 |

匯入結果會顯示「新增 N 課，更新 M 課，目前共 X 課」。

**重要**：使用標籤 UI 匯入時，系統會自動算出 `subjectId` 並覆寫 lesson 檔內的值。所以「年級／學期／科目」標籤的選擇必須相同，否則會建立不同的科目。

## 五、Schema 升級註記

- **2.0 為 breaking change**：不再支援 `subject.json` 與 `units` 結構。
- 1.0 / 1.1 lesson 檔需手動轉換：
  - 加 `lessonOrder` 欄位（用課別號數）
  - 升 `schemaVersion` 至 `"2.0"`
  - 移除 `subject.json`
- 將來新增可選欄位（如圖片、影片）會在 minor 版本內加入（如 2.1），舊 2.0 檔仍可使用。
