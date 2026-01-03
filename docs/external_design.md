# 外部設計書 (External Design)

## 1. 概要

本ドキュメントは、Readabilityのユーザーインターフェース（UI）および外部インターフェース（出力形式）の詳細を定義する。

## 2. ユーザーインターフェース (Popup UI)

Chrome拡張機能のアイコンをクリックした際に表示されるポップアップ画面（300px x 500px程度）の構成。

### 2.1 画面レイアウト

画面は大きく「設定エリア（Configuration）」と「実行・進捗エリア（Action & Status）」に分かれる。

#### A. ヘッダー

* タイトル: "Readability"
* バージョン情報 (例: v1.0.0)

#### B. 設定エリア (Configuration)

ユーザーがクロール動作をカスタマイズするフォーム。

1. **Depth (深度設定)**
    * **ラベル**: "Crawling Depth"
    * **コントロール**: ラジオボタン または スライダー
    * **選択肢**:
        * `0`: Current Page Only (現在のページのみ)
        * `1`: Depth 1 (リンク先1階層まで)
        * `2`: Depth 2 (2階層先まで)
        * `3`: Depth 3 (3階層先まで/最大)
    * **初期値**: `0`

2. **Scope (スコープ設定)**
    * **ラベル**: "Crawl Scope"
    * **コントロール**: ラジオボタン
    * **選択肢**:
        * `Same Domain`: 同一ドメイン内のリンクのみ追跡。
        * `External (Content Links)`: 本文内のリンクに限り、外部ドメインも1階層だけ追跡許可。
    * **初期値**: `Same Domain`

3. **AI Options (AI機能設定)**
    * **ラベル**: "AI Intelligence (Gemini Nano)"
    * **コントロール**: チェックボックス群
    * **項目**:
        * `[x] Auto-Format`: 本文の整形（改行、コードブロック等）を行う。

#### C. 実行・進捗エリア (Action & Status)

1. **Action Buttons**
    * **Start Button**: "Start Crawling" (クロール開始)
        * 処理中は "Cancel" ボタンに変化、または無効化され別途Cancelボタンが表示される。
    * **Stop/Cancel Button**: "Stop" (処理中断)

2. **Status Display**
    * **Progress Bar**: 全体の進捗率（例: まだ未定の場合は不定のアニメーション、母数が分かれば％表示）。
    * **Stats**:
        * "Pages Processed: 5 / 12" (処理済みページ数 / 予定数)
    * **Current Activity**:
        * "Fetching: <https://example.com/page2>..." (現在取得中のURL)
        * "Processing with AI..." (AI処理中)
    * **Log/Message**: エラーや完了メッセージを表示する簡易領域。

## 3. 出力ファイル仕様 (Output Format)

生成されるファイルは1つのMarkdownファイル（`.md`）である。

### 3.1 ファイル名規則

* デフォルト: `[Title]_[Timestamp].md`
  * 例: `documentation_20260103_194103.md`

### 3.2 コンテンツ構造

ファイルの中身は以下の順序で結合される。

```markdown
# [Page 1 Title]
> Original URL: https://example.com/page1

## Main Content
(抽出・整形された本文コンテンツ)
...

---

# [Page 2 Title]
> Original URL: https://example.com/child-page

...
```

## 4. ユーザー操作フロー

1. **インストール**: Chrome Web Storeから拡張機能をインストールする。
2. **対象ページへ移動**: クロールを開始したいWebページを開く。
3. **Popupを開く**: 拡張機能アイコンをクリック。
4. **設定**: DepthやAIオプションを選択する。
5. **開始**: "Start Crawling" をクリック。
6. **待機**: ポップアップを開いたまま（またはバックグラウンド処理が可能なら閉じて）待機。
    * 進捗バーが進む。
7. **完了・ダウンロード**: 処理が完了すると、自動的に `.md` ファイルがダウンロードされる。

## 5. エラー表示

* **ネットワークエラー**: 対象ページにアクセスできない場合、ログに表示し、スキップして続行するか停止するかを判断（基本はスキップ）。
* **AI制限**: Gemini Nanoが利用できない、またはクオータ超過の場合、AI処理をスキップしてRaw変換のみ行う旨を通知する。
