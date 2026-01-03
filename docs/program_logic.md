# コード解説ドキュメント

このドキュメントは、Chrome 拡張機能 **Readability** のコード構成と主要な処理フローを説明します。

## 概要

この拡張機能は、現在開いているページを起点に、指定した深さまでリンクを辿ってページを取得し、
Readability.js で本文抽出、Turndown.js で Markdown 変換、必要に応じて Gemini Nano で整形を行い、
最終的に 1 つの Markdown ファイルとしてダウンロードします。

## アーキテクチャ概要

- **Popup UI**（`popup/`）
  - ユーザーが Depth / Scope / AI オプションを指定し、クロール開始/停止を操作。
  - AI 利用可否のチェックもここで実施。
- **Background Service Worker**（`background/service-worker.js`）
  - クロールのオーケストレーション（キュー管理、フェッチ、結果集約、ダウンロード生成）。
  - Offscreen Document に HTML 解析を委譲。
- **Offscreen Document**（`offscreen/`）
  - DOMParser で HTML を DOM 化し、Readability/Turndown を実行。
  - リンク抽出を行い、結果を Background に返却。
- **Core Scripts**（`scripts/`）
  - Readability と Turndown のラッパ、AI 処理ラッパを提供。

## 主要ファイルと役割

### `manifest.json`
- Manifest V3 で拡張機能を定義。
- `background/service-worker.js` を Service Worker として登録。
- `popup/popup.html` をアクションの UI として指定。
- `offscreen` 権限や `web_accessible_resources`（Readability/Turndown）を宣言。

### `background/service-worker.js`
- 拡張機能の中核。
- メッセージハンドリング：
  - `START_CRAWL`：クロール開始
  - `STOP_CRAWL`：クロール停止
- **クロール状態の管理**
  - `isCrawling`, `crawlerConfig`, `crawlQueue`, `visitedUrls`, `crawlResults`
- **キュー処理**
  - BFS（`shift()`）で URL を取り出し、`fetch()` で HTML を取得。
  - Offscreen Document に解析を依頼し、結果を `crawlResults` に保存。
  - `depth` と `scope` に応じてリンク追加。
- **生成とダウンロード**
  - 全結果を 1 つの Markdown 文字列に結合し、`chrome.downloads.download` で保存。

### `offscreen/offscreen.js`
- HTML 解析の実行場所。
- `PARSE_HTML` メッセージを受け取り、以下を順に実行：
  1. DOMParser で HTML を DOM 化
  2. Readability で本文抽出
  3. Turndown で Markdown 変換
  4. AI 整形（オプション）
  5. 本文リンク抽出
- 解析結果を `PARSE_COMPLETE` で返却。

### `scripts/extractor.js`
- Readability.js のラッパ。
- `runReadability(docArg)` で DOM を受け取り本文抽出を実行。

### `scripts/markdown-gen.js`
- Turndown.js のラッパ。
- `runTurndown(htmlContent)` で HTML → Markdown 変換。

### `scripts/ai-handler.js`
- Chrome Built-in AI（Gemini Nano）向けのラッパ。
- `AIHandler.formatMarkdown()`：Markdown の整形
- `AIHandler.isAvailable()`：利用可能かどうか確認

### `popup/popup.html` / `popup/popup.js`
- UI とイベント処理。
- Depth / Scope / AI オプションの取得。
- `START_CRAWL` / `STOP_CRAWL` を Service Worker に送信。
- 進捗や完了・エラーを表示。

## クロール処理フロー

1. **Popup で Start**
   - `popup.js` が `START_CRAWL` を送信。
2. **Service Worker が開始**
   - 現在のアクティブタブ URL を起点にキューへ追加。
   - Offscreen Document を準備。
3. **キュー処理**
   - `fetch()` で HTML 取得。
   - `parseInOffscreen()` で解析依頼。
4. **Offscreen 解析**
   - Readability → Turndown → AI整形（任意）。
   - リンク抽出。
5. **結果集約**
   - `crawlResults` に追加。
   - Depth / Scope に応じて新規リンクをキューへ追加。
6. **完了時**
   - 結果を Markdown にまとめ、ダウンロード。
   - `CRAWL_COMPLETE` 通知。

## メッセージ一覧

- `START_CRAWL`: クロール開始
- `STOP_CRAWL`: クロール停止
- `UPDATE_STATUS`: 進捗更新
- `CRAWL_COMPLETE`: 完了通知
- `CRAWL_ERROR`: エラー通知
- `PARSE_HTML`: HTML 解析依頼（Background → Offscreen）
- `PARSE_COMPLETE`: 解析完了通知（Offscreen → Background）

## Markdown 生成仕様

- 1 ページごとに `# Title` を見出しとして付与。
- URL を引用ブロックで記載。
- ページ間に `---` で区切りを挿入。
- 余分な改行を正規化。

## AI オプション

- **Auto-Format**
  - Markdown の改行や見出し、コードブロックを整形。
- AI が利用不可の場合は自動的にスキップ。

## 依存ライブラリ

- **Readability.js**（`lib/readability.js`）
  - 本文抽出に使用。
- **Turndown.js**（`lib/turndown.js`）
  - HTML → Markdown 変換に使用。

## 注意点（現状コードに基づく）

- `scope=external` の深さ制御は `depth` 値に依存。
- クロール中断は `isCrawling` フラグによる停止のみ。

## 追加調査の候補

- `external` スコープの厳密なルール化。
- 解析失敗時の再試行やタイムアウト制御の強化。
