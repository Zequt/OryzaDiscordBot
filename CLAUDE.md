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
- `/ask <message_id> <question>`: 指定されたメッセージID以降のすべてのメッセージを参照してAIが質問に回答
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