-- VEXUM Meeting OS Seed Data

-- Insert meeting types
INSERT OR IGNORE INTO meeting_types (id, name, slug, description) VALUES
  (1, 'チームMTG', 'team', '常駐先単位で施策進捗・品質・来週コミット・提案のタネを整理'),
  (2, '本部会議', 'headquarters', 'リーダー/副リーダー。会社決定の共有・運用統制・横断詰まり解消'),
  (3, '戦略会議', 'strategy', 'V2。優先順位・配分・トレードオフ・重大判断に集中'),
  (4, '全体会議', 'all-hands', '本部決定の要点共有、月次振り返り、横展開'),
  (5, '1on1', 'one-on-one', '上司と部下の1対1ミーティング。成長支援・課題相談・フィードバック'),
  (6, 'その他', 'other', '上記に当てはまらない会議。臨時会議・プロジェクト会議など');

-- Insert demo organization
INSERT OR IGNORE INTO organizations (id, name) VALUES (1, 'VEXUM株式会社');

-- Insert demo teams
INSERT OR IGNORE INTO teams (id, organization_id, name) VALUES
  (1, 1, 'Alpha'),
  (2, 1, 'Beta'),
  (3, 1, 'Gamma');

-- Insert demo users with role hierarchy
-- executive: トップ層（戦略会議にアクセス可能）
-- manager: リーダー/副リーダー（本部会議にアクセス可能）
-- participant: 一般メンバー（チームMTGのみ）
INSERT OR IGNORE INTO users (id, organization_id, email, name, role) VALUES
  (1, 1, 'tanaka@vexum.co.jp', '田中 太郎', 'executive'),
  (2, 1, 'yamada@vexum.co.jp', '山田 花子', 'manager'),
  (3, 1, 'suzuki@vexum.co.jp', '鈴木 一郎', 'participant'),
  (4, 1, 'sato@vexum.co.jp', '佐藤 美咲', 'participant'),
  (5, 1, 'ito@vexum.co.jp', '伊藤 健太', 'participant'),
  (6, 1, 'watanabe@vexum.co.jp', '渡辺 裕子', 'participant');

-- Insert team memberships
INSERT OR IGNORE INTO team_members (team_id, user_id, role) VALUES
  (1, 1, 'manager'),
  (1, 3, 'participant'),
  (1, 4, 'participant'),
  (2, 2, 'manager'),
  (2, 5, 'participant'),
  (2, 6, 'participant'),
  (3, 1, 'manager'),
  (3, 2, 'manager');

-- Insert demo clients for team 1
INSERT OR IGNORE INTO clients (id, organization_id, team_id, name, status) VALUES
  (1, 1, 1, '株式会社ABC', 'focus'),
  (2, 1, 1, 'XYZホールディングス', 'focus'),
  (3, 1, 1, 'テスト商事', 'all'),
  (4, 1, 1, '旧クライアント', 'dormant'),
  (5, 1, 2, 'DEF Industries', 'focus'),
  (6, 1, 2, 'GHI Corporation', 'focus');

-- Insert demo meetings
INSERT OR IGNORE INTO meetings (id, organization_id, team_id, meeting_type_id, title, slug, scheduled_at, status) VALUES
  (1, 1, 1, 1, 'Alpha チームMTG 第1週', 'alpha-team-w1', datetime('now', '+1 day'), 'scheduled'),
  (2, 1, 2, 1, 'Beta チームMTG 第1週', 'beta-team-w1', datetime('now', '+2 day'), 'scheduled'),
  (3, 1, NULL, 2, '本部会議 第1週', 'hq-w1', datetime('now', '+3 day'), 'scheduled'),
  (4, 1, NULL, 3, '戦略会議 第1週', 'strategy-w1', datetime('now', '+4 day'), 'scheduled'),
  (5, 1, NULL, 4, '全体会議 1月', 'all-hands-jan', datetime('now', '+7 day'), 'scheduled');

-- Insert meeting participants
INSERT OR IGNORE INTO meeting_participants (meeting_id, user_id, role) VALUES
  -- Alpha team meeting
  (1, 1, 'manager'),
  (1, 3, 'participant'),
  (1, 4, 'participant'),
  -- Beta team meeting
  (2, 2, 'manager'),
  (2, 5, 'participant'),
  (2, 6, 'participant'),
  -- HQ meeting
  (3, 1, 'manager'),
  (3, 2, 'manager'),
  -- Strategy meeting
  (4, 1, 'manager'),
  (4, 2, 'manager'),
  -- All hands
  (5, 1, 'manager'),
  (5, 2, 'manager'),
  (5, 3, 'participant'),
  (5, 4, 'participant'),
  (5, 5, 'participant'),
  (5, 6, 'participant');

-- Insert demo agenda items
INSERT OR IGNORE INTO agenda_items (id, meeting_id, content, order_index, created_by) VALUES
  (1, 1, '先週の振り返り', 1, 1),
  (2, 1, 'ABC社の進捗確認', 2, 1),
  (3, 1, 'XYZ社の新規提案について', 3, 1),
  (4, 3, '新人事制度の説明', 1, 1),
  (5, 3, '横断課題の共有', 2, 1),
  (6, 4, 'Q1優先順位の確定', 1, 1);

-- Insert demo actions
INSERT OR IGNORE INTO actions (id, meeting_id, content, status, assignee_id, due_date, is_tentative, created_by) VALUES
  (1, 1, 'ABC社への提案書作成', 'in_progress', 3, date('now', '+3 day'), 0, 1),
  (2, 1, 'XYZ社ヒアリング日程調整', 'not_started', 4, date('now', '+5 day'), 1, 1),
  (3, 1, '月次レポート作成', 'waiting', NULL, date('now', '+7 day'), 1, 1),
  (4, 3, '新人事制度の周知', 'not_started', 1, date('now', '+14 day'), 0, 1);

-- Insert demo issues
INSERT OR IGNORE INTO issues (id, meeting_id, organization_id, team_id, content, state, owner_id, created_by) VALUES
  (1, 1, 1, 1, 'ABC社の予算承認が遅れている', 'waiting', 1, 3),
  (2, 1, 1, 1, 'XYZ社の担当者変更の影響', 'unknown', NULL, 4),
  (3, 3, 1, NULL, '採用計画の見直しが必要', 'pending_decision', 1, 1);

-- Insert demo initiatives
INSERT OR IGNORE INTO initiatives (id, client_id, meeting_id, name, status, dod, next_review_date, created_by) VALUES
  (1, 1, 1, 'クラウド移行支援', 'in_progress', '移行完了率80%達成', date('now', '+7 day'), 1),
  (2, 1, 1, 'セキュリティ監査', 'not_started', '監査レポート提出', date('now', '+14 day'), 1),
  (3, 2, 1, 'DX推進コンサル', 'reviewing', 'ロードマップ承認', date('now', '+7 day'), 1);

-- Insert demo client weekly summaries
INSERT OR IGNORE INTO client_weekly_summaries (client_id, meeting_id, achievements, next_week_commitment) VALUES
  (1, 1, 'クラウド移行Phase1完了\nセキュリティ要件定義完了', '移行Phase2着手\n監査準備開始'),
  (2, 1, 'ヒアリング2回実施', 'DXロードマップ素案作成');

-- Insert demo proposal seeds
INSERT OR IGNORE INTO proposal_seeds (id, client_id, meeting_id, memo, next_action, created_by) VALUES
  (1, 1, 1, '経理部門のRPA化に興味あり', 'hearing', 1),
  (2, 2, 1, '来年度のIT予算増額の噂', 'internal_consultation', 1);

-- Insert demo broadcasts
INSERT OR IGNORE INTO broadcasts (id, organization_id, meeting_id, content, effective_date, created_by) VALUES
  (1, 1, 3, '新人事評価制度の導入', date('now', '+30 day'), 1),
  (2, 1, 3, 'リモートワーク規定の改定', date('now', '+14 day'), 1);

-- Insert broadcast targets
INSERT OR IGNORE INTO broadcast_targets (broadcast_id, team_id) VALUES
  (1, 1),
  (1, 2),
  (1, 3),
  (2, 1),
  (2, 2);
