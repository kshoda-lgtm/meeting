import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-pages';
import type { D1Database } from '@cloudflare/workers-types';
import api from './routes/api';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS
app.use('/api/*', cors());

// Mount API routes
app.route('/api', api);

// Serve static files
app.use('/static/*', serveStatic());

// Main HTML page
const renderPage = (title: string, content: string, scripts: string = '') => `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - VEXUM Meeting OS</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/locale/ja.js"></script>
    <script>dayjs.locale('ja')</script>
    <style>
      .meeting-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
      .status-badge { padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
      .tab-active { border-bottom: 2px solid #3B82F6; color: #3B82F6; }
      .quick-capture-input:focus { outline: none; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5); }
      .radar-item { border-left: 3px solid #EF4444; }
      .radar-item.snoozed { border-left-color: #9CA3AF; opacity: 0.6; }
      .action-status-not_started { background: #E5E7EB; color: #374151; }
      .action-status-in_progress { background: #DBEAFE; color: #1D4ED8; }
      .action-status-reviewing { background: #FEF3C7; color: #B45309; }
      .action-status-completed { background: #D1FAE5; color: #065F46; }
      .action-status-waiting { background: #FEE2E2; color: #B91C1C; }
      .action-status-on_hold { background: #F3F4F6; color: #6B7280; }
      .issue-state-pending_decision { background: #FEF3C7; color: #B45309; }
      .issue-state-waiting { background: #FEE2E2; color: #B91C1C; }
      .issue-state-unknown { background: #E5E7EB; color: #374151; }
      .issue-state-stuck { background: #FECACA; color: #991B1B; }
      .issue-state-insufficient { background: #FCE7F3; color: #9D174D; }
      .issue-state-concern { background: #EDE9FE; color: #6D28D9; }
      .client-focus { border-left: 3px solid #10B981; }
      .client-all { border-left: 3px solid #6B7280; }
      .client-dormant { border-left: 3px solid #D1D5DB; opacity: 0.7; }
      .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 50; }
      .modal.active { display: flex; justify-content: center; align-items: center; }
      .modal-content { background: white; border-radius: 0.5rem; max-width: 32rem; width: 100%; max-height: 90vh; overflow-y: auto; }
      .tooltip { position: relative; }
      .tooltip:hover::after { content: attr(data-tip); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); padding: 4px 8px; background: #374151; color: white; font-size: 0.75rem; border-radius: 4px; white-space: nowrap; z-index: 10; }
    </style>
</head>
<body class="bg-gray-100 min-h-screen">
    <nav class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" class="flex items-center space-x-2">
                <div class="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                    <i class="fas fa-video text-white text-sm"></i>
                </div>
                <span class="font-bold text-xl text-gray-800">VEXUM</span>
                <span class="text-gray-400 text-sm">Meeting OS</span>
            </a>
            <div class="flex items-center space-x-4">
                <a href="/" class="text-gray-600 hover:text-blue-600"><i class="fas fa-home mr-1"></i>会議一覧</a>
                <a href="/issues" class="text-gray-600 hover:text-blue-600"><i class="fas fa-inbox mr-1"></i>保留箱</a>
                <a href="/dashboard" class="text-gray-600 hover:text-blue-600"><i class="fas fa-chart-line mr-1"></i>ダッシュボード</a>
                <a href="/triage" class="text-gray-600 hover:text-blue-600"><i class="fas fa-tasks mr-1"></i>一括整備</a>
            </div>
        </div>
    </nav>
    <main class="max-w-7xl mx-auto px-4 py-6">
        ${content}
    </main>
    ${scripts}
</body>
</html>
`;

// Home page - Meeting list
app.get('/', (c) => {
  const content = `
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-800 mb-2">今週の会議</h1>
      <p class="text-gray-600">参加予定の会議を確認し、会議室にアクセスしましょう</p>
    </div>
    
    <!-- Meeting Type Filters -->
    <div class="flex space-x-2 mb-6">
      <button onclick="filterMeetings('')" class="filter-btn px-4 py-2 rounded-lg bg-blue-600 text-white" data-filter="">すべて</button>
      <button onclick="filterMeetings('team')" class="filter-btn px-4 py-2 rounded-lg bg-white text-gray-700 border" data-filter="team">チームMTG</button>
      <button onclick="filterMeetings('headquarters')" class="filter-btn px-4 py-2 rounded-lg bg-white text-gray-700 border" data-filter="headquarters">本部会議</button>
      <button onclick="filterMeetings('strategy')" class="filter-btn px-4 py-2 rounded-lg bg-white text-gray-700 border" data-filter="strategy">戦略会議</button>
      <button onclick="filterMeetings('all-hands')" class="filter-btn px-4 py-2 rounded-lg bg-white text-gray-700 border" data-filter="all-hands">全体会議</button>
    </div>
    
    <!-- Meeting List -->
    <div id="meeting-list" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div class="text-center py-8 text-gray-500">読み込み中...</div>
    </div>
  `;
  
  const scripts = `
    <script>
      let allMeetings = [];
      let currentFilter = '';
      
      async function loadMeetings() {
        try {
          const res = await axios.get('/api/meetings');
          allMeetings = res.data;
          renderMeetings();
        } catch (err) {
          console.error(err);
          document.getElementById('meeting-list').innerHTML = '<div class="text-red-500">読み込みエラー</div>';
        }
      }
      
      function filterMeetings(type) {
        currentFilter = type;
        document.querySelectorAll('.filter-btn').forEach(btn => {
          if (btn.dataset.filter === type) {
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('bg-white', 'text-gray-700', 'border');
          } else {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-white', 'text-gray-700', 'border');
          }
        });
        renderMeetings();
      }
      
      function renderMeetings() {
        const filtered = currentFilter 
          ? allMeetings.filter(m => m.meeting_type_slug === currentFilter)
          : allMeetings;
        
        if (filtered.length === 0) {
          document.getElementById('meeting-list').innerHTML = '<div class="text-center py-8 text-gray-500">会議がありません</div>';
          return;
        }
        
        const typeColors = {
          team: 'border-l-green-500',
          headquarters: 'border-l-blue-500',
          strategy: 'border-l-purple-500',
          'all-hands': 'border-l-orange-500'
        };
        
        const typeIcons = {
          team: 'fa-users',
          headquarters: 'fa-building',
          strategy: 'fa-chess',
          'all-hands': 'fa-globe'
        };
        
        const statusBadges = {
          scheduled: '<span class="status-badge bg-gray-100 text-gray-600">予定</span>',
          active: '<span class="status-badge bg-green-100 text-green-700">開催中</span>',
          completed: '<span class="status-badge bg-blue-100 text-blue-600">完了</span>'
        };
        
        const html = filtered.map(m => \`
          <a href="/meeting/\${m.id}" class="meeting-card block bg-white rounded-lg shadow-sm border-l-4 \${typeColors[m.meeting_type_slug]} p-4 transition-all duration-200 hover:shadow-md">
            <div class="flex items-start justify-between mb-2">
              <div class="flex items-center space-x-2">
                <i class="fas \${typeIcons[m.meeting_type_slug]} text-gray-400"></i>
                <span class="text-sm text-gray-500">\${m.meeting_type_name}</span>
              </div>
              \${statusBadges[m.status]}
            </div>
            <h3 class="font-semibold text-gray-800 mb-1">\${m.title}</h3>
            <div class="text-sm text-gray-500">
              <i class="far fa-calendar-alt mr-1"></i>
              \${dayjs(m.scheduled_at).format('M月D日(ddd) HH:mm')}
            </div>
            \${m.team_name ? \`<div class="text-sm text-gray-500 mt-1"><i class="fas fa-users mr-1"></i>\${m.team_name}</div>\` : ''}
          </a>
        \`).join('');
        
        document.getElementById('meeting-list').innerHTML = html;
      }
      
      loadMeetings();
    </script>
  `;
  
  return c.html(renderPage('会議一覧', content, scripts));
});

// Meeting room page
app.get('/meeting/:id', async (c) => {
  const id = c.req.param('id');
  
  const content = `
    <div id="meeting-room" data-meeting-id="${id}">
      <div class="text-center py-8 text-gray-500">読み込み中...</div>
    </div>
    
    <!-- Check-in Modal -->
    <div id="checkin-modal" class="modal">
      <div class="modal-content p-6">
        <h3 class="text-lg font-bold mb-4"><i class="fas fa-hand-paper mr-2 text-blue-600"></i>チェックイン</h3>
        <form id="checkin-form">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">今週の確度 (0-10)</label>
            <input type="range" id="confidence-score" min="0" max="10" value="5" class="w-full" oninput="document.getElementById('confidence-value').textContent = this.value">
            <div class="flex justify-between text-sm text-gray-500">
              <span>0 (低い)</span>
              <span id="confidence-value" class="font-bold text-blue-600">5</span>
              <span>10 (高い)</span>
            </div>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">最大の不確実要因</label>
            <select id="uncertainty-factor" class="w-full border rounded-lg px-3 py-2">
              <option value="pending_decision">判断待ち</option>
              <option value="waiting">待ち</option>
              <option value="unknown">不明点</option>
              <option value="stuck">詰まり</option>
              <option value="insufficient">不足</option>
              <option value="concern">不安要素</option>
            </select>
          </div>
          <div class="mb-4">
            <label class="flex items-center">
              <input type="checkbox" id="needs-help" class="mr-2">
              <span class="text-sm text-gray-700">助けが必要</span>
            </label>
          </div>
          <div class="mb-4">
            <label class="flex items-center">
              <input type="checkbox" id="is-anonymous" class="mr-2">
              <span class="text-sm text-gray-700">匿名で投稿</span>
            </label>
          </div>
          <div class="flex justify-end space-x-2">
            <button type="button" onclick="closeCheckinModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">送信</button>
          </div>
        </form>
      </div>
    </div>
    
    <!-- Quick Add Modal -->
    <div id="quick-add-modal" class="modal">
      <div class="modal-content p-6">
        <h3 class="text-lg font-bold mb-4" id="quick-add-title">追加</h3>
        <form id="quick-add-form">
          <input type="hidden" id="quick-add-type">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">内容</label>
            <textarea id="quick-add-content" class="w-full border rounded-lg px-3 py-2" rows="3" required></textarea>
          </div>
          <div id="quick-add-extra-fields"></div>
          <div class="flex justify-end space-x-2">
            <button type="button" onclick="closeQuickAddModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">追加</button>
          </div>
        </form>
      </div>
    </div>
    
    <!-- Snooze Modal -->
    <div id="snooze-modal" class="modal">
      <div class="modal-content p-6">
        <h3 class="text-lg font-bold mb-4"><i class="fas fa-clock mr-2 text-gray-600"></i>スヌーズ / 例外設定</h3>
        <form id="snooze-form">
          <input type="hidden" id="snooze-entity-type">
          <input type="hidden" id="snooze-entity-id">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">スヌーズ期間</label>
            <select id="snooze-duration" class="w-full border rounded-lg px-3 py-2">
              <option value="">選択してください</option>
              <option value="3">3日間</option>
              <option value="7">7日間</option>
              <option value="next">次回会議まで</option>
            </select>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">例外理由</label>
            <select id="exception-reason" class="w-full border rounded-lg px-3 py-2">
              <option value="">選択してください</option>
              <option value="external_wait">外部待ち</option>
              <option value="low_priority">優先度低</option>
              <option value="long_term">長期施策</option>
              <option value="spec_wait">仕様待ち</option>
              <option value="request_wait">依頼待ち</option>
            </select>
          </div>
          <div class="flex justify-end space-x-2">
            <button type="button" onclick="closeSnoozeModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">設定</button>
          </div>
        </form>
      </div>
    </div>
    
    <!-- End Meeting Modal -->
    <div id="end-meeting-modal" class="modal">
      <div class="modal-content p-6">
        <h3 class="text-lg font-bold mb-4"><i class="fas fa-flag-checkered mr-2 text-green-600"></i>会議終了チェック</h3>
        <div id="end-meeting-warnings" class="mb-4"></div>
        <div class="flex justify-end space-x-2">
          <button type="button" onclick="closeEndMeetingModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">戻る</button>
          <button type="button" onclick="confirmEndMeeting()" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">このまま終了</button>
          <a href="/triage?meeting_id=${id}" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">一括整備へ</a>
        </div>
      </div>
    </div>
  `;
  
  const scripts = `
    <script src="/static/meeting-room.js"></script>
  `;
  
  return c.html(renderPage('会議室', content, scripts));
});

// Issues page
app.get('/issues', (c) => {
  const content = `
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-800 mb-2">保留箱（Issue一覧）</h1>
      <p class="text-gray-600">未解決の保留事項を会議/チーム横断で確認</p>
    </div>
    
    <!-- Filters -->
    <div class="bg-white rounded-lg shadow-sm p-4 mb-6">
      <div class="grid grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">チーム</label>
          <select id="filter-team" class="w-full border rounded-lg px-3 py-2" onchange="loadIssues()">
            <option value="">すべて</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">状態</label>
          <select id="filter-state" class="w-full border rounded-lg px-3 py-2" onchange="loadIssues()">
            <option value="">すべて</option>
            <option value="pending_decision">判断待ち</option>
            <option value="waiting">待ち</option>
            <option value="unknown">不明点</option>
            <option value="stuck">詰まり</option>
            <option value="insufficient">不足</option>
            <option value="concern">不安要素</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">解決状況</label>
          <select id="filter-resolved" class="w-full border rounded-lg px-3 py-2" onchange="loadIssues()">
            <option value="false">未解決のみ</option>
            <option value="true">解決済みのみ</option>
            <option value="">すべて</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">並び順</label>
          <select id="filter-sort" class="w-full border rounded-lg px-3 py-2" onchange="loadIssues()">
            <option value="postponed">次回送り回数</option>
            <option value="created">作成日</option>
          </select>
        </div>
      </div>
    </div>
    
    <!-- Issue List -->
    <div id="issue-list" class="space-y-3">
      <div class="text-center py-8 text-gray-500">読み込み中...</div>
    </div>
  `;
  
  const scripts = `
    <script>
      const stateLabels = {
        pending_decision: '判断待ち',
        waiting: '待ち',
        unknown: '不明点',
        stuck: '詰まり',
        insufficient: '不足',
        concern: '不安要素'
      };
      
      async function loadTeams() {
        const res = await axios.get('/api/teams');
        const select = document.getElementById('filter-team');
        res.data.forEach(t => {
          select.innerHTML += \`<option value="\${t.id}">\${t.name}</option>\`;
        });
      }
      
      async function loadIssues() {
        const teamId = document.getElementById('filter-team').value;
        const state = document.getElementById('filter-state').value;
        const resolved = document.getElementById('filter-resolved').value;
        
        let url = '/api/issues?';
        if (teamId) url += \`team_id=\${teamId}&\`;
        if (state) url += \`state=\${state}&\`;
        if (resolved) url += \`resolved=\${resolved}&\`;
        
        try {
          const res = await axios.get(url);
          renderIssues(res.data);
        } catch (err) {
          console.error(err);
        }
      }
      
      function renderIssues(issues) {
        if (issues.length === 0) {
          document.getElementById('issue-list').innerHTML = '<div class="text-center py-8 text-gray-500">保留事項がありません</div>';
          return;
        }
        
        const html = issues.map(i => \`
          <div class="bg-white rounded-lg shadow-sm p-4 issue-state-\${i.state}">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center space-x-2 mb-2">
                  <span class="status-badge issue-state-\${i.state}">\${stateLabels[i.state]}</span>
                  \${i.team_name ? \`<span class="text-sm text-gray-500">\${i.team_name}</span>\` : ''}
                  \${i.client_name ? \`<span class="text-sm text-gray-500">/ \${i.client_name}</span>\` : ''}
                  \${i.times_postponed >= 2 ? \`<span class="text-xs text-red-500"><i class="fas fa-exclamation-triangle"></i> \${i.times_postponed}回送り</span>\` : ''}
                </div>
                <p class="text-gray-800">\${i.content}</p>
                <div class="text-sm text-gray-500 mt-2">
                  \${i.owner_name ? \`<span class="mr-3"><i class="fas fa-user mr-1"></i>\${i.owner_name}</span>\` : ''}
                  <span><i class="far fa-clock mr-1"></i>\${dayjs(i.created_at).format('M/D')}</span>
                </div>
              </div>
              <div class="flex space-x-2">
                <button onclick="convertToAction(\${i.id})" class="text-blue-600 hover:text-blue-800 tooltip" data-tip="Action化">
                  <i class="fas fa-arrow-right"></i>
                </button>
                <button onclick="resolveIssue(\${i.id})" class="text-green-600 hover:text-green-800 tooltip" data-tip="解決">
                  <i class="fas fa-check"></i>
                </button>
              </div>
            </div>
          </div>
        \`).join('');
        
        document.getElementById('issue-list').innerHTML = html;
      }
      
      async function convertToAction(issueId) {
        // In production, you'd show a modal to select meeting
        alert('会議室からAction化してください');
      }
      
      async function resolveIssue(issueId) {
        if (!confirm('この保留事項を解決済みにしますか？')) return;
        try {
          await axios.patch(\`/api/issues/\${issueId}\`, { resolved: true });
          loadIssues();
        } catch (err) {
          console.error(err);
          alert('エラーが発生しました');
        }
      }
      
      loadTeams();
      loadIssues();
    </script>
  `;
  
  return c.html(renderPage('保留箱', content, scripts));
});

// Dashboard page
app.get('/dashboard', (c) => {
  const content = `
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-800 mb-2">ダッシュボード</h1>
      <p class="text-gray-600">会議・Action・保留箱の状況を俯瞰</p>
    </div>
    
    <!-- Stats Cards -->
    <div class="grid grid-cols-5 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow-sm p-4">
        <div class="text-sm text-gray-500 mb-1">Action完了率</div>
        <div class="text-2xl font-bold text-blue-600" id="stat-completion">--%</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-4">
        <div class="text-sm text-gray-500 mb-1">期限超過</div>
        <div class="text-2xl font-bold text-red-600" id="stat-overdue">--件</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-4">
        <div class="text-sm text-gray-500 mb-1">未確定Action</div>
        <div class="text-2xl font-bold text-yellow-600" id="stat-tentative">--件</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-4">
        <div class="text-sm text-gray-500 mb-1">滞留Issue</div>
        <div class="text-2xl font-bold text-purple-600" id="stat-stagnant">--件</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-4">
        <div class="text-sm text-gray-500 mb-1">平均確度</div>
        <div class="text-2xl font-bold text-green-600" id="stat-confidence">--</div>
      </div>
    </div>
    
    <!-- Team Filter -->
    <div class="mb-4">
      <select id="team-filter" class="border rounded-lg px-3 py-2" onchange="loadDashboard()">
        <option value="">全チーム</option>
      </select>
    </div>
    
    <!-- Quick Links -->
    <div class="grid grid-cols-2 gap-6">
      <div class="bg-white rounded-lg shadow-sm p-4">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-exclamation-circle text-red-500 mr-2"></i>要対応項目</h3>
        <div id="attention-items" class="space-y-2">
          <div class="text-gray-500 text-sm">読み込み中...</div>
        </div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-4">
        <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-calendar-alt text-blue-500 mr-2"></i>今週の会議</h3>
        <div id="upcoming-meetings" class="space-y-2">
          <div class="text-gray-500 text-sm">読み込み中...</div>
        </div>
      </div>
    </div>
  `;
  
  const scripts = `
    <script>
      async function loadTeams() {
        const res = await axios.get('/api/teams');
        const select = document.getElementById('team-filter');
        res.data.forEach(t => {
          select.innerHTML += \`<option value="\${t.id}">\${t.name}</option>\`;
        });
      }
      
      async function loadDashboard() {
        const teamId = document.getElementById('team-filter').value;
        const url = teamId ? \`/api/dashboard?team_id=\${teamId}\` : '/api/dashboard';
        
        try {
          const res = await axios.get(url);
          const data = res.data;
          
          document.getElementById('stat-completion').textContent = data.action_completion_rate.toFixed(0) + '%';
          document.getElementById('stat-overdue').textContent = data.overdue_actions_count + '件';
          document.getElementById('stat-tentative').textContent = data.tentative_actions_count + '件';
          document.getElementById('stat-stagnant').textContent = data.stagnant_issues_count + '件';
          document.getElementById('stat-confidence').textContent = data.avg_confidence_score.toFixed(1);
          
          // Load attention items (triage)
          const triageRes = await axios.get('/api/triage');
          const attentionHtml = triageRes.data.slice(0, 5).map(a => \`
            <div class="flex items-center justify-between py-2 border-b">
              <span class="text-sm text-gray-700">\${a.content}</span>
              <span class="text-xs text-gray-500">\${a.meeting_title || ''}</span>
            </div>
          \`).join('') || '<div class="text-sm text-gray-500">なし</div>';
          document.getElementById('attention-items').innerHTML = attentionHtml;
          
          // Load upcoming meetings
          const meetingsRes = await axios.get('/api/meetings?status=scheduled');
          const meetingsHtml = meetingsRes.data.slice(0, 5).map(m => \`
            <a href="/meeting/\${m.id}" class="flex items-center justify-between py-2 border-b hover:bg-gray-50">
              <span class="text-sm text-gray-700">\${m.title}</span>
              <span class="text-xs text-gray-500">\${dayjs(m.scheduled_at).format('M/D HH:mm')}</span>
            </a>
          \`).join('') || '<div class="text-sm text-gray-500">なし</div>';
          document.getElementById('upcoming-meetings').innerHTML = meetingsHtml;
          
        } catch (err) {
          console.error(err);
        }
      }
      
      loadTeams();
      loadDashboard();
    </script>
  `;
  
  return c.html(renderPage('ダッシュボード', content, scripts));
});

// Triage page
app.get('/triage', (c) => {
  const meetingId = c.req.query('meeting_id');
  
  const content = `
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-800 mb-2">一括整備（Triage）</h1>
      <p class="text-gray-600">未確定のActionを一括で整備し、動ける状態にします</p>
    </div>
    
    <!-- Triage Form -->
    <form id="triage-form">
      <div class="bg-white rounded-lg shadow-sm">
        <div class="p-4 border-b bg-gray-50">
          <div class="flex items-center justify-between">
            <span class="font-medium text-gray-700">未確定Action一覧</span>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <i class="fas fa-check mr-2"></i>一括確定
            </button>
          </div>
        </div>
        <div id="triage-list" class="divide-y">
          <div class="p-4 text-gray-500">読み込み中...</div>
        </div>
      </div>
    </form>
  `;
  
  const scripts = `
    <script>
      const meetingId = ${meetingId ? meetingId : 'null'};
      let users = [];
      
      async function loadUsers() {
        const res = await axios.get('/api/users');
        users = res.data;
      }
      
      async function loadTriageItems() {
        const url = meetingId ? \`/api/triage?meeting_id=\${meetingId}\` : '/api/triage';
        try {
          const res = await axios.get(url);
          renderTriageItems(res.data);
        } catch (err) {
          console.error(err);
        }
      }
      
      function renderTriageItems(items) {
        if (items.length === 0) {
          document.getElementById('triage-list').innerHTML = '<div class="p-4 text-center text-green-600"><i class="fas fa-check-circle mr-2"></i>すべてのActionが確定済みです</div>';
          return;
        }
        
        const userOptions = users.map(u => \`<option value="\${u.id}">\${u.name}</option>\`).join('');
        
        const html = items.map(a => \`
          <div class="p-4 hover:bg-gray-50" data-action-id="\${a.id}">
            <div class="flex items-start gap-4">
              <div class="flex-1">
                <p class="text-gray-800 font-medium">\${a.content}</p>
                <p class="text-sm text-gray-500 mt-1">\${a.meeting_title || ''}</p>
              </div>
              <div class="flex items-center gap-3">
                <select name="assignee_\${a.id}" class="border rounded px-2 py-1 text-sm">
                  <option value="">担当者を選択</option>
                  \${userOptions}
                </select>
                <input type="date" name="due_date_\${a.id}" value="\${a.due_date || ''}" class="border rounded px-2 py-1 text-sm">
                <label class="flex items-center text-sm">
                  <input type="checkbox" name="confirm_\${a.id}" class="mr-1" checked>
                  確定
                </label>
              </div>
            </div>
          </div>
        \`).join('');
        
        document.getElementById('triage-list').innerHTML = html;
      }
      
      document.getElementById('triage-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const items = document.querySelectorAll('[data-action-id]');
        const updates = [];
        
        items.forEach(item => {
          const id = item.dataset.actionId;
          const assignee = item.querySelector(\`[name="assignee_\${id}"]\`).value;
          const dueDate = item.querySelector(\`[name="due_date_\${id}"]\`).value;
          const confirmed = item.querySelector(\`[name="confirm_\${id}"]\`).checked;
          
          updates.push({
            id: parseInt(id),
            assignee_id: assignee ? parseInt(assignee) : null,
            due_date: dueDate || null,
            is_tentative: !confirmed
          });
        });
        
        try {
          await axios.post('/api/actions/triage', { actions: updates });
          alert('一括確定しました');
          loadTriageItems();
        } catch (err) {
          console.error(err);
          alert('エラーが発生しました');
        }
      });
      
      loadUsers().then(loadTriageItems);
    </script>
  `;
  
  return c.html(renderPage('一括整備', content, scripts));
});

export default app;
