# Readability 仕様書 (Chrome Extension)

## 1. 概要

本拡張機能は、指定されたURLから開始し、ウェブサイトを再帰的に巡回（クロール）して、全ページの本文情報を1つのMarkdownファイルに集約する。Chrome組み込みAI（Gemini Nano）を活用し、高度な整形、重複排除、要約を行う次世代のドキュメント作成ツールである。

## 2. 技術スタック

* **ブラウザAPI**: Chrome Extension Manifest V3
* **AIエンジン**: Chrome Built-in AI (Prompt API / Summarizer API)
* **本文抽出**: `@mozilla/readability`
* **MD変換**: `Turndown.js`
* **通信**: `fetch` API (Background Service Worker経由)

---

## 3. ディレクトリ構成

```text
ai-markdown-crawler/
├── manifest.json
├── popup/
│   ├── popup.html
│   └── popup.js      # UI制御、設定値の送信
├── background/
│   └── service-worker.js  # クロール司令塔、URLキュー管理
├── scripts/
│   ├── ai-handler.js      # Gemini Nano呼び出し・プロンプト管理
│   ├── extractor.js       # Readabilityを用いた本文抽出ロジック
│   └── markdown-gen.js    # Turndownを用いた変換・ファイル結合
└── lib/
    ├── readability.js
    └── turndown.js
```

---

## 4. 主要機能

### 4.1 本文抽出 (Cleaning & Extraction)

* **Readability統合**: `Readability.js` により、メインコンテンツ領域を特定。ヘッダー、ナビゲーション、サイドバー、フッターを物理的に排除した状態でHTMLを抽出する。
* **Markdown変換**: `Turndown.js` により、クリーンなHTMLをMarkdown（`#`, `##`, `-`, `[]()`等）へ変換する。

### 4.2 クロール制御 (Advanced Crawling)

* **深度設定**: ユーザーが深度(0〜3)を指定可能。
* **スコープ選択**:
  * `同一ドメインのみ`: 開始URLと同一オリジンのリンクのみを辿る。
  * `外部ドメイン(限定)`: 記事本文（Main Content Area）内に含まれるリンクに限り、ドメイン外でも1階層のみ取得する。
* **重複除外**: 訪問済みURLを `Set` で管理し、無限ループと重複取得を防止する。

### 4.3 AIインテリジェンス (Gemini Nano)

* **高品質整形**: 文脈に基づき、不適切な改行の修正、数式の保護、コードブロックの適正化を行う。
* **重複内容の統合**: 複数ページに共通する定型文（フッター的文言や共通の注釈）を特定し、ドキュメント全体で1回のみ表示されるよう統合する。
* **要約生成（選択式）**:
  * 各セクションごとの小要約。
  * ドキュメント冒頭への全体要約（Executive Summary）の生成。

### 4.4 出力 (Output)

* **単一ファイル集約**: 全ページの内容を論理的な順番で1つの `.md` ファイルに結合。
* **メタデータ付与**: 各ページの冒頭に元のタイトルとURLを自動挿入。

---

## 5. 処理プロセスフロー

1. **初期化**: ユーザーがPopupで深度、スコープ、AIオプション（要約・統合）を設定。
2. **リンク収集**: 現在のページから設定スコープに基づきリンクを抽出、キューに追加。
3. **再帰的取得**:
    * バックグラウンドでページを取得。
    * `Readability` + `Turndown` で中間Markdownを生成。
    * AI（Gemini Nano）で各セクションを一次整形。
4. **ポストプロセス**:
    * （オプション）全テキストをAIに渡し、重複排除と全体要約を実行。
5. **エクスポート**: `chrome.downloads` APIを使用してファイルを出力。

---

## 6. 注意点・制約

* **AIコンテキスト制限**: Gemini Nanoの入力制限を超える長文は、セクション単位で分割してAIに渡す（Recursive Summarization方式）。
* **リソース消費**: ローカルAIと並行フェッチによる負荷を抑えるため、逐次処理（Sequential Processing）を基本とする。
* **CORS**: `manifest.json` の `host_permissions` を適切に設定し、クロスドメイン通信を許可する。

---

## 7. UI設計案

* **設定セクション**:
  * `Depth`: [ 0 | 1 | 2 | 3 ]
  * `Scope`: [ ( ) Same Domain  ( ) External (Body Links Only) ]
  * `AI Intensity`: [ [x] Format [ ] Merge Duplicates [ ] Generate Summary ]
* **進捗セクション**:
  * Progress: [====    ] 40% (2/5 pages)
  * Current Task: "Analyzing: <https://example.com/page2>..."
