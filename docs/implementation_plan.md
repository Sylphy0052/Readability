# 実装計画書 (Implementation Plan)

## 1. 開発フェーズ定義

### Phase 1: プロジェクトセットアップと基本構造 (MVP)

* **目標**: Chrome拡張機能としてロードでき、現在のページのタイトルとURLを取得できる状態にする。
* **タスク**:
  1. `manifest.json` の作成 (Manifest V3)。
  2. ディレクトリ構造の作成 (`popup/`, `background/`, `scripts/`, `lib/`)。
  3. 必要なライブラリ (`readability.js`, `turndown.js`) のダウンロードと配置。
  4. Popup UIのモック作成（HTML/CSSのみ）。
  5. Background Service Worker の基本実装（インストールイベント等の確認）。

### Phase 2: コンテンツ抽出とMarkdown変換

* **目標**: 指定したページのHTMLから本文を抽出し、Markdownに変換できる。
* **タスク**:
  1. Content Scriptの実装 (`extractor.js`)。
  2. `Readability` の組み込みと本文抽出ロジック実装。
  3. `Turndown` の組み込みとHTML -> Markdown変換ロジック実装。
  4. Popupから「現在のページ」のMarkdownを表示/ログ出力するテスト。

### Phase 3: クローラーロジックの実装

* **目標**: リンクを辿り、複数ページの情報を収集できるようにする。
* **タスク**:
  1. Background (`service-worker.js`) にキュー管理 (`queue`, `visited`) を実装。
  2. リンク抽出ロジック (`extractor.js`内) の実装。
  3. スコープ制御（同一ドメイン判定）の実装。
  4. 深度（Depth）制御の実装。
  5. ページ遷移とデータ受け渡しのフロー（Messaging）の確立。

### Phase 4: AI機能 (Gemini Nano) の統合

* **目標**: 取得したMarkdownをAIで整形する。
* **タスク**:
  1. `window.ai` API呼び出し用ラッパー (`ai-handler.js`) の作成。
  2. Prompt APIを用いたテキスト整形プロンプトのテストと実装。
  3. Prompt APIによる整形機能の実装。
  4. Promptコンテキスト長制限への対策（分割処理など）。

### Phase 5: UIと出力の仕上げ

* **目標**: ユーザーが設定を変更でき、最終成果物をファイルとしてダウンロードできる。
* **タスク**:
  1. Popup UIとBackgroundの設定同期処理の実装。
  2. 進捗表示（プログレスバー、ステータス）のリアルタイム更新。
  3. ファイル結合処理と `chrome.downloads` APIによる出力実装。
  4. エラーハンドリングとユーザー通知の強化。

## 2. スケジュール見積もり（参考）

* **Week 1**: Phase 1 & 2 (基本抽出機能)
* **Week 2**: Phase 3 (クロール機能)
* **Week 3**: Phase 4 (AI機能)
* **Week 4**: Phase 5 & Testing (ブラッシュアップ)

## 3. 検証項目 (Testing Checkpoints)

* [ ] インストール後、アイコンクリックでPopupが開くか。
* [ ] 単一ページのMarkdown変換結果が適切か（不要な広告などが消えているか）。
* [ ] 深度1設定で、リンク先のページが取得できているか。
* [ ] 外部ドメイン設定が正しく機能するか（外部を深く掘りすぎていないか）。
* [ ] AI整形有効時と無効時で結果に違いがあるか。
* [ ] 最終的な `.md` ファイルがダウンロードされ、エディタで正しく開けるか。
