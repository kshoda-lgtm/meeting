// VEXUM Meeting OS Type Definitions

export type UserRole = 'participant' | 'manager';

export type MeetingTypeSlug = 'team' | 'headquarters' | 'strategy' | 'all-hands';

export type MeetingStatus = 'scheduled' | 'active' | 'completed';

export type ActionStatus = 'not_started' | 'in_progress' | 'reviewing' | 'completed' | 'waiting' | 'on_hold';

export type IssueState = 'pending_decision' | 'waiting' | 'unknown' | 'stuck' | 'insufficient' | 'concern';

export type ClientStatus = 'focus' | 'all' | 'dormant';

export type ConsumptionType = 'acknowledged' | 'actioned' | 'held' | 'resolved';

export type ExceptionReason = 'external_wait' | 'low_priority' | 'long_term' | 'spec_wait' | 'request_wait';

export type NextActionType = 'hearing' | 'proposal' | 'estimate' | 'internal_consultation' | 'approach';

export interface User {
  id: number;
  organization_id: number;
  email: string;
  name: string;
  role: UserRole;
}

export interface Team {
  id: number;
  organization_id: number;
  name: string;
}

export interface MeetingType {
  id: number;
  name: string;
  slug: MeetingTypeSlug;
  description: string;
}

export interface Meeting {
  id: number;
  organization_id: number;
  team_id: number | null;
  meeting_type_id: number;
  title: string;
  slug: string;
  scheduled_at: string;
  started_at: string | null;
  ended_at: string | null;
  status: MeetingStatus;
  // Joined fields
  meeting_type?: MeetingType;
  team?: Team;
}

export interface AgendaItem {
  id: number;
  meeting_id: number;
  content: string;
  order_index: number;
  is_from_broadcast: boolean;
  broadcast_id: number | null;
  created_by: number;
}

export interface Decision {
  id: number;
  meeting_id: number;
  content: string;
  related_link: string | null;
  is_confirmed: boolean;
  created_by: number;
  confirmed_by: number | null;
  confirmed_at: string | null;
  // Joined
  creator?: User;
  confirmer?: User;
}

export interface Action {
  id: number;
  meeting_id: number;
  content: string;
  status: ActionStatus;
  assignee_id: number | null;
  due_date: string | null;
  completion_criteria: string | null;
  waiting_reason: string | null;
  is_tentative: boolean;
  snooze_until: string | null;
  exception_reason: ExceptionReason | null;
  last_updated_at: string;
  created_by: number;
  // Joined
  assignee?: User;
  creator?: User;
}

export interface Issue {
  id: number;
  meeting_id: number | null;
  organization_id: number;
  team_id: number | null;
  client_id: number | null;
  content: string;
  state: IssueState;
  owner_id: number | null;
  times_postponed: number;
  snooze_until: string | null;
  exception_reason: ExceptionReason | null;
  resolved_at: string | null;
  created_by: number;
  // Joined
  owner?: User;
  team?: Team;
  client?: Client;
}

export interface Client {
  id: number;
  organization_id: number;
  team_id: number;
  name: string;
  status: ClientStatus;
}

export interface CheckIn {
  id: number;
  meeting_id: number;
  user_id: number;
  confidence_score: number;
  uncertainty_factor: IssueState;
  needs_help: boolean;
  is_anonymous: boolean;
  // Joined
  user?: User;
}

export interface Initiative {
  id: number;
  client_id: number;
  meeting_id: number | null;
  name: string;
  status: ActionStatus;
  dod: string;
  next_review_date: string | null;
  created_by: number;
}

export interface ClientWeeklySummary {
  id: number;
  client_id: number;
  meeting_id: number;
  achievements: string | null;
  next_week_commitment: string | null;
}

export interface ProposalSeed {
  id: number;
  client_id: number;
  meeting_id: number | null;
  memo: string;
  next_action: NextActionType | null;
  action_id: number | null;
  is_dormant: boolean;
  created_by: number;
}

export interface Broadcast {
  id: number;
  organization_id: number;
  meeting_id: number;
  content: string;
  background_link: string | null;
  effective_date: string | null;
  created_by: number;
  // Joined
  targets?: Team[];
  consumed_by_teams?: number[];
}

export interface BroadcastConsumption {
  id: number;
  broadcast_id: number;
  team_id: number;
  meeting_id: number;
  consumption_type: ConsumptionType;
  action_id: number | null;
  issue_id: number | null;
}

export interface Link {
  id: number;
  meeting_id: number;
  url: string;
  title: string | null;
  created_by: number;
}

export interface StrategyPriority {
  id: number;
  meeting_id: number;
  priority_rank: number;
  content: string;
}

export interface StrategyNotDoing {
  id: number;
  meeting_id: number;
  content: string;
  reason: string | null;
}

export interface StrategyAllocation {
  id: number;
  meeting_id: number;
  content: string;
}

export interface RuleUpdate {
  id: number;
  meeting_id: number;
  change_description: string;
  impact: string | null;
  migration_steps: string | null;
  completion_criteria: string | null;
  created_by: number;
}

// Radar/Stagnation detection types
export interface StagnationItem {
  type: 'overdue_action' | 'stale_action' | 'unassigned_action' | 'long_waiting' | 'postponed_issue';
  entity_type: 'action' | 'issue';
  entity_id: number;
  content: string;
  days_stagnant?: number;
  assignee?: User;
  due_date?: string;
  times_postponed?: number;
}

// API Response types
export interface MeetingDetail extends Meeting {
  agenda_items: AgendaItem[];
  decisions: Decision[];
  actions: Action[];
  issues: Issue[];
  links: Link[];
  check_ins: CheckIn[];
  participants: User[];
  // Type-specific
  clients?: ClientWithDetails[];
  broadcasts?: Broadcast[];
  pending_broadcasts?: Broadcast[];
  rule_updates?: RuleUpdate[];
  strategy_priorities?: StrategyPriority[];
  strategy_not_doing?: StrategyNotDoing[];
  strategy_allocations?: StrategyAllocation[];
  stagnation_items?: StagnationItem[];
}

export interface ClientWithDetails extends Client {
  initiatives: Initiative[];
  weekly_summary: ClientWeeklySummary | null;
  proposal_seeds: ProposalSeed[];
}

// Dashboard types
export interface DashboardStats {
  action_completion_rate: number;
  overdue_actions_count: number;
  tentative_actions_count: number;
  stagnant_issues_count: number;
  avg_confidence_score: number;
}

// Status labels (Japanese)
export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  not_started: '未着手',
  in_progress: '進行中',
  reviewing: '確認中',
  completed: '完了',
  waiting: '待ち',
  on_hold: '保留'
};

export const ISSUE_STATE_LABELS: Record<IssueState, string> = {
  pending_decision: '判断待ち',
  waiting: '待ち',
  unknown: '不明点',
  stuck: '詰まり',
  insufficient: '不足',
  concern: '不安要素'
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  focus: 'Focus',
  all: '全件',
  dormant: '休眠'
};

export const EXCEPTION_REASON_LABELS: Record<ExceptionReason, string> = {
  external_wait: '外部待ち',
  low_priority: '優先度低',
  long_term: '長期施策',
  spec_wait: '仕様待ち',
  request_wait: '依頼待ち'
};

export const NEXT_ACTION_LABELS: Record<NextActionType, string> = {
  hearing: 'ヒアリング',
  proposal: '提案書',
  estimate: '概算見積',
  internal_consultation: '社内相談',
  approach: '打診'
};

export const MEETING_TYPE_LABELS: Record<MeetingTypeSlug, string> = {
  team: 'チームMTG',
  headquarters: '本部会議',
  strategy: '戦略会議',
  'all-hands': '全体会議'
};
