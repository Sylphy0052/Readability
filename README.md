# AI Markdown Crawler

**AI Markdown Crawler** は、指定されたウェブサイトをクロールし、コンテンツを高品質な Markdown ドキュメントに一括変換する Google Chrome 拡張機能です。
Chrome に組み込まれた AI (Gemini Nano) を活用し、テキストの整形や要約をローカル環境で実行します。

## ✨ 特徴

* **スマートな本文抽出**: `Readability.js` を使用し、広告やナビゲーションを除外したメインコンテンツのみを抽出します。
* **Markdown 変換**: `Turndown.js` により、HTML をクリーンな Markdown に変換します。
* **再帰的クローリング**: 指定した深さ（Depth）までリンクを自動的に辿り、複数のページを1つのドキュメントにまとめます。
* **AI インテグレーション (Gemini Nano)**:
  * **自動整形**: 不自然な改行やコードブロックの修正。
  * **要約生成**: 各ページおよび全体の要約を生成（オプション）。
* **プライバシー重視**: AI 処理はブラウザ内（On-device）で完結するため、データが外部の AI サーバーに送信されることはありません（※Chrome Built-in AI 使用時）。

## 🚀 動作環境 (Prerequisites)

この拡張機能は **Google Chrome の組み込み AI (Gemini Nano)** を使用します。以下の環境が必要です。

1. **Google Chrome**: 最新の Canary 版 または Dev 版（安定版でも一部機能が順次ロールアウトされていますが、開発版推奨）。
2. **フラグ設定**: `chrome://flags` で以下を有効にする必要があります。
    * `Enables optimization guide on device`: **Enabled BypassPerfRequirement**
    * `Prompt API for Gemini Nano`: **Enabled**
    * (必要に応じて) コンポーネントのダウンロード完了待ち。

※ AI 機能が利用できない場合でも、通常のクローラー＆Markdown変換ツールとしては機能します。

## 📥 インストール方法

1. このリポジトリをクローンまたはダウンロードします。

    ```bash
    git clone https://github.com/Sylphy0052/Readability.git
    cd Readability
    ```

2. Chrome で `chrome://extensions` を開きます。
3. 右上の **「デベロッパーモード (Developer mode)」** をオンにします。
4. **「パッケージ化されていない拡張機能を読み込む (Load unpacked)」** をクリックします。
5. クローンしたフォルダ（`manifest.json` があるルートディレクトリ）を選択します。

## 📖 使いかた

1. ドキュメント化したいウェブサイトを開きます。
2. Chrome のツールバーから **AI Markdown Crawler** のアイコンをクリックします。
3. 設定を行います：
    * **Depth**: クロールする深さ（0=現在のページのみ、1=リンク先まで...）。
    * **Scope**: リンクを辿る範囲（同一ドメインのみ or 外部ドメインも1階層だけ許可）。
    * **AI Options**: 整形（Auto-Format）や要約（Generate Summary）の ON/OFF。
4. **"Start Crawling"** ボタンをクリックします。
5. 処理が完了すると、自動的に `.md` ファイルがダウンロードされます。

## 🛠️ 技術スタック

* **Platform**: Chrome Extension Manifest V3
* **Core Libraries**:
  * [Readability.js](https://github.com/mozilla/readability): コンテンツ抽出
  * [Turndown](https://github.com/mixmark-io/turndown): HTML to Markdown 変換
* **AI**: Chrome Built-in AI (Prompt API / Gemini Nano)
* **Parsing**: Offscreen API (DOM Parsing in background)

## 📂 ディレクトリ構成

```text
├── manifest.json        # 拡張機能の定義ファイル
├── background/          # クロール制御、ファイル生成 (Service Worker)
├── popup/               # ユーザーインターフェース
├── scripts/             # コアロジック (抽出、Markdown変換、AI)
├── offscreen/           # DOM解析用 (Backgroundから利用)
├── lib/                 # 外部ライブラリ (Readability, Turndown)
└── docs/                # 設計ドキュメント類
```

## 📝 License

MIT License
