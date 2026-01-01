# VEXUM Meeting OS

会議を「共有で終わらせない」ための会議支援Webアプリケーション

## 概要

VEXUM Meeting OSは、会議の決定事項・次やること・保留箱を確実に記録し、チームの実行力を高めるための会議OSです。

### 解決する課題

- 会議が「共有」で終わり、決定・実行に落ちない
- 論点や保留が散逸し、次回までに消える
- 色分けに頼る申告では詰まりが議題化しにくい
- 会議タイプごとに必要項目が違うのに運用が統一されず質がバラつく
- 入力負荷が重く定着しない

### 提供する価値

- 会議中に同じ画面を開き、決定事項 / 次やること / 保留箱が必ず残る
- 状態ボタン + 確度 + 停滞検知で詰まりが自然に浮上
- 会議タイプ別テンプレで、目的に最適化
- 書記不要で、管理者の超高速入力（Quick Capture）と会議後3分整備で回る

## 機能一覧

### 会議タイプ

| タイプ | 説明 | 専用機能 |
|--------|------|----------|
| チームMTG | 週1回、常駐先単位で施策進捗・品質・来週コミット・提案のタネを整理 | 常駐先ボード、打ち手（施策）、来週やること、提案のタネ |
| 本部会議 | 週1回、リーダー/副リーダー。会社決定の共有・運用統制・横断詰まり解消 | 会社決定（通達）、ルール更新、詰まり一覧 |
| 戦略会議 | 週1回、V2。優先順位・配分・トレードオフ・重大判断に集中 | 最優先TOP3、やらないこと、配分 |
| 全体会議 | 月1回、本部決定の要点共有、月次振り返り、横展開 | 本部テンプレの全体版 |

### 共通コア機能

- **今日の議題（Agenda）**: 会議の議題を管理
- **決定事項（Decision）**: 会議で決まったことを記録、確定フロー付き
- **次やること（Action）**: タスク管理、ステータス・担当・期限・完了条件を設定
- **保留箱（Issue）**: 未解決の問題を記録、状態ボタンで分類
- **資料リンク（Link）**: 関連ドキュメントをリンク
- **Quick Capture**: `D:` `A:` `I:` のショートカットで高速入力

### チェックイン

- 確度（0-10）、不確実要因、助けが必要かを30秒で入力
- 公開範囲制御（チームMTG：匿名許容、本部/戦略：実名）

### 停滞検知（レーダー）

以下のルールで自動検知：
- 期限超過Action
- 更新が7日以上止まっているAction
- 担当未確定Action
- 「待ち」が3日以上継続
- 保留箱が2回以上次回送り

スヌーズ（3日/7日/次回会議まで）と例外理由（外部待ち/優先度低/長期施策等）で制御可能

### 一括整備（Triage）

会議後3分で未確定Actionを一括で確定状態にする

### 会社決定の伝播

本部会議で登録された会社決定は、対象チームの次回チームMTGの議題に自動差し込み。消化されるまで次回以降も残る。

## URL一覧

| パス | 説明 |
|------|------|
| `/` | 会議一覧（今週の会議） |
| `/meeting/:id` | 会議ルーム |
| `/issues` | 保留箱（Issue横断一覧） |
| `/dashboard` | ダッシュボード |
| `/triage` | 一括整備 |

### API エンドポイント

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/meetings` | 会議一覧取得 |
| GET | `/api/meetings/:id` | 会議詳細取得（全関連データ含む） |
| POST | `/api/meetings` | 会議作成 |
| PATCH | `/api/meetings/:id` | 会議更新 |
| POST | `/api/quick-capture` | Quick Capture入力 |
| POST | `/api/agenda-items` | 議題追加 |
| POST | `/api/decisions` | 決定事項追加 |
| PATCH | `/api/decisions/:id` | 決定事項更新（確定） |
| GET/POST | `/api/actions` | Action一覧/追加 |
| PATCH | `/api/actions/:id` | Action更新 |
| POST | `/api/actions/triage` | 一括整備 |
| GET/POST | `/api/issues` | Issue一覧/追加 |
| PATCH | `/api/issues/:id` | Issue更新 |
| POST | `/api/issues/:id/convert-to-action` | IssueをActionに変換 |
| POST | `/api/check-ins` | チェックイン登録 |
| GET/POST | `/api/broadcasts` | 会社決定一覧/登録 |
| POST | `/api/broadcasts/:id/consume` | 会社決定の消化 |
| POST | `/api/snooze` | スヌーズ/例外設定 |
| GET | `/api/dashboard` | ダッシュボード統計 |
| GET | `/api/triage` | 未確定Action一覧 |

## データモデル

### 主要テーブル

- `organizations` - 組織
- `teams` - チーム
- `users` - ユーザー（role: participant/manager）
- `meetings` - 会議
- `meeting_types` - 会議タイプ（テンプレート）
- `agenda_items` - 議題
- `decisions` - 決定事項
- `actions` - Action（次やること）
- `issues` - 保留箱
- `check_ins` - チェックイン
- `clients` - クライアント（チームMTG用）
- `initiatives` - 施策（チームMTG用）
- `broadcasts` - 会社決定（本部会議用）
- `strategy_priorities` - 最優先TOP3（戦略会議用）

### Actionステータス

| ステータス | 日本語 |
|------------|--------|
| not_started | 未着手 |
| in_progress | 進行中 |
| reviewing | 確認中 |
| completed | 完了 |
| waiting | 待ち |
| on_hold | 保留 |

### Issue状態

| 状態 | 日本語 |
|------|--------|
| pending_decision | 判断待ち |
| waiting | 待ち |
| unknown | 不明点 |
| stuck | 詰まり |
| insufficient | 不足 |
| concern | 不安要素 |

## 技術スタック

- **フレームワーク**: Hono（TypeScript）
- **デプロイ**: Cloudflare Pages/Workers
- **データベース**: Cloudflare D1（SQLite）
- **フロントエンド**: Tailwind CSS, Font Awesome, Day.js, Axios

## 開発

### ローカル開発

```bash
# 依存関係インストール
npm install

# データベースマイグレーション
npm run db:migrate:local

# シードデータ投入
npm run db:seed

# ビルド
npm run build

# 開発サーバー起動（PM2使用）
pm2 start ecosystem.config.cjs

# または直接起動
npm run dev:sandbox
```

### デプロイ

```bash
# 本番デプロイ
npm run deploy:prod

# データベースマイグレーション（本番）
npm run db:migrate:prod
```

## ロール

| ロール | 権限 |
|--------|------|
| participant | 会議閲覧、チェックイン、Issue追加、自分担当Action更新、提案追加 |
| manager | Agenda編集、Decision確定、Action作成・割当、Issue整理、停滞検知対応、会社決定登録 |

## 3フェーズ運用

1. **開始30秒**: チェックイン
2. **進行中**: キャプチャ（1行入力中心）
3. **終了前3分**: 締め（決定→次→保留→整備）
4. **会議後3分**: 一括整備（Triage）で"動ける状態"にする

## License

MIT
