# 内部設計書 (Internal Design)

## 1. アーキテクチャ概要

Chrome Extension Manifest V3に基づき、Popup, Background (Service Worker), Content Scripts, Offscreen (必要に応じて) の各コンポーネントが連携して動作する。

### 1.1 コンポーネント構成図

```mermaid
graph TD
    Popup[Popup UI] -- Settings/Start --> BG[Background Service Worker]
    BG -- Update Status --> Popup
    BG -- 1. Fetch Page --> Tab[Hidden/Offscreen Tab]
    BG -- 2. Inject Script --> Content[Content Script]
    Content -- 3. Extract & Format --> BG
    BG -- 4. Process AI --> AI[Gemini Nano (in Browser)]
    AI -- Formatted Text --> BG
    BG -- 5. Generate MD --> Download[Downloads API]
```

## 2. データ構造

### 2.1 メッセージパッシング

各コンポーネント間の通信に使用するメッセージオブジェクト。

```typescript
// Action Types
type ActionType = 
  | "START_CRAWL"
  | "STOP_CRAWL"
  | "UPDATE_STATUS"
  | "CRAWL_COMPLETE";

// Message Interface
interface Message {
  type: ActionType;
  payload?: any;
}
```

### 2.2 クロール状態管理 (Global State in Background)

```javascript
{
  queue: ["https://example.com/page1", "https://example.com/page2"], // 未処理URLキュー
  visited: Set("https://example.com/"), // 訪問済みURLセット
  results: [ // 取得済みコンテンツリスト
    {
      url: "https://example.com/",
      title: "Home",
      content: "# Home\n...",
      depth: 0
    }
  ],
  config: { // ユーザー設定
    maxDepth: 1,
    scope: "same-domain",
    aiOptions: { ... }
  },
  status: {
    isCrawling: true,
    processedCount: 5,
    currentUrl: "..."
  }
}
```

## 3. モジュール詳細

### 3.1 Background (Service Worker)

システムの司令塔。

* **役割**:
  * Popupからの開始リクエスト受信。
  * URLキューの管理 (BFS/DFS)。
  * ページ取得のスケジューリング（逐次処理）。
  * 結果の集約と最終的なファイル生成。
* **クラス設計案**:
  * `CrawlerManager`: クロール全体のフロー制御。
  * `QueueHandler`: URLの追加・取り出し、重複チェック。

### 3.2 Content Script / Extractor

各ページに注入され、DOMから情報を抽出する。

* **役割**:
  * `Readability.js` を実行し、主要コンテンツHTMLを取得。
  * `Turndown.js` を実行し、HTMLをMarkdownへ変換。
  * ページ内のリンクを収集し、Backgroundへ返却。
* **関数**:
  * `extractContent()`: Readability実行。
  * `convertToMarkdown(html)`: Turndown実行。
  * `collectLinks(document, scope, baseUrl)`: リンク抽出。

### 3.3 AI Handler

Gemini Nano (Chrome Built-in AI) とのインターフェース。

* **役割**:
  * `LanguageModel` へのプロンプト送信。
  * テキスト整形。
* **プロンプト戦略**:
  * **整形**: "Fix line breaks and format code blocks in the following Markdown..."
  * **整形**: "Fix the following Markdown content..."

## 4. エラー処理設計

* **Fetch失敗**: `fetch()` がエラー、またはHTTPステータスが4xx/5xxの場合、そのURLをその旨ログに記録し、結果には「取得失敗」としてプレースホルダーを含めるかスキップする。
* **AI応答なし**: タイムアウトを設定し、応答がない場合はRaw Markdownをそのまま採用するフォールバックを用意する。
* **無限ループ**: `visited` セットによる厳密なURLチェック（正規化処理含む）で防止。

## 5. 使用ライブラリ

* `@mozilla/readability`: 本文抽出用 (Stand-alone version)
* `turndown`: HTML -> Markdown変換用
