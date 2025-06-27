# OryzaDiscordBot - プロジェクト情報

## プロジェクト概要
Claude.mdを常に最新状態に保つために作業をした後、確実にClaude.mdを更新してください。
Discord.js v14を使用したDiscordボット。基本的なコマンド機能とGemini AIによる質問応答機能を提供。

## 技術スタック
- **Runtime**: Node.js
- **フレームワーク**: Discord.js v14
- **AI**: Google Gemini AI (@google/generative-ai)
- **プロセス管理**: PM2
- **CI/CD**: GitHub Actions

## プロジェクト構造
```
OryzaDiscordBot/
├── commands/
│   ├── basic commands/
│   │   ├── ping.js          # 基本的なpingコマンド
│   │   ├── ask.js           # Gemini AIを使用した質問応答コマンド
│   │   ├── remind.js        # リマインダー機能
│   │   └── developers.js    # 開発者情報表示
│   └── private commands/
│       ├── reload.js        # コマンドリロード
│       └── runningServer.js # サーバー状態確認
├── events/
│   ├── interactionCreate/
│   │   └── interactionCreate.js  # スラッシュコマンド処理
│   └── ready/
│       ├── ready.js             # ボット起動時処理（Gemini AI初期化）
│       └── reminderInit.js      # リマインダーシステム初期化
├── handlers/
│   ├── commandHandler.js    # コマンド登録ハンドラー
│   ├── errorHandler.js      # エラー処理ハンドラー
│   └── eventHandler.js      # イベント処理ハンドラー
├── utils/
│   └── reminderManager.js   # リマインダーデータ管理
├── data/
│   └── reminders.json       # リマインダーデータ保存（自動生成）
├── .github/workflows/
│   └── main.yml            # GitHub Actions設定
├── index.js                # メインエントリーポイント
├── deploy-commands.js      # コマンドデプロイスクリプト
└── package.json           # 依存関係管理
```

## 環境変数
GitHub Secretsで管理される環境変数：
- `DISCORD_TOKEN`: Discordボットトークン
- `DISCORD_CLIENT_ID`: DiscordクライアントID
- `MONGO_URI`: MongoDB接続URI
- `ERROR_REPORT_CHANNEL_ID`: エラー報告チャンネルID
- `GEMINI_API_KEY`: Google Gemini APIキー

## 主要機能

### コマンド
- `/ping`: ボットの応答時間を確認
- `/ask <message_id> <question>`: 指定されたメッセージID以降のすべてのメッセージを参照してAIが質問に回答
- `/remind set|list|delete`: リマインダーの設定・一覧表示・削除
- `/developers`: ボットの開発者情報とチームメンバーを表示
- `/reload commands|events|guild`: コマンド・イベント・ギルドコマンドをリロード（プライベート）
- `/showrunserver`: サーバー実行状態を確認（プライベート）

### Ask コマンド詳細
- 指定されたメッセージID以降のすべてのメッセージを参照してAIが回答
- 参照範囲: 指定されたメッセージIDから最新メッセージまで
- ボット自身のメッセージは参照から除外
- 使用モデル: gemini-2.5-flash-preview-04-17
- 長い回答は自動的に複数メッセージに分割
- 安全性チェック機能内蔵
- 無効なメッセージIDの場合はエラーメッセージを表示

### Remind コマンド詳細
- `/remind set <time> <message> [mention]`: リマインダーを設定（時間形式: 30s, 30m, 2h, 1d）
  - オプション: `mention` パラメータで通知対象ユーザーを指定可能（省略時は作成者自身）
  - オートコンプリート: サーバー内の全メンバーを検索可能（オフラインユーザーも含む）
- `/remind list`: 設定中のリマインダー一覧を表示
- `/remind delete <id>`: 指定IDのリマインダーを削除
- 最大7日間のリマインダー設定が可能
- JSONファイル（data/reminders.json）で永続化
- ボット再起動時も自動復元・タイマー設定
- リマインダーデータに `mentionUserId` フィールドを追加して通知対象を管理
- StringOptionとカスタムオートコンプリートでオフラインユーザーも選択可能

## デプロイメント
GitHub Actionsによる自動デプロイ：
1. masterブランチへのpush時に自動実行
2. セルフホストランナー（OryzaDiscordBot）で実行
3. PM2によるプロセス管理
4. 依存関係の自動インストール

## 開発時の注意事項
- コマンド追加時は適切なディレクトリ（basic commands/private commands）に配置
- Gemini AI使用時はAPIキー設定を確認
- 新しい環境変数追加時はGitHub Actionsワークフローも更新
- 全てのコマンドの`execute`関数は`interaction`と`client`の2つの引数を受け取る
- askコマンドでGemini AIを使用する場合は`client.genAI`からアクセスする
- **Discord Intents設定**: 新機能追加時は`index.js`で適切なインテンツが有効になっているか確認する
  - メッセージ関連機能: `GatewayIntentBits.MessageContent`
  - ギルドメンバー情報: `GatewayIntentBits.GuildMembers`
  - プレゼンス情報: `GatewayIntentBits.GuildPresences`

## 機能拡張の仕組み
### コマンド追加
- **自動検出**: commandHandler.jsがcommandsフォルダ内のサブフォルダを再帰的にスキャン
- **ファイル追加のみ**: 既存ファイルを変更せずに新しい`.js`ファイルを追加するだけで機能する
- **必須プロパティ**: `data`（SlashCommandBuilder）と`execute`関数が必要
- **ホットリロード**: `/reload commands`で動的にコマンドを再読み込み可能
- **エラーハンドリング**: 不正なコマンドファイルは自動でスキップされ、ログに記録

### イベント追加
- **自動検出**: eventHandler.jsがeventsフォルダ内のサブフォルダを再帰的にスキャン  
- **ファイル追加のみ**: 既存ファイルを変更せずに新しい`.js`ファイルを追加するだけで機能する
- **必須プロパティ**: `name`（イベント名）と`execute`関数が必要
- **オプション**: `once`（一度だけ実行）、`rest`（REST API関連）プロパティをサポート
- **ホットリロード**: `/reload events`で動的にイベントを再読み込み可能

## 権限管理
### Private Commands
- `private commands`フォルダ内のコマンドは開発者のみ実行可能
- 各コマンドファイル内で個別に権限チェックを実装
- **チーム所有**: `client.application.owner`が`Team`の場合、チームメンバー全員が使用可能
- **個人所有**: `client.application.owner`が`User`の場合、所有者のみ使用可能
- **権限チェック方法**: `constructor.name`で型を判定し、適切なメンバーチェックを実行

## テスト・ビルドコマンド
```bash
npm install    # 依存関係インストール
npm run lint   # リント実行（設定があれば）
npm run build  # ビルド実行（設定があれば）
```

## ローカルテスト
### .env を使用したローカル開発
```bash
# 1. .env.example を .env にコピー
cp .env.example .env

# 2. .env ファイルを編集して環境変数を設定
# 必須: DISCORD_TOKEN, DISCORD_CLIENT_ID
# オプション: MONGO_URI, ERROR_REPORT_CHANNEL_ID, GEMINI_API_KEY

# 3. 依存関係をインストール
npm install

# 4. ボットを起動
npm start
```
- `.env` ファイルで環境変数を管理
- 必須項目: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`
- オプション項目: `MONGO_URI`, `ERROR_REPORT_CHANNEL_ID`, `GEMINI_API_KEY`
- dotenvパッケージで自動的に環境変数を読み込み

## トラブルシューティング
- Gemini API関連エラー: GEMINI_API_KEYの設定を確認
- Discord接続エラー: DISCORD_TOKENの有効性を確認
- PM2プロセスエラー: PM2ログを確認（`pm2 logs OryzaDiscordBot`）
- コマンドが応答しない場合: `interactionCreate.js`でclientオブジェクトが正しく渡されているか確認
- reload機能が動作しない場合: `commandHandler.js`でキャッシュクリアが正しく実行されているか確認

## 最近の修正履歴
- **コマンド引数の統一**: 全てのコマンドで`execute(interaction, client)`の形式に統一
- **reload機能の修正**: モジュールキャッシュクリアとエラーハンドリングを追加
- **ping/askコマンドの修正**: interactionCreate.jsでの引数渡しを統一化とWebSocket ping エラー対応
- **guild commandリフレッシュ機能**: `/reload guild`サブコマンドを追加
- **developersコマンド追加**: ボットの開発者情報とチームメンバーを表示する一般コマンド
- **権限チェック統一**: チーム所有・個人所有の両方に対応した統一的な権限チェック実装
- **Discord.js v14対応**: `client.application.owner`の型判定による正確なチーム/個人判別
- **リマインダー機能追加**: `/remind`コマンドとJSONファイルによる永続化機能を実装
- **機能拡張システム改善**: コマンド・イベントともに既存ファイルを変更せずに新しいファイル追加のみで機能拡張可能に
- **自動コマンドデプロイ**: ボット起動時に自動でスラッシュコマンドをDiscordにデプロイ