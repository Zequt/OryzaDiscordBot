# OryzaDiscordBot - プロジェクト情報

## プロジェクト概要
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
│   │   └── ask.js           # Gemini AIを使用した質問応答コマンド
│   └── private commands/
│       ├── reload.js        # コマンドリロード
│       └── runningServer.js # サーバー状態確認
├── events/
│   ├── interactionCreate/
│   │   └── interactionCreate.js  # スラッシュコマンド処理
│   └── ready/
│       └── ready.js             # ボット起動時処理（Gemini AI初期化含む）
├── handlers/
│   ├── commandHandler.js    # コマンド登録ハンドラー
│   ├── errorHandler.js      # エラー処理ハンドラー
│   └── eventHandler.js      # イベント処理ハンドラー
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
- `/ask <count> <question>`: 指定された件数のメッセージを参照してAIが質問に回答
- `/reload`: コマンドをリロード（プライベート）
- `/runningserver`: サーバー実行状態を確認（プライベート）

### Ask コマンド詳細
- Discord チャンネルの直近メッセージを参照してAIが回答
- 参照可能メッセージ数: 1〜200件
- 使用モデル: gemini-2.5-flash-preview-04-17
- 長い回答は自動的に複数メッセージに分割
- 安全性チェック機能内蔵

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

## テスト・ビルドコマンド
```bash
npm install    # 依存関係インストール
npm run lint   # リント実行（設定があれば）
npm run build  # ビルド実行（設定があれば）
```

## トラブルシューティング
- Gemini API関連エラー: GEMINI_API_KEYの設定を確認
- Discord接続エラー: DISCORD_TOKENの有効性を確認
- PM2プロセスエラー: PM2ログを確認（`pm2 logs OryzaDiscordBot`）