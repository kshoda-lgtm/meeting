-- Add new meeting types: 1on1 and その他

-- Insert new meeting types
INSERT OR IGNORE INTO meeting_types (id, name, slug, description) VALUES
  (5, '1on1', 'one-on-one', '上司と部下の1対1ミーティング。成長支援・課題相談・フィードバック'),
  (6, 'その他', 'other', '上記に当てはまらない会議。臨時会議・プロジェクト会議など');

-- Set up permissions for new meeting types

-- 1on1 (id=5): participant can view own 1on1s, manager can manage
INSERT OR REPLACE INTO meeting_type_permissions (meeting_type_id, role, can_view, can_create, can_manage) VALUES
  (5, 'participant', 1, 0, 0),
  (5, 'manager', 1, 1, 1),
  (5, 'executive', 1, 1, 1);

-- その他 (id=6): everyone can view, manager+ can create/manage
INSERT OR REPLACE INTO meeting_type_permissions (meeting_type_id, role, can_view, can_create, can_manage) VALUES
  (6, 'participant', 1, 0, 0),
  (6, 'manager', 1, 1, 1),
  (6, 'executive', 1, 1, 1);
