// VEXUM Meeting OS - Meeting Room JavaScript

// Current user permissions (loaded from global auth state)
let meetingUser = null;
let canManageCurrentMeeting = false;

// Labels
const statusLabels = {
  not_started: '未着手',
  in_progress: '進行中',
  reviewing: '確認中',
  completed: '完了',
  waiting: '待ち',
  on_hold: '保留'
};

const stateLabels = {
  pending_decision: '判断待ち',
  waiting: '待ち',
  unknown: '不明点',
  stuck: '詰まり',
  insufficient: '不足',
  concern: '不安要素'
};

const exceptionLabels = {
  external_wait: '外部待ち',
  low_priority: '優先度低',
  long_term: '長期施策',
  spec_wait: '仕様待ち',
  request_wait: '依頼待ち'
};

const nextActionLabels = {
  hearing: 'ヒアリング',
  proposal: '提案書',
  estimate: '概算見積',
  internal_consultation: '社内相談',
  approach: '打診'
};

// Meeting data
let meeting = null;
let users = [];

// Initialize
async function initMeetingRoom() {
  const meetingId = document.getElementById('meeting-room').dataset.meetingId;
  
  try {
    // Wait for auth state to be loaded
    if (!window.currentUser) {
      await loadCurrentUser();
    }
    
    // Check if logged in
    if (!window.currentUser) {
      renderLoginRequired();
      return;
    }
    
    meetingUser = window.currentUser;
    
    // Load users first
    const usersRes = await axios.get('/api/users');
    users = usersRes.data;
    
    // Load meeting data
    const res = await axios.get(`/api/meetings/${meetingId}`);
    meeting = res.data;
    
    // Check if user can view this meeting type
    const canView = canViewMeetingType(meeting.meeting_type_slug);
    if (!canView) {
      renderAccessDenied();
      return;
    }
    
    // Check if user can manage this meeting type
    canManageCurrentMeeting = canManageMeetingType(meeting.meeting_type_slug);
    
    renderMeetingRoom();
  } catch (err) {
    console.error(err);
    if (err.response?.status === 404) {
      document.getElementById('meeting-room').innerHTML = '<div class="text-red-500 p-4">会議が見つかりません</div>';
    } else if (err.response?.status === 403) {
      renderAccessDenied();
    } else {
      document.getElementById('meeting-room').innerHTML = '<div class="text-red-500 p-4">会議データの読み込みに失敗しました</div>';
    }
  }
}

// Render login required message
function renderLoginRequired() {
  document.getElementById('meeting-room').innerHTML = `
    <div class="bg-white rounded-lg shadow-sm p-8 text-center">
      <i class="fas fa-lock text-4xl text-gray-300 mb-4"></i>
      <h2 class="text-xl font-semibold text-gray-700 mb-2">ログインが必要です</h2>
      <p class="text-gray-500 mb-4">この会議室にアクセスするにはログインしてください</p>
      <button onclick="openLoginModal()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        <i class="fas fa-sign-in-alt mr-2"></i>ログイン
      </button>
    </div>
  `;
}

// Render access denied message
function renderAccessDenied() {
  document.getElementById('meeting-room').innerHTML = `
    <div class="bg-white rounded-lg shadow-sm p-8 text-center">
      <i class="fas fa-ban text-4xl text-red-300 mb-4"></i>
      <h2 class="text-xl font-semibold text-gray-700 mb-2">アクセス権限がありません</h2>
      <p class="text-gray-500 mb-4">この会議にアクセスする権限がありません</p>
      <a href="/" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 inline-block">
        <i class="fas fa-home mr-2"></i>会議一覧に戻る
      </a>
    </div>
  `;
}

// Main render function
function renderMeetingRoom() {
  const typeSlug = meeting.meeting_type_slug;
  const isManager = canManageCurrentMeeting;
  
  const html = `
    <!-- Meeting Header -->
    <div class="bg-white rounded-lg shadow-sm p-3 sm:p-4 mb-3 sm:mb-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="flex-1">
          <div class="flex flex-wrap items-center gap-2 mb-1">
            <span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs sm:text-sm rounded">${meeting.meeting_type_name}</span>
            ${meeting.team_name ? `<span class="text-gray-500 text-xs sm:text-sm">${meeting.team_name}</span>` : ''}
            <span class="status-badge ${meeting.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">
              ${meeting.status === 'scheduled' ? '予定' : meeting.status === 'active' ? '開催中' : '完了'}
            </span>
          </div>
          <h1 class="text-lg sm:text-xl font-bold text-gray-800">${meeting.title}</h1>
          <p class="text-xs sm:text-sm text-gray-500 mt-1">
            <i class="far fa-calendar-alt mr-1"></i>
            ${dayjs(meeting.scheduled_at).format('YYYY年M月D日(ddd) HH:mm')}
          </p>
        </div>
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-2">
          ${meeting.status === 'scheduled' ? `
            <button onclick="startMeeting()" class="w-full sm:w-auto px-4 py-3 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center">
              <i class="fas fa-play mr-2"></i>会議を開始
            </button>
          ` : ''}
          ${meeting.status === 'active' ? `
            <button onclick="openCheckinModal()" class="w-full sm:w-auto px-4 py-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center">
              <i class="fas fa-hand-paper mr-2"></i>チェックイン
            </button>
            <button onclick="checkEndMeeting()" class="w-full sm:w-auto px-4 py-3 sm:py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center">
              <i class="fas fa-flag-checkered mr-2"></i>終了
            </button>
          ` : ''}
        </div>
      </div>
    </div>
    
    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 meeting-room-grid">
      <!-- Left Column: Main Content (on mobile, this appears second) -->
      <div class="lg:col-span-2 space-y-3 sm:space-y-4 order-2 lg:order-1">
        ${isManager ? renderQuickCapture() : ''}
        
        <!-- Type-specific sections -->
        ${typeSlug === 'team' && meeting.clients ? renderClientBoard() : ''}
        ${typeSlug === 'headquarters' ? renderHeadquartersSection() : ''}
        ${typeSlug === 'strategy' ? renderStrategySection() : ''}
        
        <!-- Pending Broadcasts (for team meetings) -->
        ${typeSlug === 'team' && meeting.pending_broadcasts?.length > 0 ? renderPendingBroadcasts() : ''}
        
        <!-- Common Core Sections -->
        ${renderAgendaSection()}
        ${renderDecisionSection()}
        ${renderActionSection()}
        ${renderIssueSection()}
        ${renderLinkSection()}
      </div>
      
      <!-- Right Column: Radar & Check-ins (on mobile, this appears first) -->
      <div class="space-y-3 sm:space-y-4 order-1 lg:order-2">
        ${renderRadarSection()}
        ${renderCheckInSummary()}
        ${renderParticipants()}
      </div>
    </div>
  `;
  
  document.getElementById('meeting-room').innerHTML = html;
}

// Quick Capture (Manager only)
function renderQuickCapture() {
  return `
    <div class="bg-white rounded-lg shadow-sm p-3 sm:p-4">
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-2 quick-capture-mobile">
        <input type="text" id="quick-capture-input" 
          class="flex-1 border rounded-lg px-4 py-3 sm:py-2 quick-capture-input text-base" 
          placeholder="D: 決定 / A: Action / I: 保留"
          onkeydown="if(event.key === 'Enter') submitQuickCapture()">
        <button onclick="submitQuickCapture()" class="px-4 py-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center">
          <i class="fas fa-plus mr-2 sm:mr-0"></i><span class="sm:hidden">追加</span>
        </button>
      </div>
      <p class="text-xs text-gray-500 mt-2 hidden sm:block">
        ショートカット: D: (決定), A: (Action), I: (保留箱) 例: "D: 予算承認"
      </p>
    </div>
  `;
}

async function submitQuickCapture() {
  const input = document.getElementById('quick-capture-input');
  const value = input.value.trim();
  if (!value) return;
  
  try {
    await axios.post('/api/quick-capture', {
      meeting_id: meeting.id,
      input: value,
      created_by: meetingUser.id
    });
    input.value = '';
    refreshMeeting();
  } catch (err) {
    console.error(err);
    alert('追加に失敗しました');
  }
}

// Agenda Section
function renderAgendaSection() {
  const items = meeting.agenda_items || [];
  const isManager = canManageCurrentMeeting;
  
  return `
    <div class="bg-white rounded-lg shadow-sm section-card">
      <div class="p-3 sm:p-4 border-b flex items-center justify-between">
        <h3 class="font-bold text-gray-800 text-sm sm:text-base"><i class="fas fa-list-ul mr-2 text-blue-600"></i>今日の議題</h3>
        ${isManager ? `<button onclick="openAddModal('agenda')" class="text-blue-600 hover:text-blue-800 text-sm p-2 -m-2"><i class="fas fa-plus mr-1"></i>追加</button>` : ''}
      </div>
      <div class="divide-y">
        ${items.length === 0 ? '<div class="p-3 sm:p-4 text-gray-500 text-sm">議題がありません</div>' : ''}
        ${items.map((item, idx) => `
          <div class="p-3 flex items-start sm:items-center justify-between hover:bg-gray-50 ${item.is_from_broadcast ? 'bg-yellow-50' : ''}">
            <div class="flex items-start sm:items-center gap-2 sm:space-x-3 flex-1">
              <span class="text-gray-400 text-sm">${idx + 1}.</span>
              <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 flex-1">
                <span class="text-gray-800 text-sm sm:text-base">${item.content}</span>
                ${item.is_from_broadcast ? '<span class="text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded self-start">会社決定</span>' : ''}
              </div>
            </div>
            ${isManager ? `
              <button onclick="deleteAgendaItem(${item.id})" class="text-gray-400 hover:text-red-500 p-2 -m-2 ml-2">
                <i class="fas fa-times"></i>
              </button>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Decision Section
function renderDecisionSection() {
  const items = meeting.decisions || [];
  const isManager = canManageCurrentMeeting;
  
  return `
    <div class="bg-white rounded-lg shadow-sm section-card">
      <div class="p-3 sm:p-4 border-b flex items-center justify-between">
        <h3 class="font-bold text-gray-800 text-sm sm:text-base"><i class="fas fa-gavel mr-2 text-green-600"></i>決定事項</h3>
        <button onclick="openAddModal('decision')" class="text-blue-600 hover:text-blue-800 text-sm p-2 -m-2"><i class="fas fa-plus mr-1"></i>追加</button>
      </div>
      <div class="divide-y">
        ${items.length === 0 ? '<div class="p-3 sm:p-4 text-gray-500 text-sm">決定事項がありません</div>' : ''}
        ${items.map(item => `
          <div class="p-3 hover:bg-gray-50">
            <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div class="flex-1">
                <div class="flex items-start gap-2">
                  ${item.is_confirmed ? 
                    '<span class="text-green-600 mt-0.5"><i class="fas fa-check-circle"></i></span>' :
                    '<span class="text-yellow-500 mt-0.5"><i class="far fa-circle"></i></span>'
                  }
                  <span class="text-gray-800 text-sm sm:text-base">${item.content}</span>
                </div>
                ${item.related_link ? `<a href="${item.related_link}" target="_blank" class="text-sm text-blue-500 hover:underline ml-6 block mt-1"><i class="fas fa-link mr-1"></i>関連リンク</a>` : ''}
                <div class="text-xs text-gray-500 mt-1 ml-6">
                  ${item.creator_name || ''} ${dayjs(item.created_at).format('HH:mm')}
                </div>
              </div>
              ${isManager && !item.is_confirmed ? `
                <button onclick="confirmDecision(${item.id})" class="w-full sm:w-auto px-4 py-2 sm:px-3 sm:py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 flex items-center justify-center">
                  <i class="fas fa-check mr-1 sm:hidden"></i>確定
                </button>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Action Section
function renderActionSection() {
  const items = meeting.actions || [];
  const isManager = canManageCurrentMeeting;
  
  return `
    <div class="bg-white rounded-lg shadow-sm section-card">
      <div class="p-3 sm:p-4 border-b flex items-center justify-between">
        <h3 class="font-bold text-gray-800 text-sm sm:text-base"><i class="fas fa-tasks mr-2 text-purple-600"></i>次やること</h3>
        <button onclick="openAddModal('action')" class="text-blue-600 hover:text-blue-800 text-sm p-2 -m-2"><i class="fas fa-plus mr-1"></i>追加</button>
      </div>
      <div class="divide-y">
        ${items.length === 0 ? '<div class="p-3 sm:p-4 text-gray-500 text-sm">アクションがありません</div>' : ''}
        ${items.map(item => `
          <div class="p-3 hover:bg-gray-50 ${item.is_tentative ? 'bg-yellow-50' : ''}">
            <div class="flex flex-col gap-2">
              <div class="flex flex-wrap items-center gap-2">
                <span class="status-badge action-status-${item.status}">${statusLabels[item.status]}</span>
                ${item.is_tentative ? '<span class="text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">未確定</span>' : ''}
              </div>
              <span class="text-gray-800 text-sm sm:text-base">${item.content}</span>
              <div class="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                ${item.assignee_name ? `<span><i class="fas fa-user mr-1"></i>${item.assignee_name}</span>` : '<span class="text-yellow-600"><i class="fas fa-user-slash mr-1"></i>担当未定</span>'}
                ${item.due_date ? `<span><i class="far fa-calendar mr-1"></i>${dayjs(item.due_date).format('M/D')}</span>` : '<span class="text-yellow-600"><i class="far fa-calendar-times mr-1"></i>期限未定</span>'}
              </div>
              ${item.completion_criteria ? `<div class="text-xs text-gray-400"><i class="fas fa-flag-checkered mr-1"></i>${item.completion_criteria}</div>` : ''}
              ${item.waiting_reason ? `<div class="text-xs sm:text-sm text-red-500"><i class="fas fa-hourglass-half mr-1"></i>${item.waiting_reason}</div>` : ''}
              <div class="flex items-center gap-2 mt-1">
                <select onchange="updateActionStatus(${item.id}, this.value)" class="text-sm border rounded px-3 py-2 flex-1 sm:flex-none sm:w-auto" ${!isManager && item.assignee_id !== meetingUser.id ? 'disabled' : ''}>
                  ${Object.entries(statusLabels).map(([k, v]) => `<option value="${k}" ${item.status === k ? 'selected' : ''}>${v}</option>`).join('')}
                </select>
                ${isManager ? `
                  <button onclick="editAction(${item.id})" class="text-gray-400 hover:text-blue-500 p-2"><i class="fas fa-edit"></i></button>
                ` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Issue Section
function renderIssueSection() {
  const items = meeting.issues || [];
  
  return `
    <div class="bg-white rounded-lg shadow-sm section-card">
      <div class="p-3 sm:p-4 border-b flex items-center justify-between">
        <h3 class="font-bold text-gray-800 text-sm sm:text-base"><i class="fas fa-inbox mr-2 text-orange-600"></i>保留箱</h3>
        <button onclick="openAddModal('issue')" class="text-blue-600 hover:text-blue-800 text-sm p-2 -m-2"><i class="fas fa-plus mr-1"></i>追加</button>
      </div>
      <div class="divide-y">
        ${items.length === 0 ? '<div class="p-3 sm:p-4 text-gray-500 text-sm">保留事項がありません</div>' : ''}
        ${items.map(item => `
          <div class="p-3 hover:bg-gray-50">
            <div class="flex flex-col gap-2">
              <div class="flex flex-wrap items-center gap-2">
                <span class="status-badge issue-state-${item.state}">${stateLabels[item.state]}</span>
                ${item.times_postponed >= 2 ? `<span class="text-xs text-red-500"><i class="fas fa-exclamation-triangle"></i> ${item.times_postponed}回送り</span>` : ''}
              </div>
              <span class="text-gray-800 text-sm sm:text-base">${item.content}</span>
              <div class="flex flex-wrap gap-2 text-xs sm:text-sm text-gray-500">
                ${item.owner_name ? `<span><i class="fas fa-user mr-1"></i>${item.owner_name}</span>` : ''}
                ${item.team_name ? `<span><i class="fas fa-users mr-1"></i>${item.team_name}</span>` : ''}
                ${item.client_name ? `<span><i class="fas fa-building mr-1"></i>${item.client_name}</span>` : ''}
              </div>
              <div class="flex items-center gap-2 mt-1">
                <button onclick="convertIssueToAction(${item.id})" class="flex-1 sm:flex-none px-4 py-2 bg-blue-50 text-blue-600 rounded text-sm hover:bg-blue-100 flex items-center justify-center">
                  <i class="fas fa-arrow-right mr-2"></i>Action化
                </button>
                <button onclick="resolveIssue(${item.id})" class="flex-1 sm:flex-none px-4 py-2 bg-green-50 text-green-600 rounded text-sm hover:bg-green-100 flex items-center justify-center">
                  <i class="fas fa-check mr-2"></i>解決
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Link Section
function renderLinkSection() {
  const items = meeting.links || [];
  const isManager = canManageCurrentMeeting;
  
  return `
    <div class="bg-white rounded-lg shadow-sm section-card">
      <div class="p-3 sm:p-4 border-b flex items-center justify-between">
        <h3 class="font-bold text-gray-800 text-sm sm:text-base"><i class="fas fa-link mr-2 text-gray-600"></i>資料リンク</h3>
        <button onclick="openAddModal('link')" class="text-blue-600 hover:text-blue-800 text-sm p-2 -m-2"><i class="fas fa-plus mr-1"></i>追加</button>
      </div>
      <div class="divide-y">
        ${items.length === 0 ? '<div class="p-3 sm:p-4 text-gray-500 text-sm">リンクがありません</div>' : ''}
        ${items.map(item => `
          <div class="p-3 hover:bg-gray-50 flex items-center justify-between gap-2">
            <a href="${item.url}" target="_blank" class="text-blue-600 hover:underline flex items-center text-sm sm:text-base flex-1 min-w-0">
              <i class="fas fa-external-link-alt mr-2 flex-shrink-0"></i>
              <span class="truncate">${item.title || item.url}</span>
            </a>
            ${isManager ? `<button onclick="deleteLink(${item.id})" class="text-gray-400 hover:text-red-500 p-2 -m-2 flex-shrink-0"><i class="fas fa-times"></i></button>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Radar Section (Stagnation Detection)
function renderRadarSection() {
  const items = meeting.stagnation_items || [];
  const activeItems = items.filter(i => !i.snooze_until);
  
  return `
    <div class="bg-white rounded-lg shadow-sm section-card">
      <div class="p-3 sm:p-4 border-b">
        <h3 class="font-bold text-gray-800 text-sm sm:text-base"><i class="fas fa-exclamation-triangle mr-2 text-red-600"></i>要処理（レーダー）</h3>
        <p class="text-xs text-gray-500">停滞検知された項目</p>
      </div>
      <div class="max-h-64 overflow-y-auto">
        ${activeItems.length === 0 ? '<div class="p-3 sm:p-4 text-gray-500 text-sm text-center"><i class="fas fa-check-circle text-green-500 mr-1"></i>問題なし</div>' : ''}
        ${activeItems.map(item => {
          const typeLabels = {
            overdue_action: '期限超過',
            stale_action: '更新停止',
            unassigned_action: '担当未定',
            long_waiting: '待ち継続',
            postponed_issue: '繰り返し送り'
          };
          return `
            <div class="p-3 border-b radar-item">
              <div class="flex items-start gap-2">
                <div class="flex-1">
                  <div class="text-xs text-red-600 font-medium mb-1">${typeLabels[item.type]}</div>
                  <p class="text-sm text-gray-800">${item.content}</p>
                  <div class="flex flex-wrap gap-1 text-xs text-gray-500 mt-1">
                    ${item.assignee_name ? `<span>担当: ${item.assignee_name}</span>` : ''}
                    ${item.due_date ? `<span>期限: ${dayjs(item.due_date).format('M/D')}</span>` : ''}
                    ${item.days_stagnant ? `<span>${item.days_stagnant}日停滞</span>` : ''}
                    ${item.times_postponed ? `<span>${item.times_postponed}回送り</span>` : ''}
                  </div>
                </div>
                <button onclick="openSnoozeModal('${item.entity_type}', ${item.entity_id})" class="text-gray-400 hover:text-gray-600 p-2 -m-2">
                  <i class="fas fa-clock"></i>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// Check-in Summary
function renderCheckInSummary() {
  const checkIns = meeting.check_ins || [];
  const avgConfidence = checkIns.length > 0 
    ? (checkIns.reduce((sum, c) => sum + c.confidence_score, 0) / checkIns.length).toFixed(1)
    : '-';
  const needsHelpCount = checkIns.filter(c => c.needs_help).length;
  
  return `
    <div class="bg-white rounded-lg shadow-sm section-card">
      <div class="p-3 sm:p-4 border-b">
        <h3 class="font-bold text-gray-800 text-sm sm:text-base"><i class="fas fa-hand-paper mr-2 text-blue-600"></i>チェックイン</h3>
      </div>
      <div class="p-3 sm:p-4">
        <div class="grid grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
          <div class="text-center bg-blue-50 rounded-lg p-3">
            <div class="text-xl sm:text-2xl font-bold text-blue-600">${avgConfidence}</div>
            <div class="text-xs text-gray-500">平均確度</div>
          </div>
          <div class="text-center ${needsHelpCount > 0 ? 'bg-red-50' : 'bg-green-50'} rounded-lg p-3">
            <div class="text-xl sm:text-2xl font-bold ${needsHelpCount > 0 ? 'text-red-600' : 'text-green-600'}">${needsHelpCount}</div>
            <div class="text-xs text-gray-500">助け必要</div>
          </div>
        </div>
        <div class="space-y-2">
          ${checkIns.slice(0, 5).map(c => `
            <div class="flex items-center justify-between text-sm py-1">
              <span class="text-gray-700">${c.is_anonymous ? '匿名' : c.user_name}</span>
              <div class="flex items-center gap-2">
                <span class="font-medium ${c.confidence_score >= 7 ? 'text-green-600' : c.confidence_score >= 4 ? 'text-yellow-600' : 'text-red-600'}">${c.confidence_score}</span>
                <span class="status-badge issue-state-${c.uncertainty_factor}" style="font-size: 0.65rem;">${stateLabels[c.uncertainty_factor]}</span>
                ${c.needs_help ? '<i class="fas fa-exclamation-circle text-red-500"></i>' : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// Participants
function renderParticipants() {
  const participants = meeting.participants || [];
  
  return `
    <div class="bg-white rounded-lg shadow-sm section-card">
      <div class="p-3 sm:p-4 border-b">
        <h3 class="font-bold text-gray-800 text-sm sm:text-base"><i class="fas fa-users mr-2 text-gray-600"></i>参加者</h3>
      </div>
      <div class="p-3 sm:p-4">
        <div class="flex flex-wrap gap-2">
          ${participants.map(p => `
            <span class="px-3 py-1.5 bg-gray-100 rounded text-sm text-gray-700 ${p.meeting_role === 'manager' ? 'border border-blue-300' : ''}">
              ${p.meeting_role === 'manager' ? '<i class="fas fa-crown text-yellow-500 mr-1"></i>' : ''}
              ${p.name}
            </span>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// Client Board (Team MTG)
function renderClientBoard() {
  const clients = meeting.clients || [];
  const focusClients = clients.filter(c => c.status === 'focus');
  const allClients = clients.filter(c => c.status === 'all');
  const dormantClients = clients.filter(c => c.status === 'dormant');
  
  return `
    <div class="bg-white rounded-lg shadow-sm">
      <div class="p-4 border-b flex items-center justify-between">
        <h3 class="font-bold text-gray-800"><i class="fas fa-building mr-2 text-green-600"></i>常駐先ボード</h3>
        <div class="flex space-x-2">
          <button onclick="setClientTab('focus')" class="client-tab px-3 py-1 text-sm rounded bg-green-100 text-green-700" data-tab="focus">Focus (${focusClients.length})</button>
          <button onclick="setClientTab('all')" class="client-tab px-3 py-1 text-sm rounded bg-gray-100 text-gray-600" data-tab="all">全件 (${allClients.length})</button>
          <button onclick="setClientTab('dormant')" class="client-tab px-3 py-1 text-sm rounded bg-gray-100 text-gray-600" data-tab="dormant">休眠 (${dormantClients.length})</button>
        </div>
      </div>
      <div id="client-list" class="divide-y max-h-96 overflow-y-auto">
        ${renderClientList(focusClients)}
      </div>
    </div>
  `;
}

function renderClientList(clients) {
  if (clients.length === 0) {
    return '<div class="p-4 text-gray-500 text-sm">クライアントがありません</div>';
  }
  
  return clients.map(client => {
    const summary = client.weekly_summary;
    const initiatives = client.initiatives || [];
    const seeds = client.proposal_seeds || [];
    
    return `
      <div class="p-4 client-${client.status}">
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-semibold text-gray-800">${client.name}</h4>
          <div class="flex space-x-2">
            <button onclick="toggleClientExpand(${client.id})" class="text-gray-400 hover:text-gray-600">
              <i class="fas fa-chevron-down" id="client-expand-icon-${client.id}"></i>
            </button>
            <select onchange="updateClientStatus(${client.id}, this.value)" class="text-xs border rounded px-2 py-1">
              <option value="focus" ${client.status === 'focus' ? 'selected' : ''}>Focus</option>
              <option value="all" ${client.status === 'all' ? 'selected' : ''}>全件</option>
              <option value="dormant" ${client.status === 'dormant' ? 'selected' : ''}>休眠</option>
            </select>
          </div>
        </div>
        
        <div id="client-details-${client.id}" class="space-y-3">
          <!-- 今週の成果 -->
          <div>
            <div class="text-xs text-gray-500 mb-1">今週の成果</div>
            <div class="text-sm text-gray-700 whitespace-pre-line">${summary?.achievements || '<span class="text-gray-400">未入力</span>'}</div>
          </div>
          
          <!-- 打ち手（施策） -->
          <div>
            <div class="text-xs text-gray-500 mb-1">打ち手</div>
            ${initiatives.length === 0 ? '<div class="text-sm text-gray-400">施策なし</div>' : ''}
            ${initiatives.map(init => `
              <div class="flex items-center justify-between text-sm py-1">
                <div class="flex items-center space-x-2">
                  <span class="status-badge action-status-${init.status}" style="font-size: 0.65rem;">${statusLabels[init.status]}</span>
                  <span>${init.name}</span>
                </div>
                <span class="text-xs text-gray-400">${init.next_review_date ? dayjs(init.next_review_date).format('M/D') : ''}</span>
              </div>
            `).join('')}
            <button onclick="addInitiative(${client.id})" class="text-xs text-blue-500 hover:text-blue-700 mt-1"><i class="fas fa-plus mr-1"></i>施策追加</button>
          </div>
          
          <!-- 来週やること -->
          <div>
            <div class="text-xs text-gray-500 mb-1">来週やること</div>
            <div class="text-sm text-gray-700 whitespace-pre-line">${summary?.next_week_commitment || '<span class="text-gray-400">未入力</span>'}</div>
          </div>
          
          <!-- 提案のタネ -->
          <div>
            <div class="text-xs text-gray-500 mb-1">提案のタネ</div>
            ${seeds.length === 0 ? '<div class="text-sm text-gray-400">なし</div>' : ''}
            ${seeds.map(seed => `
              <div class="text-sm py-1 bg-yellow-50 rounded px-2 mb-1">
                <div class="text-gray-700">${seed.memo}</div>
                <div class="flex items-center justify-between mt-1">
                  <select onchange="updateSeedNextAction(${seed.id}, this.value)" class="text-xs border rounded px-1">
                    <option value="">次の一手を選択</option>
                    ${Object.entries(nextActionLabels).map(([k, v]) => `<option value="${k}" ${seed.next_action === k ? 'selected' : ''}>${v}</option>`).join('')}
                  </select>
                  <button onclick="markSeedDormant(${seed.id})" class="text-xs text-gray-400 hover:text-gray-600">休眠へ</button>
                </div>
              </div>
            `).join('')}
            <button onclick="addProposalSeed(${client.id})" class="text-xs text-blue-500 hover:text-blue-700 mt-1"><i class="fas fa-plus mr-1"></i>タネ追加</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function setClientTab(status) {
  const clients = meeting.clients || [];
  const filtered = clients.filter(c => c.status === status);
  
  document.querySelectorAll('.client-tab').forEach(tab => {
    if (tab.dataset.tab === status) {
      tab.classList.add('bg-green-100', 'text-green-700');
      tab.classList.remove('bg-gray-100', 'text-gray-600');
    } else {
      tab.classList.remove('bg-green-100', 'text-green-700');
      tab.classList.add('bg-gray-100', 'text-gray-600');
    }
  });
  
  document.getElementById('client-list').innerHTML = renderClientList(filtered);
}

// Headquarters Section
function renderHeadquartersSection() {
  const broadcasts = meeting.broadcasts || [];
  const ruleUpdates = meeting.rule_updates || [];
  const crossTeamIssues = meeting.cross_team_issues || [];
  
  return `
    <div class="space-y-4">
      <!-- 会社決定 -->
      <div class="bg-white rounded-lg shadow-sm">
        <div class="p-4 border-b flex items-center justify-between">
          <h3 class="font-bold text-gray-800"><i class="fas fa-bullhorn mr-2 text-blue-600"></i>会社決定（通達）</h3>
          <button onclick="openAddModal('broadcast')" class="text-blue-600 hover:text-blue-800 text-sm"><i class="fas fa-plus mr-1"></i>追加</button>
        </div>
        <div class="divide-y">
          ${broadcasts.length === 0 ? '<div class="p-4 text-gray-500 text-sm">会社決定がありません</div>' : ''}
          ${broadcasts.map(b => `
            <div class="p-4">
              <p class="text-gray-800 font-medium">${b.content}</p>
              ${b.background_link ? `<a href="${b.background_link}" target="_blank" class="text-sm text-blue-500 hover:underline"><i class="fas fa-link mr-1"></i>背景</a>` : ''}
              ${b.effective_date ? `<p class="text-sm text-gray-500 mt-1">開始日: ${dayjs(b.effective_date).format('M/D')}</p>` : ''}
              <div class="mt-2 flex flex-wrap gap-1">
                ${(b.targets || []).map(t => `
                  <span class="text-xs px-2 py-0.5 rounded ${b.consumed_by_teams?.includes(t.id) ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                    ${t.name} ${b.consumed_by_teams?.includes(t.id) ? '✓' : ''}
                  </span>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- ルール更新 -->
      <div class="bg-white rounded-lg shadow-sm">
        <div class="p-4 border-b flex items-center justify-between">
          <h3 class="font-bold text-gray-800"><i class="fas fa-book mr-2 text-purple-600"></i>ルール更新</h3>
          <button onclick="openAddModal('rule_update')" class="text-blue-600 hover:text-blue-800 text-sm"><i class="fas fa-plus mr-1"></i>追加</button>
        </div>
        <div class="divide-y">
          ${ruleUpdates.length === 0 ? '<div class="p-4 text-gray-500 text-sm">ルール更新がありません</div>' : ''}
          ${ruleUpdates.map(r => `
            <div class="p-4">
              <p class="text-gray-800 font-medium">${r.change_description}</p>
              ${r.impact ? `<p class="text-sm text-gray-600 mt-1"><strong>影響:</strong> ${r.impact}</p>` : ''}
              ${r.migration_steps ? `<p class="text-sm text-gray-600"><strong>移行:</strong> ${r.migration_steps}</p>` : ''}
              ${r.completion_criteria ? `<p class="text-sm text-gray-600"><strong>完了条件:</strong> ${r.completion_criteria}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- 詰まり一覧（横断） -->
      <div class="bg-white rounded-lg shadow-sm">
        <div class="p-4 border-b">
          <h3 class="font-bold text-gray-800"><i class="fas fa-exclamation-triangle mr-2 text-red-600"></i>詰まり一覧（横断）</h3>
        </div>
        <div class="divide-y max-h-64 overflow-y-auto">
          ${crossTeamIssues.length === 0 ? '<div class="p-4 text-gray-500 text-sm">横断課題がありません</div>' : ''}
          ${crossTeamIssues.map(i => `
            <div class="p-3">
              <div class="flex items-center space-x-2">
                <span class="status-badge issue-state-${i.state}">${stateLabels[i.state]}</span>
                <span class="text-gray-800">${i.content}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// Strategy Section
function renderStrategySection() {
  const priorities = meeting.strategy_priorities || [];
  const notDoing = meeting.strategy_not_doing || [];
  const allocations = meeting.strategy_allocations || [];
  
  return `
    <div class="space-y-4">
      <!-- 最優先TOP3 -->
      <div class="bg-white rounded-lg shadow-sm">
        <div class="p-4 border-b flex items-center justify-between">
          <h3 class="font-bold text-gray-800"><i class="fas fa-trophy mr-2 text-yellow-500"></i>最優先TOP3</h3>
          <button onclick="openAddModal('priority')" class="text-blue-600 hover:text-blue-800 text-sm"><i class="fas fa-plus mr-1"></i>追加</button>
        </div>
        <div class="p-4">
          ${[1, 2, 3].map(rank => {
            const p = priorities.find(x => x.priority_rank === rank);
            return `
              <div class="flex items-center space-x-3 mb-3">
                <span class="w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center font-bold">${rank}</span>
                <span class="flex-1 text-gray-800">${p ? p.content : '<span class="text-gray-400">未設定</span>'}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      
      <!-- やらないこと -->
      <div class="bg-white rounded-lg shadow-sm">
        <div class="p-4 border-b flex items-center justify-between">
          <h3 class="font-bold text-gray-800"><i class="fas fa-ban mr-2 text-red-500"></i>やらないこと</h3>
          <button onclick="openAddModal('not_doing')" class="text-blue-600 hover:text-blue-800 text-sm"><i class="fas fa-plus mr-1"></i>追加</button>
        </div>
        <div class="divide-y">
          ${notDoing.length === 0 ? '<div class="p-4 text-gray-500 text-sm">やらないことがありません</div>' : ''}
          ${notDoing.map(n => `
            <div class="p-3">
              <p class="text-gray-800">${n.content}</p>
              ${n.reason ? `<p class="text-sm text-gray-500 mt-1">理由: ${n.reason}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- 配分 -->
      <div class="bg-white rounded-lg shadow-sm">
        <div class="p-4 border-b flex items-center justify-between">
          <h3 class="font-bold text-gray-800"><i class="fas fa-chart-pie mr-2 text-blue-500"></i>配分</h3>
          <button onclick="openAddModal('allocation')" class="text-blue-600 hover:text-blue-800 text-sm"><i class="fas fa-plus mr-1"></i>追加</button>
        </div>
        <div class="divide-y">
          ${allocations.length === 0 ? '<div class="p-4 text-gray-500 text-sm">配分メモがありません</div>' : ''}
          ${allocations.map(a => `
            <div class="p-3">
              <p class="text-gray-800">${a.content}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// Pending Broadcasts (for team meetings)
function renderPendingBroadcasts() {
  const broadcasts = meeting.pending_broadcasts || [];
  
  return `
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <h4 class="font-bold text-yellow-800 mb-2"><i class="fas fa-bell mr-2"></i>未消化の会社決定</h4>
      <p class="text-sm text-yellow-700 mb-3">以下の会社決定を確認し、対応を決めてください</p>
      ${broadcasts.map(b => `
        <div class="bg-white rounded p-3 mb-2">
          <p class="text-gray-800">${b.content}</p>
          <div class="flex space-x-2 mt-2">
            <button onclick="consumeBroadcast(${b.id}, 'acknowledged')" class="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200">了承</button>
            <button onclick="consumeBroadcast(${b.id}, 'actioned')" class="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200">Action化</button>
            <button onclick="consumeBroadcast(${b.id}, 'held')" class="px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-sm hover:bg-yellow-200">保留化</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// API Functions
async function refreshMeeting() {
  try {
    const res = await axios.get(`/api/meetings/${meeting.id}`);
    meeting = res.data;
    renderMeetingRoom();
  } catch (err) {
    console.error(err);
  }
}

async function startMeeting() {
  try {
    await axios.patch(`/api/meetings/${meeting.id}`, { status: 'active' });
    refreshMeeting();
  } catch (err) {
    console.error(err);
    alert('会議の開始に失敗しました');
  }
}

function checkEndMeeting() {
  const warnings = [];
  
  if ((meeting.decisions || []).length === 0) {
    warnings.push({ type: 'warning', message: '今日は決定なしでOK？' });
  }
  if ((meeting.actions || []).length === 0) {
    warnings.push({ type: 'warning', message: '次アクションなしでOK？' });
  }
  const tentativeCount = (meeting.actions || []).filter(a => a.is_tentative).length;
  if (tentativeCount > 0) {
    warnings.push({ type: 'info', message: `未確定Actionが${tentativeCount}件あります。会議後3分で整えますか？` });
  }
  
  const warningsHtml = warnings.length === 0 
    ? '<p class="text-green-600"><i class="fas fa-check-circle mr-2"></i>すべて確認済みです</p>'
    : warnings.map(w => `
        <div class="flex items-center space-x-2 p-2 rounded ${w.type === 'warning' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'} mb-2">
          <i class="fas ${w.type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
          <span>${w.message}</span>
        </div>
      `).join('');
  
  document.getElementById('end-meeting-warnings').innerHTML = warningsHtml;
  document.getElementById('end-meeting-modal').classList.add('active');
}

function closeEndMeetingModal() {
  document.getElementById('end-meeting-modal').classList.remove('active');
}

async function confirmEndMeeting() {
  try {
    await axios.patch(`/api/meetings/${meeting.id}`, { status: 'completed' });
    closeEndMeetingModal();
    refreshMeeting();
  } catch (err) {
    console.error(err);
    alert('会議の終了に失敗しました');
  }
}

async function deleteAgendaItem(id) {
  if (!confirm('この議題を削除しますか？')) return;
  try {
    await axios.delete(`/api/agenda-items/${id}`);
    refreshMeeting();
  } catch (err) {
    console.error(err);
  }
}

async function confirmDecision(id) {
  try {
    await axios.patch(`/api/decisions/${id}`, { 
      is_confirmed: 1, 
      confirmed_by: meetingUser.id 
    });
    refreshMeeting();
  } catch (err) {
    console.error(err);
  }
}

async function updateActionStatus(id, status) {
  try {
    await axios.patch(`/api/actions/${id}`, { status });
    refreshMeeting();
  } catch (err) {
    console.error(err);
  }
}

async function convertIssueToAction(issueId) {
  try {
    await axios.post(`/api/issues/${issueId}/convert-to-action`, {
      meeting_id: meeting.id,
      created_by: meetingUser.id
    });
    refreshMeeting();
  } catch (err) {
    console.error(err);
    alert('Action化に失敗しました');
  }
}

async function resolveIssue(issueId) {
  if (!confirm('この保留事項を解決済みにしますか？')) return;
  try {
    await axios.patch(`/api/issues/${issueId}`, { resolved: true });
    refreshMeeting();
  } catch (err) {
    console.error(err);
  }
}

async function deleteLink(id) {
  if (!confirm('このリンクを削除しますか？')) return;
  try {
    await axios.delete(`/api/links/${id}`);
    refreshMeeting();
  } catch (err) {
    console.error(err);
  }
}

async function updateClientStatus(clientId, status) {
  try {
    await axios.patch(`/api/clients/${clientId}`, { status });
    refreshMeeting();
  } catch (err) {
    console.error(err);
  }
}

async function consumeBroadcast(broadcastId, consumptionType) {
  try {
    await axios.post(`/api/broadcasts/${broadcastId}/consume`, {
      team_id: meeting.team_id,
      meeting_id: meeting.id,
      consumption_type: consumptionType
    });
    refreshMeeting();
  } catch (err) {
    console.error(err);
    alert('処理に失敗しました');
  }
}

// Modal Functions
function openCheckinModal() {
  document.getElementById('checkin-modal').classList.add('active');
}

function closeCheckinModal() {
  document.getElementById('checkin-modal').classList.remove('active');
}

document.getElementById('checkin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const data = {
    meeting_id: meeting.id,
    user_id: meetingUser.id,
    confidence_score: parseInt(document.getElementById('confidence-score').value),
    uncertainty_factor: document.getElementById('uncertainty-factor').value,
    needs_help: document.getElementById('needs-help').checked,
    is_anonymous: document.getElementById('is-anonymous').checked
  };
  
  try {
    await axios.post('/api/check-ins', data);
    closeCheckinModal();
    refreshMeeting();
  } catch (err) {
    console.error(err);
    alert('チェックインに失敗しました');
  }
});

function openSnoozeModal(entityType, entityId) {
  document.getElementById('snooze-entity-type').value = entityType;
  document.getElementById('snooze-entity-id').value = entityId;
  document.getElementById('snooze-modal').classList.add('active');
}

function closeSnoozeModal() {
  document.getElementById('snooze-modal').classList.remove('active');
}

document.getElementById('snooze-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const entityType = document.getElementById('snooze-entity-type').value;
  const entityId = document.getElementById('snooze-entity-id').value;
  const duration = document.getElementById('snooze-duration').value;
  const exceptionReason = document.getElementById('exception-reason').value;
  
  let snoozeUntil = null;
  if (duration === '3') {
    snoozeUntil = dayjs().add(3, 'day').format('YYYY-MM-DD');
  } else if (duration === '7') {
    snoozeUntil = dayjs().add(7, 'day').format('YYYY-MM-DD');
  } else if (duration === 'next') {
    snoozeUntil = dayjs(meeting.scheduled_at).add(7, 'day').format('YYYY-MM-DD');
  }
  
  try {
    await axios.post('/api/snooze', {
      entity_type: entityType,
      entity_id: parseInt(entityId),
      snooze_until: snoozeUntil,
      exception_reason: exceptionReason || null
    });
    closeSnoozeModal();
    refreshMeeting();
  } catch (err) {
    console.error(err);
    alert('設定に失敗しました');
  }
});

// Quick Add Modal
function openAddModal(type) {
  const titles = {
    agenda: '議題を追加',
    decision: '決定事項を追加',
    action: 'アクションを追加',
    issue: '保留箱に追加',
    link: 'リンクを追加',
    broadcast: '会社決定を追加',
    rule_update: 'ルール更新を追加',
    priority: '優先事項を追加',
    not_doing: 'やらないことを追加',
    allocation: '配分メモを追加'
  };
  
  document.getElementById('quick-add-title').textContent = titles[type] || '追加';
  document.getElementById('quick-add-type').value = type;
  document.getElementById('quick-add-content').value = '';
  
  // Type-specific extra fields
  let extraHtml = '';
  if (type === 'action') {
    extraHtml = `
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">担当者</label>
        <select id="quick-add-assignee" class="w-full border rounded-lg px-3 py-2">
          <option value="">未定</option>
          ${users.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
        </select>
      </div>
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">期限</label>
        <input type="date" id="quick-add-due-date" class="w-full border rounded-lg px-3 py-2">
      </div>
    `;
  } else if (type === 'issue') {
    extraHtml = `
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">状態</label>
        <select id="quick-add-state" class="w-full border rounded-lg px-3 py-2">
          ${Object.entries(stateLabels).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
        </select>
      </div>
    `;
  } else if (type === 'link') {
    extraHtml = `
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">タイトル（任意）</label>
        <input type="text" id="quick-add-link-title" class="w-full border rounded-lg px-3 py-2">
      </div>
    `;
  } else if (type === 'broadcast') {
    extraHtml = `
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">対象チーム</label>
        <div id="quick-add-teams" class="space-y-1">
          ${users.length > 0 ? '' : '読み込み中...'}
        </div>
      </div>
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">開始日</label>
        <input type="date" id="quick-add-effective-date" class="w-full border rounded-lg px-3 py-2">
      </div>
    `;
    // Load teams
    axios.get('/api/teams').then(res => {
      document.getElementById('quick-add-teams').innerHTML = res.data.map(t => `
        <label class="flex items-center">
          <input type="checkbox" name="target_teams" value="${t.id}" class="mr-2">
          ${t.name}
        </label>
      `).join('');
    });
  } else if (type === 'priority') {
    extraHtml = `
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">優先順位</label>
        <select id="quick-add-priority-rank" class="w-full border rounded-lg px-3 py-2">
          <option value="1">1位</option>
          <option value="2">2位</option>
          <option value="3">3位</option>
        </select>
      </div>
    `;
  } else if (type === 'not_doing') {
    extraHtml = `
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">理由（任意）</label>
        <input type="text" id="quick-add-reason" class="w-full border rounded-lg px-3 py-2">
      </div>
    `;
  }
  
  document.getElementById('quick-add-extra-fields').innerHTML = extraHtml;
  document.getElementById('quick-add-modal').classList.add('active');
}

function closeQuickAddModal() {
  document.getElementById('quick-add-modal').classList.remove('active');
}

document.getElementById('quick-add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const type = document.getElementById('quick-add-type').value;
  const content = document.getElementById('quick-add-content').value.trim();
  
  if (!content) {
    alert('内容を入力してください');
    return;
  }
  
  try {
    switch (type) {
      case 'agenda':
        await axios.post('/api/agenda-items', {
          meeting_id: meeting.id,
          content,
          created_by: meetingUser.id
        });
        break;
      case 'decision':
        await axios.post('/api/decisions', {
          meeting_id: meeting.id,
          content,
          created_by: meetingUser.id
        });
        break;
      case 'action':
        const assigneeId = document.getElementById('quick-add-assignee')?.value;
        const dueDate = document.getElementById('quick-add-due-date')?.value;
        await axios.post('/api/actions', {
          meeting_id: meeting.id,
          content,
          assignee_id: assigneeId ? parseInt(assigneeId) : null,
          due_date: dueDate || null,
          created_by: meetingUser.id
        });
        break;
      case 'issue':
        const state = document.getElementById('quick-add-state')?.value || 'pending_decision';
        await axios.post('/api/issues', {
          meeting_id: meeting.id,
          organization_id: meeting.organization_id,
          team_id: meeting.team_id,
          content,
          state,
          created_by: meetingUser.id
        });
        break;
      case 'link':
        const title = document.getElementById('quick-add-link-title')?.value;
        await axios.post('/api/links', {
          meeting_id: meeting.id,
          url: content,
          title: title || null,
          created_by: meetingUser.id
        });
        break;
      case 'broadcast':
        const targetCheckboxes = document.querySelectorAll('input[name="target_teams"]:checked');
        const targetTeamIds = Array.from(targetCheckboxes).map(cb => parseInt(cb.value));
        const effectiveDate = document.getElementById('quick-add-effective-date')?.value;
        await axios.post('/api/broadcasts', {
          organization_id: meeting.organization_id,
          meeting_id: meeting.id,
          content,
          effective_date: effectiveDate || null,
          target_team_ids: targetTeamIds,
          created_by: meetingUser.id
        });
        break;
      case 'rule_update':
        await axios.post('/api/rule-updates', {
          meeting_id: meeting.id,
          change_description: content,
          created_by: meetingUser.id
        });
        break;
      case 'priority':
        const priorityRank = parseInt(document.getElementById('quick-add-priority-rank')?.value || '1');
        await axios.post('/api/strategy-priorities', {
          meeting_id: meeting.id,
          priority_rank: priorityRank,
          content
        });
        break;
      case 'not_doing':
        const reason = document.getElementById('quick-add-reason')?.value;
        await axios.post('/api/strategy-not-doing', {
          meeting_id: meeting.id,
          content,
          reason: reason || null
        });
        break;
      case 'allocation':
        await axios.post('/api/strategy-allocations', {
          meeting_id: meeting.id,
          content
        });
        break;
    }
    
    closeQuickAddModal();
    refreshMeeting();
  } catch (err) {
    console.error(err);
    alert('追加に失敗しました');
  }
});

// Client-specific functions
function toggleClientExpand(clientId) {
  const details = document.getElementById(`client-details-${clientId}`);
  const icon = document.getElementById(`client-expand-icon-${clientId}`);
  if (details.style.display === 'none') {
    details.style.display = 'block';
    icon.classList.remove('fa-chevron-right');
    icon.classList.add('fa-chevron-down');
  } else {
    details.style.display = 'none';
    icon.classList.remove('fa-chevron-down');
    icon.classList.add('fa-chevron-right');
  }
}

async function addInitiative(clientId) {
  const name = prompt('施策名を入力してください:');
  if (!name) return;
  const dod = prompt('完了条件 (DoD) を入力してください:');
  if (!dod) return;
  
  try {
    await axios.post('/api/initiatives', {
      client_id: clientId,
      meeting_id: meeting.id,
      name,
      dod,
      created_by: meetingUser.id
    });
    refreshMeeting();
  } catch (err) {
    console.error(err);
    alert('追加に失敗しました');
  }
}

async function addProposalSeed(clientId) {
  const memo = prompt('気配メモを入力してください:');
  if (!memo) return;
  
  try {
    await axios.post('/api/proposal-seeds', {
      client_id: clientId,
      meeting_id: meeting.id,
      memo,
      created_by: meetingUser.id
    });
    refreshMeeting();
  } catch (err) {
    console.error(err);
    alert('追加に失敗しました');
  }
}

async function updateSeedNextAction(seedId, nextAction) {
  try {
    await axios.patch(`/api/proposal-seeds/${seedId}`, { next_action: nextAction || null });
    refreshMeeting();
  } catch (err) {
    console.error(err);
  }
}

async function markSeedDormant(seedId) {
  if (!confirm('このタネを休眠へ移動しますか？')) return;
  try {
    await axios.patch(`/api/proposal-seeds/${seedId}`, { is_dormant: 1 });
    refreshMeeting();
  } catch (err) {
    console.error(err);
  }
}

// Initialize
initMeetingRoom();
