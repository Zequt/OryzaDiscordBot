# OryzaDiscordBot

Discord.js v14を使用したDiscordボットテンプレート。モジュラー設計により、コマンドとイベントの管理が簡単に行えます。

## 特徴

- 🚀 **Discord.js v14対応** - 最新のDiscord APIを活用
- 🔧 **モジュラー設計** - コマンドとイベントの分離による保守性の向上
- 🔒 **セキュリティ** - 環境変数による機密情報の管理
- 🔄 **ホットリロード** - 開発者向けreloadコマンド搭載
- ⚡ **自動デプロイ** - GitHub Actionsによる自動化

## プロジェクト構造

```
OryzaDiscordBot/
├── commands/                    # スラッシュコマンド
│   ├── basic commands/          # 基本コマンド
│   │   └── ping.js             # レスポンス時間測定
│   └── private commands/        # 管理者専用コマンド
│       ├── reload.js           # コマンド/イベントリロード
│       └── runningServer.js    # サーバー状態確認
├── events/                      # Discordイベント処理
│   ├── interactionCreate/       # インタラクション処理
│   │   └── interactionCreate.js
│   └── ready/                   # ボット起動時処理
│       └── ready.js
├── handlers/                    # 各種ハンドラー
│   ├── commandHandler.js       # コマンド読み込み
│   ├── errorHandler.js         # エラー処理
│   └── eventHandler.js         # イベント読み込み
├── .github/workflows/           # GitHub Actions
│   └── main.yml                # 自動デプロイ設定
├── index.js                    # メインエントリーポイント
├── deploy-commands.js          # コマンド登録スクリプト
└── package.json               # 依存関係管理
```

## セットアップ

### 1. 環境準備

```bash
# リポジトリをクローン
git clone https://github.com/your-username/OryzaDiscordBot.git
cd OryzaDiscordBot

# 依存関係をインストール
npm install
```

### 2. Discord開発者ポータルでの設定

1. [Discord Developer Portal](https://discord.com/developers/applications)にアクセス
2. 「New Application」をクリックしてアプリケーションを作成
3. 「Bot」タブに移動してボットを作成
4. 必要な情報を記録：
   - **Bot Token** (`DISCORD_TOKEN`)
   - **Application ID** (`DISCORD_CLIENT_ID`)

### 3. 環境変数の設定

#### ローカル開発の場合

環境変数を設定してください：

**Linux/macOS:**
```bash
export DISCORD_TOKEN="your_discord_bot_token"
export DISCORD_CLIENT_ID="your_discord_client_id"
export MONGO_URI="your_mongodb_uri_if_needed"
export ERROR_REPORT_CHANNEL_ID="error_report_channel_id"
```

**Windows (PowerShell):**
```powershell
$env:DISCORD_TOKEN="your_discord_bot_token"
$env:DISCORD_CLIENT_ID="your_discord_client_id"
$env:MONGO_URI="your_mongodb_uri_if_needed"
$env:ERROR_REPORT_CHANNEL_ID="error_report_channel_id"
```

**Windows (Command Prompt):**
```cmd
set DISCORD_TOKEN=your_discord_bot_token
set DISCORD_CLIENT_ID=your_discord_client_id
set MONGO_URI=your_mongodb_uri_if_needed
set ERROR_REPORT_CHANNEL_ID=error_report_channel_id
```

または`.env`ファイルを使用する場合は、`dotenv`パッケージを追加してください。

#### 本番環境（GitHub Actions）の場合

GitHubリポジトリの設定でシークレットを追加：

1. GitHubリポジトリの **Settings** > **Secrets and variables** > **Actions**
2. 以下のシークレットを追加：

| シークレット名 | 説明 | 例 |
|---|---|---|
| `DISCORD_TOKEN` | Discordボットのトークン | `MTIzNDU2Nzg5MA...` |
| `DISCORD_CLIENT_ID` | DiscordアプリケーションID | `1234567890123456789` |
| `MONGO_URI` | MongoDB接続URI（使用する場合） | `mongodb://user:pass@host:port/db` |
| `ERROR_REPORT_CHANNEL_ID` | エラー報告チャンネルID | `1234567890123456789` |

### 5. ボットの起動

```bash
# ボットを起動
node index.js
```

### 新しいコマンドの追加

1. `commands/`内の適切なサブフォルダに新しい`.js`ファイルを作成
2. 以下の形式でコマンドを作成：

```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('command-name')
        .setDescription('コマンドの説明'),
    async execute(interaction, client) {
        // コマンドの処理
        await interaction.reply('Hello!');
    },
};
```

3. `node deploy-commands.js`でコマンドを登録
4. ボットを再起動または`/reload commands`を実行

### 新しいイベントの追加

1. `events/`内に新しいフォルダとファイルを作成
2. 以下の形式でイベントを作成：

```javascript
module.exports = {
    name: 'eventName',
    once: false, // 一度だけ実行する場合はtrue
    execute(arg1, arg2, client) {
        // イベントの処理
    },
};
```

## デプロイ

### GitHub Actionsによる自動デプロイ

`master`ブランチにプッシュすると自動的にデプロイされます：

1. コードをプッシュ
2. GitHub Actionsが自動実行
3. 依存関係をインストール
4. PM2でボットを再起動

### 手動デプロイ

```bash
git pull origin master
npm install
node index.js
```

## トラブルシューティング

### よくある問題

**ボットがコマンドに反応しない**
- コマンドが正しく登録されているか確認：`node deploy-commands.js`
- ボットに適切な権限があるか確認

**環境変数が読み込まれない**
- GitHub Secretsが正しく設定されているか確認
- ローカルでは環境変数が正しく設定されているか確認

## 貢献

1. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
2. 変更をコミット (`git commit -m 'Add amazing feature'`)
3. ブランチにプッシュ (`git push origin feature/amazing-feature`)
4. プルリクエストを作成
