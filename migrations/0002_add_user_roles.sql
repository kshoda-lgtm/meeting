-- Add role hierarchy: participant < manager < executive
-- executive: 戦略会議、本部会議、全体会議にアクセス可能
-- manager: チームMTG、本部会議、全体会議にアクセス可能（戦略会議は不可）
-- participant: チームMTGのみ

-- Add role column if not exists (SQLite doesn't support IF NOT EXISTS for columns)
-- We'll update the existing role values

-- Update existing users to have proper roles
UPDATE users SET role = 'executive' WHERE id IN (1); -- 田中 太郎 (トップ層)
UPDATE users SET role = 'manager' WHERE id IN (2);   -- 山田 花子 (リーダー)
UPDATE users SET role = 'participant' WHERE id NOT IN (1, 2); -- その他

-- Create table for meeting type access permissions
CREATE TABLE IF NOT EXISTS meeting_type_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_type_id INTEGER NOT NULL,
  role TEXT NOT NULL, -- participant, manager, executive
  can_view INTEGER NOT NULL DEFAULT 1,
  can_create INTEGER NOT NULL DEFAULT 0,
  can_manage INTEGER NOT NULL DEFAULT 0, -- Full control (edit agenda, confirm decisions, etc.)
  FOREIGN KEY (meeting_type_id) REFERENCES meeting_types(id),
  UNIQUE(meeting_type_id, role)
);

-- Set up permissions
-- チームMTG (id=1): participant can view, manager can manage
INSERT OR REPLACE INTO meeting_type_permissions (meeting_type_id, role, can_view, can_create, can_manage) VALUES
  (1, 'participant', 1, 0, 0),
  (1, 'manager', 1, 1, 1),
  (1, 'executive', 1, 1, 1);

-- 本部会議 (id=2): only manager and executive
INSERT OR REPLACE INTO meeting_type_permissions (meeting_type_id, role, can_view, can_create, can_manage) VALUES
  (2, 'participant', 0, 0, 0),
  (2, 'manager', 1, 1, 1),
  (2, 'executive', 1, 1, 1);

-- 戦略会議 (id=3): only executive
INSERT OR REPLACE INTO meeting_type_permissions (meeting_type_id, role, can_view, can_create, can_manage) VALUES
  (3, 'participant', 0, 0, 0),
  (3, 'manager', 0, 0, 0),
  (3, 'executive', 1, 1, 1);

-- 全体会議 (id=4): everyone can view, only executive can manage
INSERT OR REPLACE INTO meeting_type_permissions (meeting_type_id, role, can_view, can_create, can_manage) VALUES
  (4, 'participant', 1, 0, 0),
  (4, 'manager', 1, 0, 0),
  (4, 'executive', 1, 1, 1);

-- Create user sessions table for login
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
