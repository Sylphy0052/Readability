# Readability

**Readability** は、指定されたウェブサイトをクロールし、コンテンツを高品質な Markdown ドキュメントに一括変換する Google Chrome 拡張機能です。
Chrome に組み込まれた AI (Gemini Nano) を活用し、テキストの整形をローカル環境で実行します。

## 特徴

* **スマートな本文抽出**: `Readability.js` を使用し、広告やナビゲーションを除外したメインコンテンツのみを抽出します。
* **Markdown 変換**: `Turndown.js` により、HTML をクリーンな Markdown に変換します。
* **再帰的クローリング**: 指定した深さ（Depth）までリンクを自動的に辿り、複数のページを1つのドキュメントにまとめます。
* **AI インテグレーション (Gemini Nano)**:
  * **自動整形**: 不自然な改行やコードブロックの修正。
* **プライバシー重視**: AI 処理はブラウザ内（On-device）で完結するため、データが外部サーバーに送信されることはありません。

## 動作環境

この拡張機能は **Google Chrome の組み込み AI (Gemini Nano)** を使用します。

### 必須要件

* **Google Chrome 127 以降**（安定版で動作します）

### Gemini Nano の有効化

1. `chrome://flags/#optimization-guide-on-device-model` を開く
   * **Enabled BypassPerfRequirement** に設定

2. `chrome://flags/#prompt-api-for-gemini-nano` を開く
   * **Enabled** に設定

3. Chrome を再起動

4. `chrome://components` を開く
   * 「Optimization Guide On Device Model」にバージョン番号が表示されていることを確認
   * 表示されていない場合は「アップデートを確認」をクリック（ダウンロードに数分かかります）

> AI 機能が利用できない場合でも、通常のクローラー＆Markdown変換ツールとして機能します。

## インストール方法

1. このリポジトリをクローンまたはダウンロードします。

    ```bash
    git clone https://github.com/Sylphy0052/Readability.git
    cd Readability
    ```

2. Chrome で `chrome://extensions` を開きます。
3. 右上の **「デベロッパーモード」** をオンにします。
4. **「パッケージ化されていない拡張機能を読み込む」** をクリックします。
5. クローンしたフォルダ（`manifest.json` があるルートディレクトリ）を選択します。

## 使いかた

1. ドキュメント化したいウェブサイトを開きます。
2. Chrome のツールバーから **Readability** のアイコンをクリックします。
3. 設定を行います：
    * **Depth**: クロールする深さ（0=現在のページのみ、1=リンク先まで...）
    * **Scope**: リンクを辿る範囲（同一ドメインのみ or 外部ドメインも許可）
4. **「Start Crawling」** ボタンをクリックします。
5. 処理が完了すると、自動的に `.md` ファイルがダウンロードされます。

## 技術スタック

* **Platform**: Chrome Extension Manifest V3
* **Core Libraries**:
  * [Readability.js](https://github.com/mozilla/readability): コンテンツ抽出
  * [Turndown](https://github.com/mixmark-io/turndown): HTML to Markdown 変換
* **AI**: Chrome Built-in AI (Prompt API / Gemini Nano)
* **Parsing**: Offscreen API (バックグラウンドでの DOM 解析)

## ディレクトリ構成

```text
├── manifest.json        # 拡張機能の定義ファイル
├── background/          # クロール制御、ファイル生成 (Service Worker)
├── popup/               # ユーザーインターフェース
├── scripts/             # コアロジック (抽出、Markdown変換、AI)
├── offscreen/           # DOM解析用 (Backgroundから利用)
├── lib/                 # 外部ライブラリ (Readability, Turndown)
└── icons/               # 拡張機能アイコン
```

## License

MIT License
