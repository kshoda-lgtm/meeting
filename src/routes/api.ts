import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';

type Bindings = {
  DB: D1Database;
};

const api = new Hono<{ Bindings: Bindings }>();

// ==================== Users ====================
api.get('/users', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM users ORDER BY name'
  ).all();
  return c.json(results);
});

api.get('/users/:id', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(id).first();
  if (!result) return c.json({ error: 'User not found' }, 404);
  return c.json(result);
});

// ==================== Teams ====================
api.get('/teams', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM teams ORDER BY name'
  ).all();
  return c.json(results);
});

// ==================== Meeting Types ====================
api.get('/meeting-types', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM meeting_types ORDER BY id'
  ).all();
  return c.json(results);
});

// ==================== Clients ====================
api.get('/clients', async (c) => {
  const teamId = c.req.query('team_id');
  const status = c.req.query('status');
  
  let query = 'SELECT * FROM clients WHERE 1=1';
  const params: any[] = [];
  
  if (teamId) {
    query += ' AND team_id = ?';
    params.push(teamId);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY name';
  
  const stmt = c.env.DB.prepare(query);
  const { results } = await (params.length > 0 ? stmt.bind(...params) : stmt).all();
  return c.json(results);
});

api.post('/clients', async (c) => {
  const body = await c.req.json();
  const { organization_id, team_id, name, status = 'focus' } = body;
  
  const result = await c.env.DB.prepare(
    'INSERT INTO clients (organization_id, team_id, name, status) VALUES (?, ?, ?, ?) RETURNING *'
  ).bind(organization_id, team_id, name, status).first();
  
  return c.json(result, 201);
});

api.patch('/clients/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { status } = body;
  
  const result = await c.env.DB.prepare(
    'UPDATE clients SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *'
  ).bind(status, id).first();
  
  return c.json(result);
});

// ==================== Meetings ====================
api.get('/meetings', async (c) => {
  const typeSlug = c.req.query('type');
  const teamId = c.req.query('team_id');
  const status = c.req.query('status');
  
  let query = `
    SELECT m.*, mt.name as meeting_type_name, mt.slug as meeting_type_slug, t.name as team_name
    FROM meetings m
    JOIN meeting_types mt ON m.meeting_type_id = mt.id
    LEFT JOIN teams t ON m.team_id = t.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (typeSlug) {
    query += ' AND mt.slug = ?';
    params.push(typeSlug);
  }
  if (teamId) {
    query += ' AND m.team_id = ?';
    params.push(teamId);
  }
  if (status) {
    query += ' AND m.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY m.scheduled_at DESC';
  
  const stmt = c.env.DB.prepare(query);
  const { results } = await (params.length > 0 ? stmt.bind(...params) : stmt).all();
  return c.json(results);
});

api.get('/meetings/:id', async (c) => {
  const id = c.req.param('id');
  
  // Get meeting with type info
  const meeting = await c.env.DB.prepare(`
    SELECT m.*, mt.name as meeting_type_name, mt.slug as meeting_type_slug, t.name as team_name
    FROM meetings m
    JOIN meeting_types mt ON m.meeting_type_id = mt.id
    LEFT JOIN teams t ON m.team_id = t.id
    WHERE m.id = ?
  `).bind(id).first();
  
  if (!meeting) return c.json({ error: 'Meeting not found' }, 404);
  
  // Get all related data
  const [agenda, decisions, actions, issues, links, checkIns, participants] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM agenda_items WHERE meeting_id = ? ORDER BY order_index').bind(id).all(),
    c.env.DB.prepare(`
      SELECT d.*, u.name as creator_name, cu.name as confirmer_name
      FROM decisions d
      LEFT JOIN users u ON d.created_by = u.id
      LEFT JOIN users cu ON d.confirmed_by = cu.id
      WHERE d.meeting_id = ?
      ORDER BY d.created_at
    `).bind(id).all(),
    c.env.DB.prepare(`
      SELECT a.*, u.name as assignee_name, cu.name as creator_name
      FROM actions a
      LEFT JOIN users u ON a.assignee_id = u.id
      LEFT JOIN users cu ON a.created_by = cu.id
      WHERE a.meeting_id = ?
      ORDER BY a.created_at
    `).bind(id).all(),
    c.env.DB.prepare(`
      SELECT i.*, u.name as owner_name, t.name as team_name, cl.name as client_name
      FROM issues i
      LEFT JOIN users u ON i.owner_id = u.id
      LEFT JOIN teams t ON i.team_id = t.id
      LEFT JOIN clients cl ON i.client_id = cl.id
      WHERE i.meeting_id = ?
      ORDER BY i.created_at
    `).bind(id).all(),
    c.env.DB.prepare('SELECT * FROM links WHERE meeting_id = ?').bind(id).all(),
    c.env.DB.prepare(`
      SELECT ci.*, u.name as user_name
      FROM check_ins ci
      LEFT JOIN users u ON ci.user_id = u.id
      WHERE ci.meeting_id = ?
    `).bind(id).all(),
    c.env.DB.prepare(`
      SELECT u.*, mp.role as meeting_role
      FROM meeting_participants mp
      JOIN users u ON mp.user_id = u.id
      WHERE mp.meeting_id = ?
    `).bind(id).all()
  ]);
  
  const result: any = {
    ...meeting,
    agenda_items: agenda.results,
    decisions: decisions.results,
    actions: actions.results,
    issues: issues.results,
    links: links.results,
    check_ins: checkIns.results,
    participants: participants.results
  };
  
  // Get type-specific data
  const typeSlug = meeting.meeting_type_slug as string;
  
  if (typeSlug === 'team' && meeting.team_id) {
    // Get clients for team meeting
    const clients = await c.env.DB.prepare(
      'SELECT * FROM clients WHERE team_id = ? ORDER BY status, name'
    ).bind(meeting.team_id).all();
    
    const clientsWithDetails = await Promise.all(
      clients.results.map(async (client: any) => {
        const [initiatives, summary, seeds] = await Promise.all([
          c.env.DB.prepare('SELECT * FROM initiatives WHERE client_id = ?').bind(client.id).all(),
          c.env.DB.prepare('SELECT * FROM client_weekly_summaries WHERE client_id = ? AND meeting_id = ?').bind(client.id, id).first(),
          c.env.DB.prepare('SELECT * FROM proposal_seeds WHERE client_id = ? AND is_dormant = 0').bind(client.id).all()
        ]);
        return {
          ...client,
          initiatives: initiatives.results,
          weekly_summary: summary,
          proposal_seeds: seeds.results
        };
      })
    );
    
    result.clients = clientsWithDetails;
    
    // Get pending broadcasts for this team
    const pendingBroadcasts = await c.env.DB.prepare(`
      SELECT b.* FROM broadcasts b
      JOIN broadcast_targets bt ON b.id = bt.broadcast_id
      WHERE bt.team_id = ?
      AND NOT EXISTS (
        SELECT 1 FROM broadcast_consumptions bc
        WHERE bc.broadcast_id = b.id AND bc.team_id = ?
      )
    `).bind(meeting.team_id, meeting.team_id).all();
    
    result.pending_broadcasts = pendingBroadcasts.results;
  }
  
  if (typeSlug === 'headquarters') {
    const [broadcasts, ruleUpdates, crossTeamIssues] = await Promise.all([
      c.env.DB.prepare('SELECT * FROM broadcasts WHERE meeting_id = ?').bind(id).all(),
      c.env.DB.prepare('SELECT * FROM rule_updates WHERE meeting_id = ?').bind(id).all(),
      c.env.DB.prepare('SELECT i.*, t.name as team_name FROM issues i LEFT JOIN teams t ON i.team_id = t.id WHERE i.organization_id = ? AND i.team_id IS NULL AND i.resolved_at IS NULL').bind(meeting.organization_id).all()
    ]);
    
    result.broadcasts = broadcasts.results;
    result.rule_updates = ruleUpdates.results;
    result.cross_team_issues = crossTeamIssues.results;
  }
  
  if (typeSlug === 'strategy') {
    const [priorities, notDoing, allocations] = await Promise.all([
      c.env.DB.prepare('SELECT * FROM strategy_priorities WHERE meeting_id = ? ORDER BY priority_rank').bind(id).all(),
      c.env.DB.prepare('SELECT * FROM strategy_not_doing WHERE meeting_id = ?').bind(id).all(),
      c.env.DB.prepare('SELECT * FROM strategy_allocations WHERE meeting_id = ?').bind(id).all()
    ]);
    
    result.strategy_priorities = priorities.results;
    result.strategy_not_doing = notDoing.results;
    result.strategy_allocations = allocations.results;
  }
  
  // Get stagnation items (radar)
  const stagnationItems = await getStagnationItems(c.env.DB, meeting.organization_id as number, meeting.team_id as number | null);
  result.stagnation_items = stagnationItems;
  
  return c.json(result);
});

api.post('/meetings', async (c) => {
  const body = await c.req.json();
  const { organization_id, team_id, meeting_type_id, title, slug, scheduled_at } = body;
  
  const result = await c.env.DB.prepare(
    'INSERT INTO meetings (organization_id, team_id, meeting_type_id, title, slug, scheduled_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(organization_id, team_id || null, meeting_type_id, title, slug, scheduled_at).first();
  
  return c.json(result, 201);
});

api.patch('/meetings/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  
  const updates: string[] = [];
  const params: any[] = [];
  
  if (body.status !== undefined) {
    updates.push('status = ?');
    params.push(body.status);
    if (body.status === 'active') {
      updates.push('started_at = CURRENT_TIMESTAMP');
    } else if (body.status === 'completed') {
      updates.push('ended_at = CURRENT_TIMESTAMP');
    }
  }
  if (body.title !== undefined) {
    updates.push('title = ?');
    params.push(body.title);
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);
  
  const result = await c.env.DB.prepare(
    `UPDATE meetings SET ${updates.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...params).first();
  
  return c.json(result);
});

// ==================== Agenda Items ====================
api.post('/agenda-items', async (c) => {
  const body = await c.req.json();
  const { meeting_id, content, order_index = 0, created_by, is_from_broadcast = 0, broadcast_id = null } = body;
  
  const result = await c.env.DB.prepare(
    'INSERT INTO agenda_items (meeting_id, content, order_index, created_by, is_from_broadcast, broadcast_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(meeting_id, content, order_index, created_by, is_from_broadcast, broadcast_id).first();
  
  return c.json(result, 201);
});

api.patch('/agenda-items/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { content, order_index } = body;
  
  const updates: string[] = [];
  const params: any[] = [];
  
  if (content !== undefined) {
    updates.push('content = ?');
    params.push(content);
  }
  if (order_index !== undefined) {
    updates.push('order_index = ?');
    params.push(order_index);
  }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);
  
  const result = await c.env.DB.prepare(
    `UPDATE agenda_items SET ${updates.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...params).first();
  
  return c.json(result);
});

api.delete('/agenda-items/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM agenda_items WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ==================== Decisions ====================
api.post('/decisions', async (c) => {
  const body = await c.req.json();
  const { meeting_id, content, related_link, created_by, is_confirmed = 0 } = body;
  
  const result = await c.env.DB.prepare(
    'INSERT INTO decisions (meeting_id, content, related_link, created_by, is_confirmed) VALUES (?, ?, ?, ?, ?) RETURNING *'
  ).bind(meeting_id, content, related_link || null, created_by, is_confirmed).first();
  
  return c.json(result, 201);
});

api.patch('/decisions/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  
  const updates: string[] = [];
  const params: any[] = [];
  
  if (body.content !== undefined) {
    updates.push('content = ?');
    params.push(body.content);
  }
  if (body.related_link !== undefined) {
    updates.push('related_link = ?');
    params.push(body.related_link);
  }
  if (body.is_confirmed !== undefined) {
    updates.push('is_confirmed = ?');
    params.push(body.is_confirmed);
    if (body.is_confirmed && body.confirmed_by) {
      updates.push('confirmed_by = ?');
      params.push(body.confirmed_by);
      updates.push('confirmed_at = CURRENT_TIMESTAMP');
    }
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);
  
  const result = await c.env.DB.prepare(
    `UPDATE decisions SET ${updates.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...params).first();
  
  return c.json(result);
});

// ==================== Actions ====================
api.get('/actions', async (c) => {
  const meetingId = c.req.query('meeting_id');
  const assigneeId = c.req.query('assignee_id');
  const status = c.req.query('status');
  const tentative = c.req.query('tentative');
  
  let query = `
    SELECT a.*, u.name as assignee_name
    FROM actions a
    LEFT JOIN users u ON a.assignee_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (meetingId) {
    query += ' AND a.meeting_id = ?';
    params.push(meetingId);
  }
  if (assigneeId) {
    query += ' AND a.assignee_id = ?';
    params.push(assigneeId);
  }
  if (status) {
    query += ' AND a.status = ?';
    params.push(status);
  }
  if (tentative !== undefined) {
    query += ' AND a.is_tentative = ?';
    params.push(tentative === 'true' ? 1 : 0);
  }
  
  query += ' ORDER BY a.due_date NULLS LAST, a.created_at';
  
  const stmt = c.env.DB.prepare(query);
  const { results } = await (params.length > 0 ? stmt.bind(...params) : stmt).all();
  return c.json(results);
});

api.post('/actions', async (c) => {
  const body = await c.req.json();
  const { meeting_id, content, status = 'not_started', assignee_id, due_date, completion_criteria, waiting_reason, is_tentative = 1, created_by } = body;
  
  const result = await c.env.DB.prepare(
    'INSERT INTO actions (meeting_id, content, status, assignee_id, due_date, completion_criteria, waiting_reason, is_tentative, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(meeting_id, content, status, assignee_id || null, due_date || null, completion_criteria || null, waiting_reason || null, is_tentative, created_by).first();
  
  return c.json(result, 201);
});

api.patch('/actions/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  
  const updates: string[] = [];
  const params: any[] = [];
  
  const fields = ['content', 'status', 'assignee_id', 'due_date', 'completion_criteria', 'waiting_reason', 'is_tentative', 'snooze_until', 'exception_reason'];
  
  for (const field of fields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(body[field]);
    }
  }
  
  updates.push('last_updated_at = CURRENT_TIMESTAMP');
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);
  
  const result = await c.env.DB.prepare(
    `UPDATE actions SET ${updates.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...params).first();
  
  return c.json(result);
});

// Batch update for triage
api.post('/actions/triage', async (c) => {
  const body = await c.req.json();
  const { actions } = body; // Array of { id, assignee_id, due_date, is_tentative }
  
  const results = [];
  for (const action of actions) {
    const result = await c.env.DB.prepare(
      'UPDATE actions SET assignee_id = ?, due_date = ?, is_tentative = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *'
    ).bind(action.assignee_id || null, action.due_date || null, action.is_tentative ? 1 : 0, action.id).first();
    results.push(result);
  }
  
  return c.json(results);
});

// ==================== Issues ====================
api.get('/issues', async (c) => {
  const teamId = c.req.query('team_id');
  const clientId = c.req.query('client_id');
  const state = c.req.query('state');
  const resolved = c.req.query('resolved');
  
  let query = `
    SELECT i.*, u.name as owner_name, t.name as team_name, cl.name as client_name
    FROM issues i
    LEFT JOIN users u ON i.owner_id = u.id
    LEFT JOIN teams t ON i.team_id = t.id
    LEFT JOIN clients cl ON i.client_id = cl.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (teamId) {
    query += ' AND i.team_id = ?';
    params.push(teamId);
  }
  if (clientId) {
    query += ' AND i.client_id = ?';
    params.push(clientId);
  }
  if (state) {
    query += ' AND i.state = ?';
    params.push(state);
  }
  if (resolved === 'true') {
    query += ' AND i.resolved_at IS NOT NULL';
  } else if (resolved === 'false') {
    query += ' AND i.resolved_at IS NULL';
  }
  
  query += ' ORDER BY i.times_postponed DESC, i.created_at DESC';
  
  const stmt = c.env.DB.prepare(query);
  const { results } = await (params.length > 0 ? stmt.bind(...params) : stmt).all();
  return c.json(results);
});

api.post('/issues', async (c) => {
  const body = await c.req.json();
  const { meeting_id, organization_id, team_id, client_id, content, state = 'pending_decision', owner_id, created_by } = body;
  
  const result = await c.env.DB.prepare(
    'INSERT INTO issues (meeting_id, organization_id, team_id, client_id, content, state, owner_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(meeting_id || null, organization_id, team_id || null, client_id || null, content, state, owner_id || null, created_by).first();
  
  return c.json(result, 201);
});

api.patch('/issues/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  
  const updates: string[] = [];
  const params: any[] = [];
  
  const fields = ['content', 'state', 'owner_id', 'team_id', 'client_id', 'snooze_until', 'exception_reason', 'times_postponed'];
  
  for (const field of fields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(body[field]);
    }
  }
  
  if (body.resolved) {
    updates.push('resolved_at = CURRENT_TIMESTAMP');
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);
  
  const result = await c.env.DB.prepare(
    `UPDATE issues SET ${updates.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...params).first();
  
  return c.json(result);
});

// Convert issue to action
api.post('/issues/:id/convert-to-action', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { meeting_id, created_by } = body;
  
  const issue = await c.env.DB.prepare('SELECT * FROM issues WHERE id = ?').bind(id).first();
  if (!issue) return c.json({ error: 'Issue not found' }, 404);
  
  const action = await c.env.DB.prepare(
    'INSERT INTO actions (meeting_id, content, status, is_tentative, created_by) VALUES (?, ?, ?, 1, ?) RETURNING *'
  ).bind(meeting_id, issue.content, 'not_started', created_by).first();
  
  await c.env.DB.prepare(
    'UPDATE issues SET resolved_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(id).run();
  
  return c.json(action, 201);
});

// ==================== Check-ins ====================
api.post('/check-ins', async (c) => {
  const body = await c.req.json();
  const { meeting_id, user_id, confidence_score, uncertainty_factor, needs_help = false, is_anonymous = false } = body;
  
  // Upsert
  const existing = await c.env.DB.prepare(
    'SELECT id FROM check_ins WHERE meeting_id = ? AND user_id = ?'
  ).bind(meeting_id, user_id).first();
  
  let result;
  if (existing) {
    result = await c.env.DB.prepare(
      'UPDATE check_ins SET confidence_score = ?, uncertainty_factor = ?, needs_help = ?, is_anonymous = ? WHERE id = ? RETURNING *'
    ).bind(confidence_score, uncertainty_factor, needs_help ? 1 : 0, is_anonymous ? 1 : 0, existing.id).first();
  } else {
    result = await c.env.DB.prepare(
      'INSERT INTO check_ins (meeting_id, user_id, confidence_score, uncertainty_factor, needs_help, is_anonymous) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
    ).bind(meeting_id, user_id, confidence_score, uncertainty_factor, needs_help ? 1 : 0, is_anonymous ? 1 : 0).first();
  }
  
  return c.json(result, 201);
});

// ==================== Links ====================
api.post('/links', async (c) => {
  const body = await c.req.json();
  const { meeting_id, url, title, created_by } = body;
  
  const result = await c.env.DB.prepare(
    'INSERT INTO links (meeting_id, url, title, created_by) VALUES (?, ?, ?, ?) RETURNING *'
  ).bind(meeting_id, url, title || null, created_by).first();
  
  return c.json(result, 201);
});

api.delete('/links/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM links WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ==================== Quick Capture ====================
api.post('/quick-capture', async (c) => {
  const body = await c.req.json();
  const { meeting_id, input, created_by } = body;
  
  // Parse input: D:, A:, I: prefixes
  const trimmed = input.trim();
  let type: 'decision' | 'action' | 'issue' = 'action'; // Default to action
  let content = trimmed;
  
  if (trimmed.startsWith('D:') || trimmed.startsWith('d:')) {
    type = 'decision';
    content = trimmed.slice(2).trim();
  } else if (trimmed.startsWith('A:') || trimmed.startsWith('a:')) {
    type = 'action';
    content = trimmed.slice(2).trim();
  } else if (trimmed.startsWith('I:') || trimmed.startsWith('i:')) {
    type = 'issue';
    content = trimmed.slice(2).trim();
  }
  
  // Get meeting's organization_id
  const meeting = await c.env.DB.prepare('SELECT organization_id, team_id FROM meetings WHERE id = ?').bind(meeting_id).first();
  if (!meeting) return c.json({ error: 'Meeting not found' }, 404);
  
  let result;
  if (type === 'decision') {
    result = await c.env.DB.prepare(
      'INSERT INTO decisions (meeting_id, content, created_by, is_confirmed) VALUES (?, ?, ?, 0) RETURNING *'
    ).bind(meeting_id, content, created_by).first();
  } else if (type === 'action') {
    result = await c.env.DB.prepare(
      'INSERT INTO actions (meeting_id, content, status, is_tentative, created_by) VALUES (?, ?, ?, 1, ?) RETURNING *'
    ).bind(meeting_id, content, 'not_started', created_by).first();
  } else {
    result = await c.env.DB.prepare(
      'INSERT INTO issues (meeting_id, organization_id, team_id, content, state, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
    ).bind(meeting_id, meeting.organization_id, meeting.team_id || null, content, 'pending_decision', created_by).first();
  }
  
  return c.json({ type, item: result }, 201);
});

// ==================== Broadcasts (Company Decisions) ====================
api.get('/broadcasts', async (c) => {
  const orgId = c.req.query('organization_id');
  const unconsumedByTeam = c.req.query('unconsumed_by_team');
  
  let query = `
    SELECT b.*, u.name as creator_name
    FROM broadcasts b
    LEFT JOIN users u ON b.created_by = u.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (orgId) {
    query += ' AND b.organization_id = ?';
    params.push(orgId);
  }
  
  if (unconsumedByTeam) {
    query += ` AND EXISTS (
      SELECT 1 FROM broadcast_targets bt
      WHERE bt.broadcast_id = b.id AND bt.team_id = ?
    ) AND NOT EXISTS (
      SELECT 1 FROM broadcast_consumptions bc
      WHERE bc.broadcast_id = b.id AND bc.team_id = ?
    )`;
    params.push(unconsumedByTeam, unconsumedByTeam);
  }
  
  query += ' ORDER BY b.created_at DESC';
  
  const stmt = c.env.DB.prepare(query);
  const { results } = await (params.length > 0 ? stmt.bind(...params) : stmt).all();
  
  // Get targets for each broadcast
  const broadcastsWithTargets = await Promise.all(
    results.map(async (b: any) => {
      const targets = await c.env.DB.prepare(
        'SELECT t.* FROM teams t JOIN broadcast_targets bt ON t.id = bt.team_id WHERE bt.broadcast_id = ?'
      ).bind(b.id).all();
      const consumptions = await c.env.DB.prepare(
        'SELECT team_id FROM broadcast_consumptions WHERE broadcast_id = ?'
      ).bind(b.id).all();
      return {
        ...b,
        targets: targets.results,
        consumed_by_teams: consumptions.results.map((c: any) => c.team_id)
      };
    })
  );
  
  return c.json(broadcastsWithTargets);
});

api.post('/broadcasts', async (c) => {
  const body = await c.req.json();
  const { organization_id, meeting_id, content, background_link, effective_date, created_by, target_team_ids } = body;
  
  const broadcast = await c.env.DB.prepare(
    'INSERT INTO broadcasts (organization_id, meeting_id, content, background_link, effective_date, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(organization_id, meeting_id, content, background_link || null, effective_date || null, created_by).first();
  
  // Add targets
  if (target_team_ids && target_team_ids.length > 0) {
    for (const teamId of target_team_ids) {
      await c.env.DB.prepare(
        'INSERT INTO broadcast_targets (broadcast_id, team_id) VALUES (?, ?)'
      ).bind(broadcast!.id, teamId).run();
    }
  }
  
  return c.json(broadcast, 201);
});

// Consume broadcast (mark as handled by team)
api.post('/broadcasts/:id/consume', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { team_id, meeting_id, consumption_type, action_id, issue_id } = body;
  
  const result = await c.env.DB.prepare(
    'INSERT INTO broadcast_consumptions (broadcast_id, team_id, meeting_id, consumption_type, action_id, issue_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(id, team_id, meeting_id, consumption_type, action_id || null, issue_id || null).first();
  
  return c.json(result, 201);
});

// ==================== Initiatives ====================
api.post('/initiatives', async (c) => {
  const body = await c.req.json();
  const { client_id, meeting_id, name, status = 'not_started', dod, next_review_date, created_by } = body;
  
  const result = await c.env.DB.prepare(
    'INSERT INTO initiatives (client_id, meeting_id, name, status, dod, next_review_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(client_id, meeting_id || null, name, status, dod, next_review_date || null, created_by).first();
  
  return c.json(result, 201);
});

api.patch('/initiatives/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  
  const updates: string[] = [];
  const params: any[] = [];
  
  const fields = ['name', 'status', 'dod', 'next_review_date'];
  for (const field of fields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(body[field]);
    }
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);
  
  const result = await c.env.DB.prepare(
    `UPDATE initiatives SET ${updates.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...params).first();
  
  return c.json(result);
});

// ==================== Client Weekly Summaries ====================
api.post('/client-summaries', async (c) => {
  const body = await c.req.json();
  const { client_id, meeting_id, achievements, next_week_commitment } = body;
  
  // Upsert
  const existing = await c.env.DB.prepare(
    'SELECT id FROM client_weekly_summaries WHERE client_id = ? AND meeting_id = ?'
  ).bind(client_id, meeting_id).first();
  
  let result;
  if (existing) {
    result = await c.env.DB.prepare(
      'UPDATE client_weekly_summaries SET achievements = ?, next_week_commitment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *'
    ).bind(achievements || null, next_week_commitment || null, existing.id).first();
  } else {
    result = await c.env.DB.prepare(
      'INSERT INTO client_weekly_summaries (client_id, meeting_id, achievements, next_week_commitment) VALUES (?, ?, ?, ?) RETURNING *'
    ).bind(client_id, meeting_id, achievements || null, next_week_commitment || null).first();
  }
  
  return c.json(result, 201);
});

// ==================== Proposal Seeds ====================
api.post('/proposal-seeds', async (c) => {
  const body = await c.req.json();
  const { client_id, meeting_id, memo, next_action, created_by } = body;
  
  const result = await c.env.DB.prepare(
    'INSERT INTO proposal_seeds (client_id, meeting_id, memo, next_action, created_by) VALUES (?, ?, ?, ?, ?) RETURNING *'
  ).bind(client_id, meeting_id || null, memo, next_action || null, created_by).first();
  
  return c.json(result, 201);
});

api.patch('/proposal-seeds/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  
  const updates: string[] = [];
  const params: any[] = [];
  
  const fields = ['memo', 'next_action', 'action_id', 'is_dormant'];
  for (const field of fields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(body[field]);
    }
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);
  
  const result = await c.env.DB.prepare(
    `UPDATE proposal_seeds SET ${updates.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...params).first();
  
  return c.json(result);
});

// ==================== Strategy Meeting ====================
api.post('/strategy-priorities', async (c) => {
  const body = await c.req.json();
  const { meeting_id, priority_rank, content } = body;
  
  // Upsert
  const existing = await c.env.DB.prepare(
    'SELECT id FROM strategy_priorities WHERE meeting_id = ? AND priority_rank = ?'
  ).bind(meeting_id, priority_rank).first();
  
  let result;
  if (existing) {
    result = await c.env.DB.prepare(
      'UPDATE strategy_priorities SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *'
    ).bind(content, existing.id).first();
  } else {
    result = await c.env.DB.prepare(
      'INSERT INTO strategy_priorities (meeting_id, priority_rank, content) VALUES (?, ?, ?) RETURNING *'
    ).bind(meeting_id, priority_rank, content).first();
  }
  
  return c.json(result, 201);
});

api.post('/strategy-not-doing', async (c) => {
  const body = await c.req.json();
  const { meeting_id, content, reason } = body;
  
  const result = await c.env.DB.prepare(
    'INSERT INTO strategy_not_doing (meeting_id, content, reason) VALUES (?, ?, ?) RETURNING *'
  ).bind(meeting_id, content, reason || null).first();
  
  return c.json(result, 201);
});

api.post('/strategy-allocations', async (c) => {
  const body = await c.req.json();
  const { meeting_id, content } = body;
  
  const result = await c.env.DB.prepare(
    'INSERT INTO strategy_allocations (meeting_id, content) VALUES (?, ?) RETURNING *'
  ).bind(meeting_id, content).first();
  
  return c.json(result, 201);
});

// ==================== Rule Updates ====================
api.post('/rule-updates', async (c) => {
  const body = await c.req.json();
  const { meeting_id, change_description, impact, migration_steps, completion_criteria, created_by } = body;
  
  const result = await c.env.DB.prepare(
    'INSERT INTO rule_updates (meeting_id, change_description, impact, migration_steps, completion_criteria, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(meeting_id, change_description, impact || null, migration_steps || null, completion_criteria || null, created_by).first();
  
  return c.json(result, 201);
});

// ==================== Dashboard ====================
api.get('/dashboard', async (c) => {
  const orgId = c.req.query('organization_id') || 1;
  const teamId = c.req.query('team_id');
  
  // Action stats
  let actionQuery = 'SELECT status, COUNT(*) as count FROM actions WHERE meeting_id IN (SELECT id FROM meetings WHERE organization_id = ?)';
  if (teamId) actionQuery += ' AND meeting_id IN (SELECT id FROM meetings WHERE team_id = ?)';
  actionQuery += ' GROUP BY status';
  
  const actionStats = await c.env.DB.prepare(actionQuery).bind(orgId, ...(teamId ? [teamId] : [])).all();
  
  const totalActions = actionStats.results.reduce((sum: number, r: any) => sum + r.count, 0);
  const completedActions = actionStats.results.find((r: any) => r.status === 'completed')?.count || 0;
  
  // Overdue actions
  const overdueQuery = `
    SELECT COUNT(*) as count FROM actions 
    WHERE due_date < date('now') AND status NOT IN ('completed', 'on_hold')
    AND meeting_id IN (SELECT id FROM meetings WHERE organization_id = ?)
    ${teamId ? 'AND meeting_id IN (SELECT id FROM meetings WHERE team_id = ?)' : ''}
  `;
  const overdue = await c.env.DB.prepare(overdueQuery).bind(orgId, ...(teamId ? [teamId] : [])).first();
  
  // Tentative actions
  const tentativeQuery = `
    SELECT COUNT(*) as count FROM actions 
    WHERE is_tentative = 1
    AND meeting_id IN (SELECT id FROM meetings WHERE organization_id = ?)
    ${teamId ? 'AND meeting_id IN (SELECT id FROM meetings WHERE team_id = ?)' : ''}
  `;
  const tentative = await c.env.DB.prepare(tentativeQuery).bind(orgId, ...(teamId ? [teamId] : [])).first();
  
  // Stagnant issues
  const stagnantQuery = `
    SELECT COUNT(*) as count FROM issues 
    WHERE resolved_at IS NULL AND times_postponed >= 2
    AND organization_id = ?
    ${teamId ? 'AND team_id = ?' : ''}
  `;
  const stagnant = await c.env.DB.prepare(stagnantQuery).bind(orgId, ...(teamId ? [teamId] : [])).first();
  
  // Average confidence
  const confidenceQuery = `
    SELECT AVG(confidence_score) as avg FROM check_ins
    WHERE meeting_id IN (
      SELECT id FROM meetings 
      WHERE organization_id = ? AND scheduled_at >= date('now', '-7 days')
      ${teamId ? 'AND team_id = ?' : ''}
    )
  `;
  const confidence = await c.env.DB.prepare(confidenceQuery).bind(orgId, ...(teamId ? [teamId] : [])).first();
  
  return c.json({
    action_completion_rate: totalActions > 0 ? (completedActions / totalActions) * 100 : 0,
    overdue_actions_count: (overdue as any)?.count || 0,
    tentative_actions_count: (tentative as any)?.count || 0,
    stagnant_issues_count: (stagnant as any)?.count || 0,
    avg_confidence_score: (confidence as any)?.avg || 0
  });
});

// ==================== Triage View ====================
api.get('/triage', async (c) => {
  const meetingId = c.req.query('meeting_id');
  
  let query = `
    SELECT a.*, u.name as assignee_name, m.title as meeting_title
    FROM actions a
    LEFT JOIN users u ON a.assignee_id = u.id
    LEFT JOIN meetings m ON a.meeting_id = m.id
    WHERE a.is_tentative = 1 OR a.assignee_id IS NULL OR a.due_date IS NULL
  `;
  
  if (meetingId) {
    query += ' AND a.meeting_id = ?';
    const { results } = await c.env.DB.prepare(query).bind(meetingId).all();
    return c.json(results);
  }
  
  query += ' ORDER BY a.created_at DESC';
  const { results } = await c.env.DB.prepare(query).all();
  return c.json(results);
});

// Helper function to get stagnation items
async function getStagnationItems(db: D1Database, orgId: number, teamId: number | null): Promise<any[]> {
  const items: any[] = [];
  const today = new Date().toISOString().split('T')[0];
  
  // Overdue actions
  let overdueQuery = `
    SELECT a.*, u.name as assignee_name FROM actions a
    LEFT JOIN users u ON a.assignee_id = u.id
    WHERE a.due_date < ? AND a.status NOT IN ('completed', 'on_hold')
    AND (a.snooze_until IS NULL OR a.snooze_until < ?)
    AND a.meeting_id IN (SELECT id FROM meetings WHERE organization_id = ?)
  `;
  if (teamId) overdueQuery += ' AND a.meeting_id IN (SELECT id FROM meetings WHERE team_id = ?)';
  
  const overdueActions = await db.prepare(overdueQuery).bind(today, today, orgId, ...(teamId ? [teamId] : [])).all();
  for (const a of overdueActions.results) {
    items.push({
      type: 'overdue_action',
      entity_type: 'action',
      entity_id: a.id,
      content: a.content,
      assignee_name: a.assignee_name,
      due_date: a.due_date
    });
  }
  
  // Stale actions (not updated in 7 days)
  let staleQuery = `
    SELECT a.*, u.name as assignee_name,
    CAST((julianday('now') - julianday(a.last_updated_at)) AS INTEGER) as days_stagnant
    FROM actions a
    LEFT JOIN users u ON a.assignee_id = u.id
    WHERE a.status NOT IN ('completed', 'on_hold', 'waiting')
    AND julianday('now') - julianday(a.last_updated_at) >= 7
    AND (a.snooze_until IS NULL OR a.snooze_until < ?)
    AND a.meeting_id IN (SELECT id FROM meetings WHERE organization_id = ?)
  `;
  if (teamId) staleQuery += ' AND a.meeting_id IN (SELECT id FROM meetings WHERE team_id = ?)';
  
  const staleActions = await db.prepare(staleQuery).bind(today, orgId, ...(teamId ? [teamId] : [])).all();
  for (const a of staleActions.results) {
    items.push({
      type: 'stale_action',
      entity_type: 'action',
      entity_id: a.id,
      content: a.content,
      assignee_name: a.assignee_name,
      days_stagnant: a.days_stagnant
    });
  }
  
  // Unassigned actions
  let unassignedQuery = `
    SELECT a.* FROM actions a
    WHERE a.assignee_id IS NULL AND a.status NOT IN ('completed', 'on_hold')
    AND (a.snooze_until IS NULL OR a.snooze_until < ?)
    AND a.meeting_id IN (SELECT id FROM meetings WHERE organization_id = ?)
  `;
  if (teamId) unassignedQuery += ' AND a.meeting_id IN (SELECT id FROM meetings WHERE team_id = ?)';
  
  const unassignedActions = await db.prepare(unassignedQuery).bind(today, orgId, ...(teamId ? [teamId] : [])).all();
  for (const a of unassignedActions.results) {
    items.push({
      type: 'unassigned_action',
      entity_type: 'action',
      entity_id: a.id,
      content: a.content
    });
  }
  
  // Long waiting actions (3+ days)
  let waitingQuery = `
    SELECT a.*, u.name as assignee_name,
    CAST((julianday('now') - julianday(a.last_updated_at)) AS INTEGER) as days_stagnant
    FROM actions a
    LEFT JOIN users u ON a.assignee_id = u.id
    WHERE a.status = 'waiting'
    AND julianday('now') - julianday(a.last_updated_at) >= 3
    AND (a.snooze_until IS NULL OR a.snooze_until < ?)
    AND a.meeting_id IN (SELECT id FROM meetings WHERE organization_id = ?)
  `;
  if (teamId) waitingQuery += ' AND a.meeting_id IN (SELECT id FROM meetings WHERE team_id = ?)';
  
  const waitingActions = await db.prepare(waitingQuery).bind(today, orgId, ...(teamId ? [teamId] : [])).all();
  for (const a of waitingActions.results) {
    items.push({
      type: 'long_waiting',
      entity_type: 'action',
      entity_id: a.id,
      content: a.content,
      assignee_name: a.assignee_name,
      days_stagnant: a.days_stagnant
    });
  }
  
  // Repeatedly postponed issues (2+ times)
  let postponedQuery = `
    SELECT i.*, u.name as owner_name FROM issues i
    LEFT JOIN users u ON i.owner_id = u.id
    WHERE i.resolved_at IS NULL AND i.times_postponed >= 2
    AND (i.snooze_until IS NULL OR i.snooze_until < ?)
    AND i.organization_id = ?
  `;
  if (teamId) postponedQuery += ' AND i.team_id = ?';
  
  const postponedIssues = await db.prepare(postponedQuery).bind(today, orgId, ...(teamId ? [teamId] : [])).all();
  for (const i of postponedIssues.results) {
    items.push({
      type: 'postponed_issue',
      entity_type: 'issue',
      entity_id: i.id,
      content: i.content,
      owner_name: i.owner_name,
      times_postponed: i.times_postponed
    });
  }
  
  return items;
}

// ==================== Snooze/Exception ====================
api.post('/snooze', async (c) => {
  const body = await c.req.json();
  const { entity_type, entity_id, snooze_until, exception_reason } = body;
  
  const table = entity_type === 'action' ? 'actions' : 'issues';
  
  const result = await c.env.DB.prepare(
    `UPDATE ${table} SET snooze_until = ?, exception_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *`
  ).bind(snooze_until || null, exception_reason || null, entity_id).first();
  
  return c.json(result);
});

export default api;
