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
    <script>
      // Global auth state
      window.currentUser = null;
      window.accessibleMeetingTypes = [];
      
      // Auth helper functions
      async function loadCurrentUser() {
        try {
          const res = await axios.get('/api/auth/me');
          window.currentUser = res.data.user;
          window.accessibleMeetingTypes = res.data.accessible_meeting_types || [];
          window.userTeams = res.data.teams || [];
          updateUserMenu();
          updateNavVisibility();
          return res.data;
        } catch(e) {
          console.error('Auth check failed:', e);
          window.currentUser = null;
          updateUserMenu();
          return null;
        }
      }
      
      function updateUserMenu() {
        const menu = document.getElementById('user-menu');
        if (!menu) return;
        
        if (window.currentUser) {
          const roleLabels = { participant: '参加者', manager: 'マネージャー', executive: '経営層' };
          const roleColors = { participant: 'bg-gray-100 text-gray-700', manager: 'bg-blue-100 text-blue-700', executive: 'bg-purple-100 text-purple-700' };
          menu.innerHTML = \`
            <span class="text-sm text-gray-500">\${window.currentUser.name}</span>
            <span class="px-2 py-1 rounded-full text-xs font-medium \${roleColors[window.currentUser.role]}">
              \${roleLabels[window.currentUser.role]}
            </span>
            <button onclick="logout()" class="text-gray-500 hover:text-red-600" title="ログアウト">
              <i class="fas fa-sign-out-alt"></i>
            </button>
          \`;
        } else {
          menu.innerHTML = \`
            <button onclick="openLoginModal()" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              <i class="fas fa-sign-in-alt mr-1"></i>ログイン
            </button>
          \`;
        }
      }
      
      function updateNavVisibility() {
        // Hide/show nav links based on permissions
        const links = document.getElementById('nav-links');
        if (!links) return;
        
        // If not logged in, show only basic navigation
        if (!window.currentUser) {
          links.querySelectorAll('a').forEach(a => {
            if (a.getAttribute('href') !== '/') {
              a.style.display = 'none';
            }
          });
        } else {
          links.querySelectorAll('a:not(.admin-link)').forEach(a => a.style.display = '');
          // Show admin link only for manager and executive
          const adminLink = links.querySelector('.admin-link');
          if (adminLink) {
            const canAdmin = window.currentUser.role === 'manager' || window.currentUser.role === 'executive';
            adminLink.style.display = canAdmin ? '' : 'none';
          }
        }
      }
      
      function canViewMeetingType(typeSlug) {
        if (!window.currentUser) return false;
        const perm = window.accessibleMeetingTypes.find(mt => mt.slug === typeSlug);
        return perm && perm.can_view;
      }
      
      function canManageMeetingType(typeSlug) {
        if (!window.currentUser) return false;
        const perm = window.accessibleMeetingTypes.find(mt => mt.slug === typeSlug);
        return perm && perm.can_manage;
      }
      
      function canCreateMeetingType(typeSlug) {
        if (!window.currentUser) return false;
        const perm = window.accessibleMeetingTypes.find(mt => mt.slug === typeSlug);
        return perm && perm.can_create;
      }
      
      async function logout() {
        try {
          await axios.post('/api/auth/logout');
          window.currentUser = null;
          window.accessibleMeetingTypes = [];
          updateUserMenu();
          updateNavVisibility();
          window.location.href = '/';
        } catch(e) {
          console.error('Logout failed:', e);
        }
      }
      
      function openLoginModal() {
        const modal = document.getElementById('login-modal');
        if (modal) modal.classList.add('active');
      }
      
      function closeLoginModal() {
        const modal = document.getElementById('login-modal');
        if (modal) modal.classList.remove('active');
      }
      
      // Initialize auth on page load
      document.addEventListener('DOMContentLoaded', loadCurrentUser);
    </script>
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
            <div class="flex items-center space-x-4" id="nav-links">
                <a href="/" class="text-gray-600 hover:text-blue-600"><i class="fas fa-home mr-1"></i>会議一覧</a>
                <a href="/issues" class="text-gray-600 hover:text-blue-600"><i class="fas fa-inbox mr-1"></i>保留箱</a>
                <a href="/dashboard" class="text-gray-600 hover:text-blue-600"><i class="fas fa-chart-line mr-1"></i>ダッシュボード</a>
                <a href="/triage" class="text-gray-600 hover:text-blue-600"><i class="fas fa-tasks mr-1"></i>一括整備</a>
                <a href="/admin" class="text-gray-600 hover:text-blue-600 admin-link" style="display:none;"><i class="fas fa-cog mr-1"></i>管理</a>
            </div>
            <div id="user-menu" class="flex items-center space-x-3">
                <!-- Dynamic user menu loaded by JS -->
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
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 mb-2">今週の会議</h1>
        <p class="text-gray-600">参加予定の会議を確認し、会議室にアクセスしましょう</p>
      </div>
      <button id="create-meeting-btn" onclick="openCreateMeetingModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center hidden">
        <i class="fas fa-plus mr-2"></i>会議を作成
      </button>
    </div>
    
    <!-- Meeting Type Filters -->
    <div class="flex flex-wrap gap-2 mb-6">
      <button onclick="filterMeetings('')" class="filter-btn px-4 py-2 rounded-lg bg-blue-600 text-white" data-filter="">すべて</button>
      <button onclick="filterMeetings('team')" class="filter-btn px-4 py-2 rounded-lg bg-white text-gray-700 border" data-filter="team">チームMTG</button>
      <button onclick="filterMeetings('headquarters')" class="filter-btn px-4 py-2 rounded-lg bg-white text-gray-700 border" data-filter="headquarters">本部会議</button>
      <button onclick="filterMeetings('strategy')" class="filter-btn px-4 py-2 rounded-lg bg-white text-gray-700 border" data-filter="strategy">戦略会議</button>
      <button onclick="filterMeetings('all-hands')" class="filter-btn px-4 py-2 rounded-lg bg-white text-gray-700 border" data-filter="all-hands">全体会議</button>
      <button onclick="filterMeetings('one-on-one')" class="filter-btn px-4 py-2 rounded-lg bg-white text-gray-700 border" data-filter="one-on-one">1on1</button>
      <button onclick="filterMeetings('other')" class="filter-btn px-4 py-2 rounded-lg bg-white text-gray-700 border" data-filter="other">その他</button>
    </div>
    
    <!-- Meeting List -->
    <div id="meeting-list" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div class="text-center py-8 text-gray-500">読み込み中...</div>
    </div>
    
    <!-- Login Modal -->
    <div id="login-modal" class="modal">
      <div class="modal-content p-6" style="max-width: 24rem;">
        <h3 class="text-lg font-bold mb-4"><i class="fas fa-sign-in-alt mr-2 text-blue-600"></i>ログイン</h3>
        <p class="text-sm text-gray-600 mb-4">会議システムにログインしてください。</p>
        <form id="login-form">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">メールアドレス</label>
            <input type="email" id="login-email" class="w-full border rounded-lg px-3 py-2" placeholder="email@example.com" required>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">パスワード</label>
            <input type="password" id="login-password" class="w-full border rounded-lg px-3 py-2" placeholder="パスワードを入力" required>
          </div>
          <div id="login-error" class="mb-4 text-red-600 text-sm hidden"></div>
          <div class="flex justify-end space-x-2">
            <button type="button" onclick="closeLoginModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <i class="fas fa-sign-in-alt mr-2"></i>ログイン
            </button>
          </div>
        </form>
      </div>
    </div>
    
    <!-- Create Meeting Modal -->
    <div id="create-meeting-modal" class="modal">
      <div class="modal-content p-6" style="max-width: 40rem;">
        <h3 class="text-lg font-bold mb-4"><i class="fas fa-calendar-plus mr-2 text-blue-600"></i>新しい会議を作成</h3>
        <form id="create-meeting-form">
          
          <!-- Meeting Type Selection -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-3">会議の種類</label>
            <div class="grid grid-cols-2 gap-3" id="meeting-type-selector">
              <label class="meeting-type-option cursor-pointer">
                <input type="radio" name="meeting_type" value="1" class="hidden" onchange="onMeetingTypeChange(this)">
                <div class="border-2 rounded-lg p-4 hover:border-green-400 transition-colors border-l-4 border-l-green-500">
                  <div class="flex items-center mb-2">
                    <i class="fas fa-users text-green-500 mr-2"></i>
                    <span class="font-semibold text-gray-800">チームMTG</span>
                  </div>
                  <p class="text-xs text-gray-500">週1回、常駐先単位で施策進捗・品質・来週コミット・提案のタネを整理</p>
                </div>
              </label>
              <label class="meeting-type-option cursor-pointer">
                <input type="radio" name="meeting_type" value="2" class="hidden" onchange="onMeetingTypeChange(this)">
                <div class="border-2 rounded-lg p-4 hover:border-blue-400 transition-colors border-l-4 border-l-blue-500">
                  <div class="flex items-center mb-2">
                    <i class="fas fa-building text-blue-500 mr-2"></i>
                    <span class="font-semibold text-gray-800">本部会議</span>
                  </div>
                  <p class="text-xs text-gray-500">リーダー/副リーダー。会社決定の共有・運用統制・横断詰まり解消</p>
                </div>
              </label>
              <label class="meeting-type-option cursor-pointer">
                <input type="radio" name="meeting_type" value="3" class="hidden" onchange="onMeetingTypeChange(this)">
                <div class="border-2 rounded-lg p-4 hover:border-purple-400 transition-colors border-l-4 border-l-purple-500">
                  <div class="flex items-center mb-2">
                    <i class="fas fa-chess text-purple-500 mr-2"></i>
                    <span class="font-semibold text-gray-800">戦略会議</span>
                  </div>
                  <p class="text-xs text-gray-500">V2。優先順位・配分・トレードオフ・重大判断に集中</p>
                </div>
              </label>
              <label class="meeting-type-option cursor-pointer">
                <input type="radio" name="meeting_type" value="4" class="hidden" onchange="onMeetingTypeChange(this)">
                <div class="border-2 rounded-lg p-4 hover:border-orange-400 transition-colors border-l-4 border-l-orange-500">
                  <div class="flex items-center mb-2">
                    <i class="fas fa-globe text-orange-500 mr-2"></i>
                    <span class="font-semibold text-gray-800">全体会議</span>
                  </div>
                  <p class="text-xs text-gray-500">月1回、本部決定の要点共有、月次振り返り、横展開</p>
                </div>
              </label>
              <label class="meeting-type-option cursor-pointer">
                <input type="radio" name="meeting_type" value="5" class="hidden" onchange="onMeetingTypeChange(this)">
                <div class="border-2 rounded-lg p-4 hover:border-pink-400 transition-colors border-l-4 border-l-pink-500">
                  <div class="flex items-center mb-2">
                    <i class="fas fa-user-friends text-pink-500 mr-2"></i>
                    <span class="font-semibold text-gray-800">1on1</span>
                  </div>
                  <p class="text-xs text-gray-500">上司と部下の1対1ミーティング。成長支援・課題相談・フィードバック</p>
                </div>
              </label>
              <label class="meeting-type-option cursor-pointer">
                <input type="radio" name="meeting_type" value="6" class="hidden" onchange="onMeetingTypeChange(this)">
                <div class="border-2 rounded-lg p-4 hover:border-gray-400 transition-colors border-l-4 border-l-gray-500">
                  <div class="flex items-center mb-2">
                    <i class="fas fa-ellipsis-h text-gray-500 mr-2"></i>
                    <span class="font-semibold text-gray-800">その他</span>
                  </div>
                  <p class="text-xs text-gray-500">上記に当てはまらない会議。臨時会議・プロジェクト会議など</p>
                </div>
              </label>
            </div>
          </div>
          
          <!-- Team Selection (for Team MTG only) -->
          <div class="mb-4" id="team-select-container" style="display: none;">
            <label class="block text-sm font-medium text-gray-700 mb-2">対象チーム</label>
            <select id="meeting-team" class="w-full border rounded-lg px-3 py-2">
              <option value="">チームを選択してください</option>
            </select>
          </div>
          
          <!-- Meeting Title -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">会議タイトル</label>
            <input type="text" id="meeting-title" class="w-full border rounded-lg px-3 py-2" placeholder="例: Alpha チームMTG 第1週" required>
          </div>
          
          <!-- Meeting Date/Time -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">開催日時</label>
            <input type="datetime-local" id="meeting-datetime" class="w-full border rounded-lg px-3 py-2" required>
          </div>
          
          <!-- Buttons -->
          <div class="flex justify-end space-x-2 mt-6">
            <button type="button" onclick="closeCreateMeetingModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <i class="fas fa-check mr-2"></i>作成
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  const scripts = `
    <script>
      let allMeetings = [];
      let allTeams = [];
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
      
      async function loadTeams() {
        try {
          const res = await axios.get('/api/teams');
          allTeams = res.data;
          const select = document.getElementById('meeting-team');
          select.innerHTML = '<option value="">チームを選択してください</option>';
          allTeams.forEach(t => {
            select.innerHTML += \`<option value="\${t.id}">\${t.name}</option>\`;
          });
        } catch (err) {
          console.error(err);
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
      
      // Update filter buttons based on permissions
      function updateFilterButtons() {
        const buttons = document.querySelectorAll('.filter-btn');
        buttons.forEach(btn => {
          const filter = btn.dataset.filter;
          if (filter === '') {
            // "すべて" button always visible if logged in
            btn.style.display = window.currentUser ? '' : 'none';
          } else {
            // Check if user can view this meeting type
            const canView = canViewMeetingType(filter);
            btn.style.display = canView ? '' : 'none';
          }
        });
        
        // Show/hide create meeting button
        const createBtn = document.getElementById('create-meeting-btn');
        if (createBtn) {
          const canCreateAny = window.accessibleMeetingTypes && window.accessibleMeetingTypes.some(mt => mt.can_create);
          createBtn.classList.toggle('hidden', !canCreateAny);
        }
      }
      
      function renderMeetings() {
        // Show login prompt if not logged in
        if (!window.currentUser) {
          document.getElementById('meeting-list').innerHTML = \`
            <div class="col-span-full text-center py-12 bg-white rounded-lg border">
              <i class="fas fa-lock text-4xl text-gray-300 mb-4"></i>
              <h3 class="text-lg font-semibold text-gray-700 mb-2">ログインが必要です</h3>
              <p class="text-gray-500 mb-4">会議一覧を表示するにはログインしてください</p>
              <button onclick="openLoginModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <i class="fas fa-sign-in-alt mr-2"></i>ログイン
              </button>
            </div>
          \`;
          return;
        }
        
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
          'all-hands': 'border-l-orange-500',
          'one-on-one': 'border-l-pink-500',
          'other': 'border-l-gray-500'
        };
        
        const typeIcons = {
          team: 'fa-users',
          headquarters: 'fa-building',
          strategy: 'fa-chess',
          'all-hands': 'fa-globe',
          'one-on-one': 'fa-user-friends',
          'other': 'fa-ellipsis-h'
        };
        
        const statusBadges = {
          scheduled: '<span class="status-badge bg-gray-100 text-gray-600">予定</span>',
          active: '<span class="status-badge bg-green-100 text-green-700">開催中</span>',
          completed: '<span class="status-badge bg-blue-100 text-blue-600">完了</span>'
        };
        
        const canDelete = window.currentUser && (window.currentUser.role === 'manager' || window.currentUser.role === 'executive');
        
        const html = filtered.map(m => \`
          <div class="meeting-card bg-white rounded-lg shadow-sm border-l-4 \${typeColors[m.meeting_type_slug]} p-4 transition-all duration-200 hover:shadow-md relative">
            <a href="/meeting/\${m.id}" class="block">
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
            \${canDelete ? \`
              <button onclick="deleteMeeting(\${m.id}, '\${m.title.replace(/'/g, "\\\\'")}', event)" class="absolute top-2 right-2 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors" title="会議を削除">
                <i class="fas fa-trash-alt"></i>
              </button>
            \` : ''}
          </div>
        \`).join('');
        
        document.getElementById('meeting-list').innerHTML = html;
      }
      
      // Create Meeting Modal
      function openCreateMeetingModal() {
        // Set default datetime to now + 1 hour
        const now = new Date();
        now.setHours(now.getHours() + 1);
        now.setMinutes(0);
        const localDatetime = now.toISOString().slice(0, 16);
        document.getElementById('meeting-datetime').value = localDatetime;
        
        // Reset form
        document.getElementById('create-meeting-form').reset();
        document.getElementById('meeting-datetime').value = localDatetime;
        document.getElementById('team-select-container').style.display = 'none';
        
        // Clear selection styling
        document.querySelectorAll('.meeting-type-option > div').forEach(div => {
          div.classList.remove('border-blue-500', 'bg-blue-50');
        });
        
        document.getElementById('create-meeting-modal').classList.add('active');
      }
      
      function closeCreateMeetingModal() {
        document.getElementById('create-meeting-modal').classList.remove('active');
      }
      
      function onMeetingTypeChange(radio) {
        // Update visual selection
        document.querySelectorAll('.meeting-type-option > div').forEach(div => {
          div.classList.remove('border-blue-500', 'bg-blue-50');
        });
        radio.parentElement.querySelector('div').classList.add('border-blue-500', 'bg-blue-50');
        
        // Show/hide team selector
        const teamContainer = document.getElementById('team-select-container');
        if (radio.value === '1') { // Team MTG
          teamContainer.style.display = 'block';
        } else {
          teamContainer.style.display = 'none';
        }
        
        // Auto-generate title suggestion
        const typeNames = {
          '1': 'チームMTG',
          '2': '本部会議',
          '3': '戦略会議',
          '4': '全体会議',
          '5': '1on1',
          '6': 'その他'
        };
        const today = dayjs();
        const weekNum = Math.ceil(today.date() / 7);
        let suggestedTitle = \`\${typeNames[radio.value]} 第\${weekNum}週\`;
        
        if (radio.value === '4') { // All-hands
          suggestedTitle = \`全体会議 \${today.format('M')}月\`;
        } else if (radio.value === '5') { // 1on1
          suggestedTitle = \`1on1 \${today.format('M/D')}\`;
        } else if (radio.value === '6') { // Other
          suggestedTitle = '';
        }
        
        document.getElementById('meeting-title').value = suggestedTitle;
      }
      
      document.getElementById('create-meeting-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const meetingTypeRadio = document.querySelector('input[name="meeting_type"]:checked');
        if (!meetingTypeRadio) {
          alert('会議の種類を選択してください');
          return;
        }
        
        const meetingTypeId = parseInt(meetingTypeRadio.value);
        const teamId = document.getElementById('meeting-team').value;
        const title = document.getElementById('meeting-title').value.trim();
        const datetime = document.getElementById('meeting-datetime').value;
        
        // Validate team selection for Team MTG
        if (meetingTypeId === 1 && !teamId) {
          alert('チームMTGの場合はチームを選択してください');
          return;
        }
        
        if (!title) {
          alert('タイトルを入力してください');
          return;
        }
        
        // Generate slug from title
        const slug = title.toLowerCase()
          .replace(/[^a-z0-9\\u3040-\\u309f\\u30a0-\\u30ff\\u4e00-\\u9faf]+/g, '-')
          .replace(/^-|-$/g, '') + '-' + Date.now();
        
        try {
          const res = await axios.post('/api/meetings', {
            organization_id: 1, // Default org
            team_id: teamId ? parseInt(teamId) : null,
            meeting_type_id: meetingTypeId,
            title: title,
            slug: slug,
            scheduled_at: datetime
          });
          
          closeCreateMeetingModal();
          
          // Redirect to the new meeting
          window.location.href = \`/meeting/\${res.data.id}\`;
        } catch (err) {
          console.error(err);
          alert('会議の作成に失敗しました');
        }
      });
      
      // Delete meeting function
      async function deleteMeeting(meetingId, title, event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (!confirm(\`会議「\${title}」を削除しますか？\\n\\nこの操作は取り消せません。\`)) {
          return;
        }
        
        // 即座にUIから削除（楽観的更新）
        const card = event.target.closest('.meeting-card');
        if (card) {
          card.style.opacity = '0.5';
          card.style.pointerEvents = 'none';
        }
        
        try {
          await axios.delete(\`/api/meetings/\${meetingId}\`);
          // 成功したらカードをアニメーションで消す
          if (card) {
            card.style.transition = 'all 0.3s ease';
            card.style.transform = 'scale(0.9)';
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 300);
          }
        } catch (err) {
          // 失敗したら元に戻す
          if (card) {
            card.style.opacity = '1';
            card.style.pointerEvents = 'auto';
          }
          alert(err.response?.data?.error || '会議の削除に失敗しました');
        }
      }
      
      // Login functionality with password
      document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        
        if (!email || !password) {
          errorDiv.textContent = 'メールアドレスとパスワードを入力してください';
          errorDiv.classList.remove('hidden');
          return;
        }
        
        try {
          const res = await axios.post('/api/auth/login', { email, password });
          window.currentUser = res.data.user;
          closeLoginModal();
          
          // Reload page data with new auth
          await loadCurrentUser();
          loadMeetings();
          updateMeetingTypeOptions();
        } catch (err) {
          errorDiv.textContent = err.response?.data?.error || 'ログインに失敗しました';
          errorDiv.classList.remove('hidden');
        }
      });
      
      // Update meeting type options based on permissions
      function updateMeetingTypeOptions() {
        const typeSelector = document.getElementById('meeting-type-selector');
        if (!typeSelector) return;
        
        const typeSlugs = ['team', 'headquarters', 'strategy', 'all-hands', 'one-on-one', 'other'];
        typeSelector.querySelectorAll('.meeting-type-option').forEach((option, idx) => {
          const slug = typeSlugs[idx];
          const canCreate = canCreateMeetingType(slug);
          
          if (!canCreate) {
            option.style.opacity = '0.5';
            option.style.pointerEvents = 'none';
            option.querySelector('input').disabled = true;
            option.querySelector('div').classList.add('bg-gray-100');
          } else {
            option.style.opacity = '1';
            option.style.pointerEvents = 'auto';
            option.querySelector('input').disabled = false;
            option.querySelector('div').classList.remove('bg-gray-100');
          }
        });
      }
      
      // Override openCreateMeetingModal to check auth
      const originalOpenCreateMeetingModal = openCreateMeetingModal;
      openCreateMeetingModal = function() {
        if (!window.currentUser) {
          openLoginModal();
          return;
        }
        
        // Check if user can create any meeting type
        const canCreateAny = window.accessibleMeetingTypes.some(mt => mt.can_create);
        if (!canCreateAny) {
          alert('会議を作成する権限がありません');
          return;
        }
        
        originalOpenCreateMeetingModal();
        updateMeetingTypeOptions();
      };
      
      // Initialize on page load
      async function initPage() {
        await loadCurrentUser();
        updateFilterButtons();
        loadMeetings();
        loadTeams();
        loadLoginUsers();
      }
      
      initPage();
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
    
    <!-- Login Modal (for meeting room) -->
    <div id="login-modal" class="modal">
      <div class="modal-content p-6" style="max-width: 24rem;">
        <h3 class="text-lg font-bold mb-4"><i class="fas fa-sign-in-alt mr-2 text-blue-600"></i>ログイン</h3>
        <p class="text-sm text-gray-600 mb-4">会議室にアクセスするにはログインしてください。</p>
        <form id="login-form">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">メールアドレス</label>
            <input type="email" id="login-email" class="w-full border rounded-lg px-3 py-2" placeholder="email@example.com" required>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">パスワード</label>
            <input type="password" id="login-password" class="w-full border rounded-lg px-3 py-2" placeholder="パスワードを入力" required>
          </div>
          <div id="login-error" class="mb-4 text-red-600 text-sm hidden"></div>
          <div class="flex justify-end space-x-2">
            <a href="/" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">トップへ戻る</a>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <i class="fas fa-sign-in-alt mr-2"></i>ログイン
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  const scripts = `
    <script>
      // Login functionality for meeting room with password
      document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        
        if (!email || !password) {
          errorDiv.textContent = 'メールアドレスとパスワードを入力してください';
          errorDiv.classList.remove('hidden');
          return;
        }
        
        try {
          const res = await axios.post('/api/auth/login', { email, password });
          window.currentUser = res.data.user;
          closeLoginModal();
          
          // Reload page to show meeting room
          window.location.reload();
        } catch (err) {
          errorDiv.textContent = err.response?.data?.error || 'ログインに失敗しました';
          errorDiv.classList.remove('hidden');
        }
      });
    </script>
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

// Admin page - Organization, Teams, Users management
app.get('/admin', (c) => {
  const content = `
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-800 mb-2"><i class="fas fa-cog mr-2"></i>管理設定</h1>
      <p class="text-gray-600">組織・チーム・ユーザーの管理</p>
    </div>
    
    <div id="admin-content">
      <div class="text-center py-8 text-gray-500">読み込み中...</div>
    </div>
    
    <!-- User Modal -->
    <div id="user-modal" class="modal">
      <div class="modal-content p-6" style="max-width: 28rem;">
        <h3 class="text-lg font-bold mb-4" id="user-modal-title"><i class="fas fa-user mr-2 text-blue-600"></i>ユーザー追加</h3>
        <form id="user-form">
          <input type="hidden" id="user-id">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">名前 <span class="text-red-500">*</span></label>
            <input type="text" id="user-name" class="w-full border rounded-lg px-3 py-2" required>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">メールアドレス <span class="text-red-500">*</span></label>
            <input type="email" id="user-email" class="w-full border rounded-lg px-3 py-2" required>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">パスワード <span id="password-required" class="text-red-500">*</span></label>
            <input type="password" id="user-password" class="w-full border rounded-lg px-3 py-2" placeholder="4文字以上">
            <p id="password-hint" class="text-xs text-gray-500 mt-1">編集時は空欄のままで変更なし</p>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">権限 <span class="text-red-500">*</span></label>
            <select id="user-role" class="w-full border rounded-lg px-3 py-2" required>
              <option value="participant">参加者（チームMTG・全体会議のみ）</option>
              <option value="manager">マネージャー（本部会議・管理機能も可能）</option>
              <option value="executive">経営層（戦略会議・全機能可能）</option>
            </select>
          </div>
          <div id="user-error" class="mb-4 text-red-600 text-sm hidden"></div>
          <div class="flex justify-end space-x-2">
            <button type="button" onclick="closeUserModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <i class="fas fa-save mr-2"></i>保存
            </button>
          </div>
        </form>
      </div>
    </div>
    
    <!-- Team Modal -->
    <div id="team-modal" class="modal">
      <div class="modal-content p-6" style="max-width: 28rem;">
        <h3 class="text-lg font-bold mb-4" id="team-modal-title"><i class="fas fa-users mr-2 text-green-600"></i>チーム追加</h3>
        <form id="team-form">
          <input type="hidden" id="team-id">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">チーム名 <span class="text-red-500">*</span></label>
            <input type="text" id="team-name" class="w-full border rounded-lg px-3 py-2" required>
          </div>
          <div id="team-error" class="mb-4 text-red-600 text-sm hidden"></div>
          <div class="flex justify-end space-x-2">
            <button type="button" onclick="closeTeamModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
            <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              <i class="fas fa-save mr-2"></i>保存
            </button>
          </div>
        </form>
      </div>
    </div>
    
    <!-- Add Member Modal -->
    <div id="member-modal" class="modal">
      <div class="modal-content p-6" style="max-width: 28rem;">
        <h3 class="text-lg font-bold mb-4"><i class="fas fa-user-plus mr-2 text-blue-600"></i>メンバー追加</h3>
        <form id="member-form">
          <input type="hidden" id="member-team-id">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">ユーザー <span class="text-red-500">*</span></label>
            <select id="member-user-id" class="w-full border rounded-lg px-3 py-2" required>
              <option value="">選択してください...</option>
            </select>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">チーム内役割</label>
            <select id="member-role" class="w-full border rounded-lg px-3 py-2">
              <option value="participant">メンバー</option>
              <option value="manager">リーダー</option>
            </select>
          </div>
          <div id="member-error" class="mb-4 text-red-600 text-sm hidden"></div>
          <div class="flex justify-end space-x-2">
            <button type="button" onclick="closeMemberModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <i class="fas fa-plus mr-2"></i>追加
            </button>
          </div>
        </form>
      </div>
    </div>
    
    <!-- Confirm Delete Modal -->
    <div id="confirm-modal" class="modal">
      <div class="modal-content p-6" style="max-width: 24rem;">
        <h3 class="text-lg font-bold mb-4 text-red-600"><i class="fas fa-exclamation-triangle mr-2"></i>削除確認</h3>
        <p id="confirm-message" class="text-gray-600 mb-4"></p>
        <div class="flex justify-end space-x-2">
          <button type="button" onclick="closeConfirmModal()" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
          <button type="button" id="confirm-delete-btn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            <i class="fas fa-trash mr-2"></i>削除
          </button>
        </div>
      </div>
    </div>
    
    <!-- Login Modal for Admin -->
    <div id="login-modal" class="modal">
      <div class="modal-content p-6" style="max-width: 24rem;">
        <h3 class="text-lg font-bold mb-4"><i class="fas fa-sign-in-alt mr-2 text-blue-600"></i>ログイン</h3>
        <p class="text-sm text-gray-600 mb-4">管理画面にアクセスするにはログインしてください。</p>
        <form id="login-form">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">メールアドレス</label>
            <input type="email" id="login-email" class="w-full border rounded-lg px-3 py-2" placeholder="email@example.com" required>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">パスワード</label>
            <input type="password" id="login-password" class="w-full border rounded-lg px-3 py-2" placeholder="パスワードを入力" required>
          </div>
          <div id="login-error" class="mb-4 text-red-600 text-sm hidden"></div>
          <div class="flex justify-end space-x-2">
            <a href="/" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">トップへ戻る</a>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <i class="fas fa-sign-in-alt mr-2"></i>ログイン
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  const scripts = `
    <script>
      let allUsers = [];
      let allTeams = [];
      let organization = null;
      let currentTab = 'users';
      
      const roleLabels = { participant: '参加者', manager: 'マネージャー', executive: '経営層' };
      const roleColors = { participant: 'bg-gray-100 text-gray-700', manager: 'bg-blue-100 text-blue-700', executive: 'bg-purple-100 text-purple-700' };
      
      async function initAdmin() {
        await loadCurrentUser();
        
        if (!window.currentUser) {
          renderLoginRequired();
          loadLoginUsers();
          return;
        }
        
        if (window.currentUser.role !== 'manager' && window.currentUser.role !== 'executive') {
          renderAccessDenied();
          return;
        }
        
        await loadAdminData();
        renderAdminPanel();
      }
      
      function renderLoginRequired() {
        document.getElementById('admin-content').innerHTML = \`
          <div class="bg-white rounded-lg shadow-sm p-8 text-center">
            <i class="fas fa-lock text-4xl text-gray-300 mb-4"></i>
            <h2 class="text-xl font-semibold text-gray-700 mb-2">ログインが必要です</h2>
            <p class="text-gray-500 mb-4">管理画面にアクセスするにはログインしてください</p>
            <button onclick="openLoginModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <i class="fas fa-sign-in-alt mr-2"></i>ログイン
            </button>
          </div>
        \`;
      }
      
      function renderAccessDenied() {
        document.getElementById('admin-content').innerHTML = \`
          <div class="bg-white rounded-lg shadow-sm p-8 text-center">
            <i class="fas fa-ban text-4xl text-red-300 mb-4"></i>
            <h2 class="text-xl font-semibold text-gray-700 mb-2">アクセス権限がありません</h2>
            <p class="text-gray-500 mb-4">管理画面にアクセスするにはマネージャー以上の権限が必要です</p>
            <a href="/" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 inline-block">
              <i class="fas fa-home mr-2"></i>トップへ戻る
            </a>
          </div>
        \`;
      }
      
      async function loadAdminData() {
        const [orgRes, usersRes, teamsRes] = await Promise.all([
          axios.get('/api/organizations'),
          axios.get('/api/users'),
          axios.get('/api/teams')
        ]);
        
        organization = orgRes.data[0];
        allUsers = usersRes.data;
        allTeams = teamsRes.data;
      }
      
      function renderAdminPanel() {
        const html = \`
          <div class="bg-white rounded-lg shadow-sm mb-6 p-4">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold text-gray-800">
                  <i class="fas fa-building mr-2 text-blue-600"></i>\${organization?.name || '組織名未設定'}
                </h2>
                <p class="text-sm text-gray-500">組織ID: \${organization?.id}</p>
              </div>
              <button onclick="editOrganization()" class="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded">
                <i class="fas fa-edit mr-1"></i>編集
              </button>
            </div>
          </div>
          
          <!-- Tabs -->
          <div class="border-b mb-4">
            <div class="flex space-x-4">
              <button onclick="switchTab('users')" class="admin-tab px-4 py-2 \${currentTab === 'users' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}" data-tab="users">
                <i class="fas fa-user mr-1"></i>ユーザー (\${allUsers.length})
              </button>
              <button onclick="switchTab('teams')" class="admin-tab px-4 py-2 \${currentTab === 'teams' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}" data-tab="teams">
                <i class="fas fa-users mr-1"></i>チーム (\${allTeams.length})
              </button>
            </div>
          </div>
          
          <div id="tab-content"></div>
        \`;
        
        document.getElementById('admin-content').innerHTML = html;
        renderTabContent();
      }
      
      function switchTab(tab) {
        currentTab = tab;
        document.querySelectorAll('.admin-tab').forEach(btn => {
          if (btn.dataset.tab === tab) {
            btn.classList.add('border-b-2', 'border-blue-600', 'text-blue-600');
            btn.classList.remove('text-gray-500');
          } else {
            btn.classList.remove('border-b-2', 'border-blue-600', 'text-blue-600');
            btn.classList.add('text-gray-500');
          }
        });
        renderTabContent();
      }
      
      function renderTabContent() {
        if (currentTab === 'users') {
          renderUsersTab();
        } else {
          renderTeamsTab();
        }
      }
      
      function renderUsersTab() {
        const html = \`
          <div class="flex justify-between items-center mb-4">
            <input type="text" id="user-search" placeholder="ユーザーを検索..." class="border rounded-lg px-3 py-2 w-64" oninput="filterUsers()">
            <button onclick="openUserModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <i class="fas fa-plus mr-2"></i>ユーザー追加
            </button>
          </div>
          
          <div class="bg-white rounded-lg shadow-sm overflow-hidden">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">名前</th>
                  <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">メールアドレス</th>
                  <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">権限</th>
                  <th class="px-4 py-3 text-right text-sm font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody id="users-table-body">
                \${allUsers.map(u => \`
                  <tr class="border-t user-row" data-name="\${u.name.toLowerCase()}" data-email="\${u.email.toLowerCase()}">
                    <td class="px-4 py-3">
                      <div class="font-medium text-gray-800">\${u.name}</div>
                    </td>
                    <td class="px-4 py-3 text-gray-600">\${u.email}</td>
                    <td class="px-4 py-3">
                      <span class="px-2 py-1 rounded-full text-xs font-medium \${roleColors[u.role]}">\${roleLabels[u.role]}</span>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <button onclick="editUser(\${u.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button onclick="confirmDeleteUser(\${u.id}, '\${u.name}')" class="text-red-600 hover:text-red-800">
                        <i class="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>
          </div>
        \`;
        
        document.getElementById('tab-content').innerHTML = html;
      }
      
      function renderTeamsTab() {
        const html = \`
          <div class="flex justify-end mb-4">
            <button onclick="openTeamModal()" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              <i class="fas fa-plus mr-2"></i>チーム追加
            </button>
          </div>
          
          <div class="grid gap-4 md:grid-cols-2">
            \${allTeams.map(t => \`
              <div class="bg-white rounded-lg shadow-sm p-4" id="team-card-\${t.id}">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="font-semibold text-gray-800">
                    <i class="fas fa-users mr-2 text-green-600"></i>\${t.name}
                  </h3>
                  <div>
                    <button onclick="editTeam(\${t.id}, '\${t.name}')" class="text-blue-600 hover:text-blue-800 mr-2">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="confirmDeleteTeam(\${t.id}, '\${t.name}')" class="text-red-600 hover:text-red-800">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
                <div id="team-members-\${t.id}" class="text-sm text-gray-500">読み込み中...</div>
                <button onclick="openMemberModal(\${t.id})" class="mt-3 text-blue-600 text-sm hover:underline">
                  <i class="fas fa-user-plus mr-1"></i>メンバー追加
                </button>
              </div>
            \`).join('')}
          </div>
        \`;
        
        document.getElementById('tab-content').innerHTML = html;
        
        // Load team members
        allTeams.forEach(t => loadTeamMembers(t.id));
      }
      
      async function loadTeamMembers(teamId) {
        try {
          const res = await axios.get(\`/api/teams/\${teamId}\`);
          const members = res.data.members || [];
          
          const memberHtml = members.length > 0 
            ? members.map(m => \`
                <div class="flex items-center justify-between py-1">
                  <span>\${m.name} <span class="text-xs text-gray-400">(\${m.team_role === 'manager' ? 'リーダー' : 'メンバー'})</span></span>
                  <button onclick="removeMember(\${teamId}, \${m.id})" class="text-red-400 hover:text-red-600 text-xs">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              \`).join('')
            : '<span class="text-gray-400">メンバーなし</span>';
          
          document.getElementById(\`team-members-\${teamId}\`).innerHTML = memberHtml;
        } catch (err) {
          console.error(err);
        }
      }
      
      function filterUsers() {
        const search = document.getElementById('user-search').value.toLowerCase();
        document.querySelectorAll('.user-row').forEach(row => {
          const name = row.dataset.name;
          const email = row.dataset.email;
          row.style.display = (name.includes(search) || email.includes(search)) ? '' : 'none';
        });
      }
      
      // User Modal
      function openUserModal(userId = null) {
        document.getElementById('user-id').value = userId || '';
        document.getElementById('user-name').value = '';
        document.getElementById('user-email').value = '';
        document.getElementById('user-password').value = '';
        document.getElementById('user-role').value = 'participant';
        document.getElementById('user-error').classList.add('hidden');
        
        // Show/hide password required indicator
        const isEdit = !!userId;
        document.getElementById('password-required').style.display = isEdit ? 'none' : 'inline';
        document.getElementById('password-hint').style.display = isEdit ? 'block' : 'none';
        document.getElementById('user-password').required = !isEdit;
        
        document.getElementById('user-modal-title').innerHTML = userId 
          ? '<i class="fas fa-user-edit mr-2 text-blue-600"></i>ユーザー編集'
          : '<i class="fas fa-user-plus mr-2 text-blue-600"></i>ユーザー追加';
        document.getElementById('user-modal').classList.add('active');
      }
      
      function closeUserModal() {
        document.getElementById('user-modal').classList.remove('active');
      }
      
      async function editUser(userId) {
        const user = allUsers.find(u => u.id === userId);
        if (!user) return;
        
        document.getElementById('user-id').value = user.id;
        document.getElementById('user-name').value = user.name;
        document.getElementById('user-email').value = user.email;
        document.getElementById('user-password').value = '';
        document.getElementById('user-role').value = user.role;
        document.getElementById('user-error').classList.add('hidden');
        
        // Edit mode: password is optional
        document.getElementById('password-required').style.display = 'none';
        document.getElementById('password-hint').style.display = 'block';
        document.getElementById('user-password').required = false;
        
        document.getElementById('user-modal-title').innerHTML = '<i class="fas fa-user-edit mr-2 text-blue-600"></i>ユーザー編集';
        document.getElementById('user-modal').classList.add('active');
      }
      
      document.getElementById('user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorDiv = document.getElementById('user-error');
        
        const userId = document.getElementById('user-id').value;
        const password = document.getElementById('user-password').value;
        
        // Validate password for new users
        if (!userId && (!password || password.length < 4)) {
          errorDiv.textContent = '新規ユーザーにはパスワード（4文字以上）が必要です';
          errorDiv.classList.remove('hidden');
          return;
        }
        
        const data = {
          name: document.getElementById('user-name').value,
          email: document.getElementById('user-email').value,
          role: document.getElementById('user-role').value,
          organization_id: organization.id
        };
        
        // Include password if provided
        if (password && password.length >= 4) {
          data.password = password;
        }
        
        try {
          if (userId) {
            await axios.put(\`/api/users/\${userId}\`, data);
            // If password was provided, set it separately
            if (password && password.length >= 4) {
              await axios.post('/api/auth/set-password', { user_id: parseInt(userId), password });
            }
          } else {
            await axios.post('/api/users', data);
          }
          closeUserModal();
          await loadAdminData();
          renderAdminPanel();
        } catch (err) {
          errorDiv.textContent = err.response?.data?.error || 'エラーが発生しました';
          errorDiv.classList.remove('hidden');
        }
      });
      
      // Team Modal
      function openTeamModal(teamId = null, teamName = '') {
        document.getElementById('team-id').value = teamId || '';
        document.getElementById('team-name').value = teamName;
        document.getElementById('team-error').classList.add('hidden');
        document.getElementById('team-modal-title').innerHTML = teamId 
          ? '<i class="fas fa-edit mr-2 text-green-600"></i>チーム編集'
          : '<i class="fas fa-users mr-2 text-green-600"></i>チーム追加';
        document.getElementById('team-modal').classList.add('active');
      }
      
      function closeTeamModal() {
        document.getElementById('team-modal').classList.remove('active');
      }
      
      function editTeam(teamId, teamName) {
        openTeamModal(teamId, teamName);
      }
      
      document.getElementById('team-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorDiv = document.getElementById('team-error');
        
        const teamId = document.getElementById('team-id').value;
        const data = {
          name: document.getElementById('team-name').value,
          organization_id: organization.id
        };
        
        try {
          if (teamId) {
            await axios.put(\`/api/teams/\${teamId}\`, data);
          } else {
            await axios.post('/api/teams', data);
          }
          closeTeamModal();
          await loadAdminData();
          renderAdminPanel();
        } catch (err) {
          errorDiv.textContent = err.response?.data?.error || 'エラーが発生しました';
          errorDiv.classList.remove('hidden');
        }
      });
      
      // Member Modal
      function openMemberModal(teamId) {
        document.getElementById('member-team-id').value = teamId;
        document.getElementById('member-user-id').innerHTML = '<option value="">選択してください...</option>' + 
          allUsers.map(u => \`<option value="\${u.id}">\${u.name} (\${u.email})</option>\`).join('');
        document.getElementById('member-role').value = 'participant';
        document.getElementById('member-error').classList.add('hidden');
        document.getElementById('member-modal').classList.add('active');
      }
      
      function closeMemberModal() {
        document.getElementById('member-modal').classList.remove('active');
      }
      
      document.getElementById('member-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorDiv = document.getElementById('member-error');
        
        const teamId = document.getElementById('member-team-id').value;
        const data = {
          user_id: parseInt(document.getElementById('member-user-id').value),
          role: document.getElementById('member-role').value
        };
        
        try {
          await axios.post(\`/api/teams/\${teamId}/members\`, data);
          closeMemberModal();
          loadTeamMembers(teamId);
        } catch (err) {
          errorDiv.textContent = err.response?.data?.error || 'エラーが発生しました';
          errorDiv.classList.remove('hidden');
        }
      });
      
      async function removeMember(teamId, userId) {
        if (!confirm('このメンバーをチームから削除しますか？')) return;
        
        try {
          await axios.delete(\`/api/teams/\${teamId}/members/\${userId}\`);
          loadTeamMembers(teamId);
        } catch (err) {
          alert(err.response?.data?.error || 'エラーが発生しました');
        }
      }
      
      // Confirm Modal
      let deleteCallback = null;
      
      function confirmDeleteUser(userId, userName) {
        document.getElementById('confirm-message').textContent = \`ユーザー「\${userName}」を削除しますか？この操作は取り消せません。\`;
        deleteCallback = async () => {
          try {
            await axios.delete(\`/api/users/\${userId}\`);
            closeConfirmModal();
            await loadAdminData();
            renderAdminPanel();
          } catch (err) {
            alert(err.response?.data?.error || 'エラーが発生しました');
          }
        };
        document.getElementById('confirm-modal').classList.add('active');
      }
      
      function confirmDeleteTeam(teamId, teamName) {
        document.getElementById('confirm-message').textContent = \`チーム「\${teamName}」を削除しますか？この操作は取り消せません。\`;
        deleteCallback = async () => {
          try {
            await axios.delete(\`/api/teams/\${teamId}\`);
            closeConfirmModal();
            await loadAdminData();
            renderAdminPanel();
          } catch (err) {
            alert(err.response?.data?.error || 'エラーが発生しました');
          }
        };
        document.getElementById('confirm-modal').classList.add('active');
      }
      
      function closeConfirmModal() {
        document.getElementById('confirm-modal').classList.remove('active');
        deleteCallback = null;
      }
      
      document.getElementById('confirm-delete-btn').addEventListener('click', () => {
        if (deleteCallback) deleteCallback();
      });
      
      // Organization Edit
      async function editOrganization() {
        const newName = prompt('組織名を入力してください', organization?.name || '');
        if (!newName || newName === organization?.name) return;
        
        try {
          await axios.put(\`/api/organizations/\${organization.id}\`, { name: newName });
          await loadAdminData();
          renderAdminPanel();
        } catch (err) {
          alert(err.response?.data?.error || 'エラーが発生しました');
        }
      }
      
      // Login functions with password
      document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        
        if (!email || !password) {
          errorDiv.textContent = 'メールアドレスとパスワードを入力してください';
          errorDiv.classList.remove('hidden');
          return;
        }
        
        try {
          await axios.post('/api/auth/login', { email, password });
          closeLoginModal();
          window.location.reload();
        } catch (err) {
          errorDiv.textContent = err.response?.data?.error || 'ログインに失敗しました';
          errorDiv.classList.remove('hidden');
        }
      });
      
      // Initialize
      initAdmin();
    </script>
  `;
  
  return c.html(renderPage('管理設定', content, scripts));
});

export default app;
