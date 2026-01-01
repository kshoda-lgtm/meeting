-- VEXUM Meeting OS Database Schema
-- Initial migration for all core tables

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'participant', -- participant | manager
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Team memberships
CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'participant', -- participant | manager
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(team_id, user_id)
);

-- Meeting Types (templates)
CREATE TABLE IF NOT EXISTS meeting_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, -- チームMTG, 本部会議, 戦略会議, 全体会議
  slug TEXT UNIQUE NOT NULL, -- team, headquarters, strategy, all-hands
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Meetings
CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  team_id INTEGER, -- nullable for org-wide meetings
  meeting_type_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  scheduled_at DATETIME NOT NULL,
  started_at DATETIME,
  ended_at DATETIME,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | active | completed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (meeting_type_id) REFERENCES meeting_types(id),
  UNIQUE(organization_id, slug)
);

-- Meeting participants
CREATE TABLE IF NOT EXISTS meeting_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'participant', -- participant | manager
  joined_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(meeting_id, user_id)
);

-- Clients (for team MTG client board)
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'focus', -- focus | all | dormant
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (team_id) REFERENCES teams(id)
);

-- Agenda Items
CREATE TABLE IF NOT EXISTS agenda_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_from_broadcast INTEGER NOT NULL DEFAULT 0, -- Auto-injected from company decision
  broadcast_id INTEGER, -- Reference to source broadcast
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Decisions
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  related_link TEXT,
  is_confirmed INTEGER NOT NULL DEFAULT 0, -- 0=proposed, 1=confirmed
  created_by INTEGER NOT NULL,
  confirmed_by INTEGER,
  confirmed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (confirmed_by) REFERENCES users(id)
);

-- Actions (次やること)
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started', -- not_started, in_progress, reviewing, completed, waiting, on_hold
  assignee_id INTEGER, -- nullable for unassigned
  due_date DATE, -- nullable for unset
  completion_criteria TEXT,
  waiting_reason TEXT,
  is_tentative INTEGER NOT NULL DEFAULT 1, -- 1=tentative, 0=confirmed
  snooze_until DATE,
  exception_reason TEXT, -- 外部待ち, 優先度低, 長期施策, 仕様待ち, 依頼待ち
  last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id),
  FOREIGN KEY (assignee_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Issues (保留箱)
CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER, -- Original meeting where raised
  organization_id INTEGER NOT NULL,
  team_id INTEGER,
  client_id INTEGER,
  content TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending_decision', -- pending_decision, waiting, unknown, stuck, insufficient, concern
  owner_id INTEGER, -- nullable
  times_postponed INTEGER NOT NULL DEFAULT 0, -- For detecting repeatedly postponed issues
  snooze_until DATE,
  exception_reason TEXT,
  resolved_at DATETIME,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Check-ins
CREATE TABLE IF NOT EXISTS check_ins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  confidence_score INTEGER NOT NULL CHECK(confidence_score >= 0 AND confidence_score <= 10),
  uncertainty_factor TEXT NOT NULL, -- pending_decision, waiting, unknown, stuck, insufficient, concern
  needs_help INTEGER NOT NULL DEFAULT 0, -- 0=No, 1=Yes
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(meeting_id, user_id)
);

-- Initiatives (打ち手/施策 for team MTG)
CREATE TABLE IF NOT EXISTS initiatives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  meeting_id INTEGER, -- Meeting where created
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started', -- Same as action status
  dod TEXT NOT NULL, -- Definition of Done (required)
  next_review_date DATE,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (meeting_id) REFERENCES meetings(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Client weekly summary (for team MTG client board)
CREATE TABLE IF NOT EXISTS client_weekly_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  meeting_id INTEGER NOT NULL,
  achievements TEXT, -- 今週の成果 (max 3 lines)
  next_week_commitment TEXT, -- 来週やること
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (meeting_id) REFERENCES meetings(id),
  UNIQUE(client_id, meeting_id)
);

-- Proposal seeds (提案のタネ/芽メモ)
CREATE TABLE IF NOT EXISTS proposal_seeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  meeting_id INTEGER, -- Meeting where created
  memo TEXT NOT NULL, -- 気配メモ
  next_action TEXT, -- ヒアリング, 提案書, 概算見積, 社内相談, 打診
  action_id INTEGER, -- Link to created action
  is_dormant INTEGER NOT NULL DEFAULT 0, -- Moved to dormant
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (meeting_id) REFERENCES meetings(id),
  FOREIGN KEY (action_id) REFERENCES actions(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Broadcasts (会社決定 for headquarters meeting)
CREATE TABLE IF NOT EXISTS broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  meeting_id INTEGER NOT NULL, -- HQ meeting where announced
  content TEXT NOT NULL,
  background_link TEXT,
  effective_date DATE,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (meeting_id) REFERENCES meetings(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Broadcast targets (which teams should consume)
CREATE TABLE IF NOT EXISTS broadcast_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  broadcast_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  UNIQUE(broadcast_id, team_id)
);

-- Broadcast read receipts
CREATE TABLE IF NOT EXISTS broadcast_read_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  broadcast_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(broadcast_id, user_id)
);

-- Broadcast consumption (when team processes the broadcast)
CREATE TABLE IF NOT EXISTS broadcast_consumptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  broadcast_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  meeting_id INTEGER NOT NULL, -- Team meeting where consumed
  consumption_type TEXT NOT NULL, -- acknowledged, actioned, held, resolved
  action_id INTEGER, -- If converted to action
  issue_id INTEGER, -- If converted to issue
  consumed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (meeting_id) REFERENCES meetings(id),
  FOREIGN KEY (action_id) REFERENCES actions(id),
  FOREIGN KEY (issue_id) REFERENCES issues(id),
  UNIQUE(broadcast_id, team_id)
);

-- Links (資料リンク)
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Strategy meeting specific: TOP3 priorities
CREATE TABLE IF NOT EXISTS strategy_priorities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL,
  priority_rank INTEGER NOT NULL CHECK(priority_rank >= 1 AND priority_rank <= 3),
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id),
  UNIQUE(meeting_id, priority_rank)
);

-- Strategy meeting specific: Not doing items
CREATE TABLE IF NOT EXISTS strategy_not_doing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id)
);

-- Strategy meeting specific: Resource allocation
CREATE TABLE IF NOT EXISTS strategy_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL,
  content TEXT NOT NULL, -- 人/時間の短文メモ
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id)
);

-- HQ meeting specific: Rule updates
CREATE TABLE IF NOT EXISTS rule_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL,
  change_description TEXT NOT NULL,
  impact TEXT,
  migration_steps TEXT,
  completion_criteria TEXT,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Audit log for changes
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL, -- decision, action, issue
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL, -- create, update, delete
  old_value TEXT, -- JSON
  new_value TEXT, -- JSON
  user_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Suggestions (提案Action/提案Decision)
CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL,
  suggestion_type TEXT NOT NULL, -- action | decision
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  created_by INTEGER NOT NULL,
  reviewed_by INTEGER,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetings_org ON meetings(organization_id);
CREATE INDEX IF NOT EXISTS idx_meetings_team ON meetings(team_id);
CREATE INDEX IF NOT EXISTS idx_meetings_type ON meetings(meeting_type_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_actions_meeting ON actions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_actions_assignee ON actions(assignee_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
CREATE INDEX IF NOT EXISTS idx_actions_due ON actions(due_date);
CREATE INDEX IF NOT EXISTS idx_issues_org ON issues(organization_id);
CREATE INDEX IF NOT EXISTS idx_issues_team ON issues(team_id);
CREATE INDEX IF NOT EXISTS idx_issues_state ON issues(state);
CREATE INDEX IF NOT EXISTS idx_broadcasts_org ON broadcasts(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_team ON clients(team_id);
CREATE INDEX IF NOT EXISTS idx_initiatives_client ON initiatives(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
