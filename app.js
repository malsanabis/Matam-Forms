// ══════════════════════════════════════════════════════════════
//  مأتم السنابس — app.js (Firebase Firestore version)
//  Data layer: Firestore  |  UI layer: unchanged
// ══════════════════════════════════════════════════════════════

// ── DEFAULT STRUCTURE (used only on very first run) ──
const DEFAULT_SECTIONS = [
  {id:'sec-1',name:'مدير المأتم',icon:'🏛',depts:[{id:'dept-1a',name:'مديرية المأتم',committees:[{id:'c-01',name:'الصيانة',icon:'🔧'},{id:'c-02',name:'الخدمات',icon:'🛎'},{id:'c-03',name:'الترتيب الداخلي (اللوجستية)',icon:'📦'},{id:'c-04',name:'الديكور',icon:'🎨'}]}]},
  {id:'sec-2',name:'نائب الرئيس',icon:'👤',depts:[{id:'dept-2a',name:'تنمية الموارد البشرية',committees:[{id:'c-05',name:'المواهب والسواد',icon:'⭐'},{id:'c-06',name:'التدريب والتطوير',icon:'📚'},{id:'c-07',name:'الجودة',icon:'✅'}]}]},
  {id:'sec-3',name:'منسق اللجان الداعمة',icon:'🤝',depts:[{id:'dept-3a',name:'العلاقات العامة والإعلام',committees:[{id:'c-08',name:'العلاقات العامة',icon:'🤝'},{id:'c-09',name:'الإعلام',icon:'📡'}]},{id:'dept-3b',name:'الفنية',committees:[{id:'c-10',name:'الصوتيات',icon:'🎙'},{id:'c-11',name:'البث',icon:'📺'},{id:'c-12',name:'الإنتاج الفني',icon:'🎬'}]}]},
  {id:'sec-4',name:'منسق اللجان الفاعلة',icon:'⚡',depts:[{id:'dept-4a',name:'الثقافية',committees:[{id:'c-13',name:'الثقافة',icon:'📖'},{id:'c-14',name:'الخطباء',icon:'🎤'},{id:'c-15',name:'التنسيقية',icon:'📋'}]},{id:'dept-4b',name:'الموكب',committees:[{id:'c-16',name:'تنظيم الجدول',icon:'📅'},{id:'c-17',name:'مراجعة القصائد',icon:'📜'}]}]}
];

// ── IN-MEMORY DB (synced from Firestore in real-time) ──
let DB = {
  sections: JSON.parse(JSON.stringify(DEFAULT_SECTIONS)),
  users: {},
  submissions: []
};

let _fdb       = null;   // Firestore instance
let _fbReady   = false;  // true once first snapshot arrives
let _detailSub = null;   // currently open submission in detail modal

// ══════════════════════════════════════════════════════════════
//  FIREBASE INIT + LISTENERS
// ══════════════════════════════════════════════════════════════
window.addEventListener('load', initFirebase);

async function initFirebase() {
  try {
    firebase.initializeApp(firebaseConfig);
    _fdb = firebase.firestore();

    // ── Listener 1: config (sections + users) ──
    _fdb.collection('config').doc('main').onSnapshot(
      doc => {
        if (doc.exists) {
          const data = doc.data();
          if (data.sections && data.sections.length) DB.sections = data.sections;
          if (data.users) DB.users = data.users;
        } else {
          // Very first run — write defaults to Firestore
          saveConfig();
        }
        if (!_fbReady) { _fbReady = true; hideLoader(); }
        refreshLists();
      },
      err => { console.error('Config listener:', err); showFbError(); }
    );

    // ── Listener 2: submissions (real-time across all devices) ──
    _fdb.collection('submissions').onSnapshot(
      snapshot => {
        DB.submissions = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
        refreshLists();
        // Refresh detail modal if it's open
        if (_detailSub) {
          const fresh = DB.submissions.find(s => s.id === _detailSub.id);
          if (fresh) _detailSub = fresh;
        }
      },
      err => { console.error('Submissions listener:', err); }
    );

  } catch (e) {
    console.error('Firebase init error:', e);
    showFbError();
  }
}

// ── SAVE FUNCTIONS ──
function saveConfig() {
  if (!_fdb) return;
  _fdb.collection('config').doc('main').set({
    sections: DB.sections,
    users: DB.users
  }).catch(e => { console.error('saveConfig:', e); notify('⚠️ خطأ في حفظ الإعدادات'); });
}

// saveDB = save config (sections + users)
function saveDB() { saveConfig(); }

// saveSubmission = save/update a single submission document
function saveSubmission(sub) {
  if (!_fdb) { notify('⚠️ غير متصل بقاعدة البيانات'); return; }
  _fdb.collection('submissions').doc(sub.id).set(sub)
    .catch(e => { console.error('saveSubmission:', e); notify('⚠️ خطأ في الحفظ'); });
}

// ── LOADER ──
function hideLoader() {
  const el = document.getElementById('loading-overlay');
  if (el) el.style.display = 'none';
}
function showFbError() {
  hideLoader();
  const el = document.getElementById('fb-error');
  if (el) el.style.display = 'flex';
}

// ── REFRESH ACTIVE VIEW (called by Firestore listeners) ──
function refreshLists() {
  const screen = document.querySelector('.screen.active')?.id;
  if (!screen) return;

  if (screen === 'screen-admin') {
    const panel = document.querySelector('.panel.active')?.id;
    if (panel === 'p-overview')   renderOverview();
    if (panel === 'p-results')    renderResults();
    if (panel === 'p-analytics')  renderAnalytics();
    if (panel === 'p-users')      renderUsersTable();
  }

  if (screen === 'screen-user' && window._cu) {
    if (window._cu.role === 'manager') {
      // Only refresh the review tab (don't disrupt the fill form)
      const reviewTab = document.getElementById('mgr-review-tab');
      if (reviewTab && reviewTab.style.display !== 'none') {
        renderManagerView();
      }
    } else {
      // Head user — only refresh if not in middle of filling form
      const formVisible = document.getElementById('form-section')?.style.display === 'block';
      if (!formVisible) renderHeadView();
    }
  }
}

// ══════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════
const $ = id => document.getElementById(id);
function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); $(id).classList.add('active'); }
function notify(msg, dur = 3000) { const n = $('notif'); n.textContent = msg; n.classList.add('show'); setTimeout(() => n.classList.remove('show'), dur); }

function showPanel(id, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-btn').forEach(b => b.classList.remove('active'));
  $(id).classList.add('active'); btn.classList.add('active');
  if (id === 'p-overview')   renderOverview();
  if (id === 'p-results')    { populateResultFilters(); renderResults(); }
  if (id === 'p-analytics')  renderAnalytics();
  if (id === 'p-users')      { renderUsersTable(); populateUserFormSelects(); }
  if (id === 'p-structure')  renderStructure();
}

function findSection(id)    { return DB.sections.find(s => s.id === id); }
function findCommittee(id)  { for (const s of DB.sections) for (const d of s.depts) for (const c of d.committees) if (c.id === id) return c; return null; }
function getCommSection(cid){ for (const s of DB.sections) for (const d of s.depts) for (const c of d.committees) if (c.id === cid) return s; return null; }
function getCommDept(cid)   { for (const s of DB.sections) for (const d of s.depts) for (const c of d.committees) if (c.id === cid) return d; return null; }
function allCommittees()    { return DB.sections.flatMap(s => s.depts.flatMap(d => d.committees)); }
function approvedSubs()     { return DB.submissions.filter(s => s.status === 'approved' && !s.archived); }

// ══════════════════════════════════════
//  ARABIC NUMBER PREVENTION
// ══════════════════════════════════════
function handleNidInput(input) {
  const arabic = /[\u0660-\u0669\u06F0-\u06F9]/g;
  const orig = input.value;
  const cleaned = orig.replace(arabic, '').replace(/[^0-9]/g, '');
  const warn = $(input.id + '-warn');
  if (cleaned !== orig) {
    input.value = cleaned;
    if (warn) { warn.style.display = 'block'; setTimeout(() => { warn.style.display = 'none'; }, 3500); }
  }
  if (input.id === 'nid') {
    $('admin-extra').style.display = cleaned === '101010101' ? 'block' : 'none';
    $('err').style.display = 'none';
  }
}

// ══════════════════════════════════════
//  LOGIN
// ══════════════════════════════════════
function doLogin() {
  const nid = $('nid').value.trim();
  const err = $('err'); err.style.display = 'none';
  if (!nid) { err.textContent = 'الرجاء إدخال الرقم الوطني'; err.style.display = 'block'; return; }
  if (/[\u0660-\u0669\u06F0-\u06F9]/.test(nid)) { err.textContent = 'الأرقام العربية غير مقبولة'; err.style.display = 'block'; return; }

  if (nid === '101010101') {
    if ($('a-user').value.trim() === 'admin' && $('a-pass').value.trim() === 'admin') {
      showScreen('screen-admin'); renderOverview(); return;
    }
    err.textContent = 'اسم المستخدم أو كلمة المرور خاطئة'; err.style.display = 'block'; return;
  }

  const user = DB.users[nid];
  if (!user) { err.textContent = 'عذراً، أنت غير مسجل في النظام'; err.style.display = 'block'; return; }

  window._cu = { nid, ...user };
  $('u-badge').textContent = user.name;
  const rb = $('u-role-badge');
  rb.textContent = user.role === 'manager' ? 'مسؤول قسم' : 'رئيس لجنة';
  rb.style.display = 'block';
  showScreen('screen-user');

  if (user.role === 'manager') {
    $('head-view').style.display = 'none';
    $('manager-view').style.display = 'block';
    renderManagerView();
  } else {
    $('head-view').style.display = 'block';
    $('manager-view').style.display = 'none';
    renderHeadView();
  }
}

function doLogout() {
  window._cu = null; window._sc = null; window._editingSubId = null;
  $('nid').value = ''; $('a-user').value = ''; $('a-pass').value = '';
  $('admin-extra').style.display = 'none';
  $('form-section').style.display = 'none';
  $('rejected-alert').style.display = 'none';
  showScreen('screen-login');
}

// ══════════════════════════════════════
//  HEAD VIEW
// ══════════════════════════════════════
function renderHeadView() {
  const user = window._cu;
  const comm = findCommittee(user.committeeId);
  if (!comm) return;
  $('u-title').textContent = 'استبيانك';

  const rejected = DB.submissions.find(s => s.userId === user.nid && s.status === 'rejected');
  if (rejected) {
    $('rejected-alert').style.display = 'flex';
    $('rejected-comment').textContent = rejected.managerComment || 'لم يُذكر سبب';
    window._rejectedSub = rejected;
  } else {
    $('rejected-alert').style.display = 'none';
    window._rejectedSub = null;
  }

  const existing = DB.submissions.find(s => s.userId === user.nid && (s.status === 'pending' || s.status === 'approved'));
  const grid = $('comm-grid');

  if (existing) {
    const stLabel = existing.status === 'pending' ? '⏳ بانتظار الموافقة' : '✅ تم اعتماده';
    const stClass = existing.status === 'pending' ? 'st-pending' : 'st-approved';
    grid.innerHTML = `<div class="comm-card sel" style="cursor:default">
      <div class="cc-icon">${comm.icon}</div>
      <div class="cc-name">${comm.name}</div>
      <div style="margin-top:.6rem"><span class="status-badge ${stClass}">${stLabel}</span></div>
    </div>`;
    $('form-section').style.display = 'none';
  } else {
    grid.innerHTML = `<div class="comm-card" id="cc-${comm.id}" onclick="selectComm('${comm.id}')">
      <div class="cc-icon">${comm.icon}</div>
      <div class="cc-name">${comm.name}</div>
      <div class="cc-parent">${getCommDept(comm.id)?.name || ''}</div>
    </div>`;
    selectComm(comm.id);
  }
}

function loadRejectedForEdit() {
  const sub = window._rejectedSub; if (!sub) return;
  window._editingSubId = sub.id;
  sub.status = 'draft';
  saveSubmission(sub); // ← Firestore
  const comm = findCommittee(sub.committeeId); if (!comm) return;
  selectComm(sub.committeeId, false);
  fillBullets('b-achievements', sub.achievements || []);
  fillBullets('b-obstacles', sub.obstacles || []);
  fillBullets('b-plans', sub.plans || []);
  $('f-notes').value = sub.notes || '';
  $('rejected-alert').style.display = 'none';
}

function fillBullets(wid, arr) {
  const wrap = $(wid); wrap.innerHTML = '';
  const items = arr.length ? arr : [''];
  items.forEach(v => addBulletRow(wid, v));
}

// ══════════════════════════════════════
//  MANAGER VIEW
// ══════════════════════════════════════
function renderManagerView() {
  const user = window._cu;
  const sec = findSection(user.sectionId);
  if (!sec) { $('mgr-title').textContent = 'لا يوجد قسم مرتبط'; return; }
  $('mgr-title').textContent = sec.name;

  const commIds = sec.depts.flatMap(d => d.committees.map(c => c.id));
  const pending = DB.submissions.filter(s => s.status === 'pending' && commIds.includes(s.committeeId));

  const pb = $('u-pending-badge');
  if (pending.length) { pb.textContent = `${pending.length} بانتظار المراجعة`; pb.style.display = 'inline-flex'; }
  else { pb.style.display = 'none'; }

  $('mgr-sub').textContent = `${pending.length} استبيان بانتظار موافقتك`;
  const list = $('review-list');

  if (!pending.length) {
    list.innerHTML = `<div class="review-empty"><div class="rei">✅</div><p>لا توجد استبيانات بانتظار المراجعة</p></div>`; return;
  }

  const bl = arr => arr && arr.length ? arr.map(b => `• ${b}`).join('\n') : '—';
  list.innerHTML = pending.map(s => `
    <div class="review-card">
      <div class="review-card-head">
        <div>
          <div class="review-card-title">${s.commName}</div>
          <div class="review-card-meta">${s.userName} · <span class="id-tag">${s.userId}</span> · ${s.date}</div>
        </div>
        <span class="status-badge st-pending">⏳ بانتظار الموافقة</span>
      </div>
      <div class="review-card-body">
        <div class="ans-q">الإنجازات</div><div class="ans-v">${bl(s.achievements)}</div>
        <div class="ans-q">المعوقات</div><div class="ans-v ${!s.obstacles?.length ? 'ev' : ''}">${bl(s.obstacles)}</div>
        <div class="ans-q">المخططات القادمة</div><div class="ans-v">${bl(s.plans)}</div>
        ${s.notes ? `<div class="ans-q">ملاحظات</div><div class="ans-v">${s.notes}</div>` : ''}
      </div>
      <div class="review-actions">
        <button class="btn-reject" onclick="openRejectFromManager('${s.id}')">❌ رفض</button>
        <button class="btn-approve" onclick="approveSubmission('${s.id}')">✅ قبول</button>
      </div>
    </div>`).join('');
}

function approveSubmission(sid) {
  const s = DB.submissions.find(x => x.id === sid); if (!s) return;
  s.status = 'approved';
  saveSubmission(s); // ← Firestore
  notify('✅ تم قبول الاستبيان وإرساله للإدارة');
}

function openRejectFromManager(sid) {
  $('reject-sub-id').value = sid;
  $('reject-comment').value = '';
  $('reject-modal').classList.add('show');
}

function confirmReject() {
  const sid = $('reject-sub-id').value;
  const comment = $('reject-comment').value.trim();
  if (!comment) { notify('⚠️ اكتب سبب الرفض'); return; }
  const s = DB.submissions.find(x => x.id === sid); if (!s) return;
  s.status = 'rejected'; s.managerComment = comment;
  saveSubmission(s); // ← Firestore
  closeRejectModal();
  notify('تم رفض الاستبيان وإشعار المستخدم');
}

function closeRejectModal() { $('reject-modal').classList.remove('show'); }

// ══════════════════════════════════════
//  COMMITTEES & BULLETS
// ══════════════════════════════════════
function selectComm(cid, resetForm = true) {
  window._sc = cid;
  document.querySelectorAll('.comm-card').forEach(c => c.classList.remove('sel'));
  $('cc-' + cid)?.classList.add('sel');
  const comm = findCommittee(cid);
  $('fh-icon').textContent = comm.icon;
  $('fh-title').textContent = comm.name;
  $('f-comm-name').textContent = comm.name;
  if (resetForm) {
    initBullets('b-achievements'); initBullets('b-obstacles'); initBullets('b-plans');
    $('f-notes').value = '';
  }
  const fs = $('form-section'); fs.style.display = 'block';
  setTimeout(() => fs.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
}

function initBullets(wid) { const w = $(wid); w.innerHTML = ''; addBulletRow(wid); }

function addBulletRow(wid, value = '') {
  const wrap = $(wid);
  const row = document.createElement('div'); row.className = 'bullet-row';
  row.innerHTML = `<span class="bullet-dot">•</span>
    <textarea class="bullet-inp" rows="1" placeholder="اكتب هنا...">${value}</textarea>
    <button class="btn-rm" onclick="removeBullet(this,'${wid}')">✕</button>`;
  const ta = row.querySelector('textarea');
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault(); if (ta.value.trim()) addBulletRow(wid);
      const rows = wrap.querySelectorAll('.bullet-inp'); rows[rows.length - 1].focus();
    }
  });
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; });
  wrap.appendChild(row);
  if (value === '') setTimeout(() => ta.focus(), 30);
  else setTimeout(() => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }, 10);
}

function removeBullet(btn, wid) {
  const wrap = $(wid);
  if (wrap.querySelectorAll('.bullet-row').length <= 1) { btn.closest('.bullet-row').querySelector('textarea').value = ''; return; }
  btn.closest('.bullet-row').remove();
}
function getBullets(wid) { return [...$(wid).querySelectorAll('.bullet-inp')].map(t => t.value.trim()).filter(Boolean); }

// ══════════════════════════════════════
//  SUBMIT (HEAD USER)
// ══════════════════════════════════════
function submitForm() {
  const cid = window._sc; if (!cid) return;
  const achievements = getBullets('b-achievements');
  const obstacles    = getBullets('b-obstacles');
  const plans        = getBullets('b-plans');
  const notes        = $('f-notes').value.trim();
  if (!achievements.length) { notify('⚠️ الإنجازات إجبارية'); return; }
  if (!plans.length)         { notify('⚠️ المخططات القادمة إجبارية'); return; }

  const user = window._cu;
  const comm = findCommittee(cid);
  const dept = getCommDept(cid);
  const sec  = getCommSection(cid);

  // Editing a rejected/draft submission
  if (window._editingSubId) {
    const existing = DB.submissions.find(s => s.id === window._editingSubId);
    if (existing) {
      existing.achievements = achievements; existing.obstacles = obstacles;
      existing.plans = plans; existing.notes = notes;
      existing.status = 'pending'; existing.managerComment = '';
      existing.date = new Date().toISOString().split('T')[0];
      existing.checklist = null;
      saveSubmission(existing); // ← Firestore
      window._editingSubId = null;
      $('success-overlay').classList.add('show'); return;
    }
  }

  // New submission
  const newSub = {
    id: 'sub-' + Date.now(),
    userId: user.nid, userName: user.name,
    sectionId: sec?.id,  sectionName: sec?.name,
    deptId:    dept?.id, deptName:    dept?.name,
    committeeId: cid, commName: comm?.name,
    date: new Date().toISOString().split('T')[0],
    achievements, obstacles, plans, notes,
    status: 'pending', managerComment: '', archived: false, checklist: null
  };
  saveSubmission(newSub); // ← Firestore (listener will update DB.submissions)
  $('success-overlay').classList.add('show');
}

function closeSuccess() {
  $('success-overlay').classList.remove('show');
  $('form-section').style.display = 'none';
  window._sc = null; window._editingSubId = null;
  initBullets('b-achievements'); initBullets('b-obstacles'); initBullets('b-plans');
  renderHeadView();
}

// ══════════════════════════════════════
//  MANAGER TABS & FILL FORM
// ══════════════════════════════════════
function switchMgrTab(tab) {
  document.querySelectorAll('.mgr-tab').forEach(t => t.classList.remove('active'));
  $('tab-' + tab).classList.add('active');
  $('mgr-review-tab').style.display = tab === 'review' ? 'block' : 'none';
  $('mgr-fill-tab').style.display   = tab === 'fill'   ? 'block' : 'none';
  if (tab === 'fill') renderMgrFillGrid();
}

function renderMgrFillGrid() {
  const user = window._cu;
  const sec = findSection(user.sectionId);
  if (!sec) { $('mgr-comm-grid').innerHTML = '<p style="color:var(--muted)">لا يوجد قسم مرتبط</p>'; return; }
  const comms = sec.depts.flatMap(d => d.committees);
  $('mgr-comm-grid').innerHTML = comms.map(c => {
    const dept = getCommDept(c.id);
    const existing = DB.submissions.find(s => s.committeeId === c.id && s.userId === user.nid && (s.status === 'pending' || s.status === 'approved'));
    const stBadge = existing ? `<div style="margin-top:.5rem"><span class="status-badge ${existing.status === 'approved' ? 'st-approved' : 'st-pending'}">${existing.status === 'approved' ? 'معتمد' : 'بانتظار'}</span></div>` : '';
    return `<div class="comm-card ${existing ? 'sel' : ''}" id="mgr-cc-${c.id}" onclick="${existing ? '' : `selectMgrComm('${c.id}')`}" style="${existing ? 'cursor:default' : ''}">
      <div class="cc-icon">${c.icon}</div>
      <div class="cc-name">${c.name}</div>
      <div class="cc-parent">${dept?.name || ''}</div>
      ${stBadge}
    </div>`;
  }).join('');
  $('mgr-form-section').style.display = 'none';
}

function selectMgrComm(cid) {
  window._mgrSc = cid;
  document.querySelectorAll('#mgr-comm-grid .comm-card').forEach(c => c.classList.remove('sel'));
  $('mgr-cc-' + cid)?.classList.add('sel');
  const comm = findCommittee(cid);
  $('mgr-fh-icon').textContent = comm.icon;
  $('mgr-fh-title').textContent = comm.name;
  $('mgr-f-comm-name').textContent = comm.name;
  initBullets('mgr-b-achievements'); initBullets('mgr-b-obstacles'); initBullets('mgr-b-plans');
  $('mgr-f-notes').value = '';
  const fs = $('mgr-form-section'); fs.style.display = 'block';
  setTimeout(() => fs.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
}

function submitManagerForm() {
  const cid = window._mgrSc; if (!cid) return;
  const achievements = getBullets('mgr-b-achievements');
  const obstacles    = getBullets('mgr-b-obstacles');
  const plans        = getBullets('mgr-b-plans');
  const notes        = $('mgr-f-notes').value.trim();
  if (!achievements.length) { notify('⚠️ الإنجازات إجبارية'); return; }
  if (!plans.length)         { notify('⚠️ المخططات القادمة إجبارية'); return; }

  const user = window._cu;
  const comm = findCommittee(cid);
  const dept = getCommDept(cid);
  const sec  = getCommSection(cid);

  const newSub = {
    id: 'sub-' + Date.now(),
    userId: user.nid, userName: user.name,
    sectionId: sec?.id,  sectionName: sec?.name,
    deptId:    dept?.id, deptName:    dept?.name,
    committeeId: cid, commName: comm?.name,
    date: new Date().toISOString().split('T')[0],
    achievements, obstacles, plans, notes,
    status: 'approved', managerComment: '', archived: false, checklist: null
  };
  saveSubmission(newSub); // ← Firestore
  $('mgr-form-section').style.display = 'none';
  window._mgrSc = null;
  renderMgrFillGrid();
  notify('✅ تم إرسال الاستبيان واعتماده مباشرة');
}

// ══════════════════════════════════════
//  ADMIN: OVERVIEW
// ══════════════════════════════════════
function renderOverview() {
  const total = DB.sections.reduce((a, s) => a + s.depts.reduce((b, d) => b + d.committees.length, 0), 0);
  const approved = approvedSubs();
  const pending  = DB.submissions.filter(s => s.status === 'pending').length;
  $('a-stats').innerHTML = `
    <div class="stat"><div class="stat-n">${approved.length}</div><div class="stat-l">استبيانات معتمدة</div></div>
    <div class="stat"><div class="stat-n">${pending}</div><div class="stat-l">بانتظار الموافقة</div></div>
    <div class="stat"><div class="stat-n">${Object.keys(DB.users).length}</div><div class="stat-l">المستخدمون</div></div>
    <div class="stat"><div class="stat-n">${total}</div><div class="stat-l">اللجان</div></div>
  `;
  const recent = [...approved].reverse().slice(0, 6);
  $('a-recent').innerHTML = recent.length
    ? `<div class="tbl-wrap"><table>
        <thead><tr><th>الاسم</th><th>اللجنة</th><th>القسم</th><th>التاريخ</th></tr></thead>
        <tbody>${recent.map(s => `<tr><td>${s.userName}</td><td>${s.commName}</td>
          <td style="color:var(--muted);font-size:.78rem">${s.sectionName || ''}</td>
          <td style="color:var(--muted);font-size:.78rem">${s.date}</td></tr>`).join('')}</tbody>
      </table></div>`
    : `<div class="empty-s"><div class="ei">📭</div><p>لا توجد استبيانات معتمدة بعد</p></div>`;
}

// ══════════════════════════════════════
//  ADMIN: RESULTS
// ══════════════════════════════════════
function populateResultFilters() {
  const rs = $('r-section');
  rs.innerHTML = '<option value="">كل الأقسام</option>' + DB.sections.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  populateResultComms();
}
function populateResultComms() {
  const sid = $('r-section').value;
  let comms = sid ? (findSection(sid)?.depts.flatMap(d => d.committees) || []) : allCommittees();
  $('r-comm').innerHTML = '<option value="">كل اللجان</option>' + comms.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}
function onResultSectionChange() { populateResultComms(); renderResults(); }

function renderResults() {
  const search = ($('r-search')?.value || '').toLowerCase();
  const sid    = $('r-section').value;
  const cid    = $('r-comm').value;
  const statusFilter = $('r-status').value;

  let subs = DB.submissions.filter(s => {
    if (s.archived && statusFilter !== '') return false;
    const ms   = !search || s.userName.toLowerCase().includes(search) || s.userId.includes(search);
    const msec = !sid || s.sectionId === sid;
    const mc   = !cid || s.committeeId === cid;
    const mst  = !statusFilter || s.status === statusFilter;
    return ms && msec && mc && mst;
  });

  const c = $('r-table');
  if (!subs.length) { c.innerHTML = '<div class="empty-s"><div class="ei">📭</div><p>لا توجد نتائج</p></div>'; return; }
  c.innerHTML = `<div class="tbl-wrap"><table>
    <thead><tr><th>الرقم الوطني</th><th>الاسم</th><th>اللجنة</th><th>القسم</th><th>الحالة</th><th>التاريخ</th><th></th></tr></thead>
    <tbody>${subs.map(s => {
      const stClass = s.status === 'approved' ? 'st-approved' : s.status === 'pending' ? 'st-pending' : 'st-rejected';
      const stLabel = s.status === 'approved' ? 'معتمد' : s.status === 'pending' ? 'بانتظار' : 'مرفوض';
      const pct = calcProgress(s);
      return `<tr>
        <td><span class="id-tag">${s.userId}</span></td>
        <td>${s.userName}</td><td>${s.commName}</td>
        <td style="color:var(--muted);font-size:.78rem">${s.sectionName || ''}</td>
        <td><span class="status-badge ${stClass}">${stLabel}</span></td>
        <td style="color:var(--muted);font-size:.78rem">${s.date}</td>
        <td style="display:flex;gap:.3rem;align-items:center">
          ${pct !== null ? `<span style="font-size:.72rem;color:var(--green);font-weight:700">${pct}%</span>` : ''}
          <button class="btn-sm" onclick="showDetail('${s.id}')">عرض</button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

// ══════════════════════════════════════
//  DETAIL MODAL + CHECKLIST + PRINT
// ══════════════════════════════════════
function calcProgress(s) {
  if (!s.checklist) return null;
  const all = [...(s.checklist.ach || []), ...(s.checklist.obs || []), ...(s.checklist.pln || [])];
  if (!all.length) return null;
  return Math.round(all.filter(Boolean).length / all.length * 100);
}

function showDetail(sid) {
  const s = DB.submissions.find(x => x.id === sid); if (!s) return;
  _detailSub = s;
  $('m-title').textContent = `${s.userName} — ${s.commName}`;

  if (!s.checklist) {
    s.checklist = {
      ach: (s.achievements || []).map(() => false),
      obs: (s.obstacles    || []).map(() => false),
      pln: (s.plans        || []).map(() => false)
    };
  }

  const pct = calcProgress(s);
  const totalItems = s.checklist.ach.length + s.checklist.obs.length + s.checklist.pln.length;
  const doneItems  = [...s.checklist.ach, ...s.checklist.obs, ...s.checklist.pln].filter(Boolean).length;

  $('m-body').innerHTML = `
    <div style="margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid var(--bg2);display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">
      <span class="id-tag">${s.userId}</span>
      <span style="color:var(--muted);font-size:.8rem">${s.date}</span>
      <span style="color:var(--muted2);font-size:.78rem">${s.sectionName || ''} ← ${s.deptName || ''} ← ${s.commName}</span>
    </div>
    ${totalItems > 0 ? `
    <div class="progress-wrap" style="margin-bottom:1.2rem">
      <div class="progress-label"><span>نسبة الإنجاز المُوثَّق</span><span style="font-weight:700;color:var(--green)">${pct ?? 0}% (${doneItems}/${totalItems})</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct ?? 0}%"></div></div>
    </div>` : ''}
    ${renderCheckSection('الإنجازات',      'ach', s.achievements, s.checklist.ach, s.id)}
    ${renderCheckSection('المعوقات',        'obs', s.obstacles,    s.checklist.obs, s.id)}
    ${renderCheckSection('المخططات القادمة','pln', s.plans,        s.checklist.pln, s.id)}
    <div class="ans-block">
      <div class="ans-q">ملاحظات</div>
      <div class="ans-v ${!s.notes ? 'ev' : ''}">${s.notes || '—'}</div>
    </div>
    ${s.managerComment ? `<div class="ans-block"><div class="ans-q">تعليق المسؤول</div><div class="ans-v" style="color:var(--orange)">${s.managerComment}</div></div>` : ''}
  `;
  $('detail-modal').classList.add('show');
}

function renderCheckSection(title, key, items, checks, sid) {
  if (!items || !items.length) return `<div class="ans-block"><div class="ans-q">${title}</div><div class="ans-v ev">—</div></div>`;
  return `<div class="ans-block">
    <div class="ans-q">${title}</div>
    <div style="background:var(--card2);border:1px solid var(--border);border-radius:3px;padding:.5rem .7rem">
      ${items.map((item, i) => `
        <div class="checklist-item">
          <input type="checkbox" id="chk-${key}-${i}" ${checks[i] ? 'checked' : ''} onchange="tickItem('${sid}','${key}',${i},this.checked)">
          <label for="chk-${key}-${i}" class="${checks[i] ? 'done' : ''}">${item}</label>
        </div>`).join('')}
    </div>
  </div>`;
}

function tickItem(sid, key, index, val) {
  const s = DB.submissions.find(x => x.id === sid); if (!s || !s.checklist) return;
  s.checklist[key][index] = val;
  saveSubmission(s); // ← Firestore
  const pct = calcProgress(s);
  const totalItems = s.checklist.ach.length + s.checklist.obs.length + s.checklist.pln.length;
  const doneItems  = [...s.checklist.ach, ...s.checklist.obs, ...s.checklist.pln].filter(Boolean).length;
  const pw = document.querySelector('.progress-fill');
  const pl = document.querySelector('.progress-label span:last-child');
  if (pw) pw.style.width = (pct ?? 0) + '%';
  if (pl) pl.textContent = `${pct ?? 0}% (${doneItems}/${totalItems})`;
  document.querySelectorAll('.checklist-item label').forEach(lbl => {
    const chk = lbl.previousElementSibling;
    if (chk) lbl.className = chk.checked ? 'done' : '';
  });
}

function closeModal() { $('detail-modal').classList.remove('show'); renderResults(); }

function printDetail() {
  const s = _detailSub; if (!s) return;
  const bl  = arr => arr && arr.length ? arr.map(b => `<div style="margin-bottom:.4rem">• ${b}</div>`).join('') : '<em>—</em>';
  const pct = calcProgress(s) ?? 0;
  const win = window.open('', '_blank', 'width=800,height=900');
  win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
    <title>استبيان - ${s.commName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Tajawal:wght@700;900&display=swap" rel="stylesheet">
    <style>body{font-family:'Cairo',sans-serif;direction:rtl;padding:2rem;max-width:700px;margin:0 auto;color:#1a1a1a;}
    h1{font-family:'Tajawal';color:#1a5c35;font-size:1.4rem;margin-bottom:.3rem;}
    .meta{font-size:.8rem;color:#7a7060;margin-bottom:1.5rem;border-bottom:2px solid #b8902a;padding-bottom:.8rem;}
    .section{margin-bottom:1.2rem;}.sec-title{font-size:.75rem;font-weight:700;color:#1a5c35;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.4rem;}
    .sec-body{background:#f8f4ee;border:1px solid #d4c9b0;border-radius:3px;padding:.7rem .9rem;font-size:.88rem;line-height:1.7;}
    .prog-bar{height:10px;background:#e8e2d8;border-radius:5px;overflow:hidden;margin-bottom:1.2rem;}
    .prog-fill{height:100%;background:#1a5c35;border-radius:5px;}
    @media print{body{padding:1rem;}}</style></head>
    <body>
    <h1>مأتم السنابس — استبيان داخلي</h1>
    <div class="meta"><strong>${s.commName}</strong> · ${s.sectionName || ''} · ${s.deptName || ''}<br>
      ${s.userName} · ${s.userId} · ${s.date}</div>
    <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:.3rem"><span>نسبة الإنجاز</span><strong style="color:#1a5c35">${pct}%</strong></div>
    <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>
    <div class="section"><div class="sec-title">الإنجازات</div><div class="sec-body">${bl(s.achievements)}</div></div>
    <div class="section"><div class="sec-title">المعوقات</div><div class="sec-body">${s.obstacles?.length ? bl(s.obstacles) : '<em>—</em>'}</div></div>
    <div class="section"><div class="sec-title">المخططات القادمة</div><div class="sec-body">${bl(s.plans)}</div></div>
    <div class="section"><div class="sec-title">ملاحظات</div><div class="sec-body">${s.notes || '<em>—</em>'}</div></div>
    ${s.managerComment ? `<div class="section"><div class="sec-title">تعليق المسؤول</div><div class="sec-body" style="color:#c06010">${s.managerComment}</div></div>` : ''}
    <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`);
  win.document.close();
}

// ══════════════════════════════════════
//  STATUS DRILL-DOWN
// ══════════════════════════════════════
function showStatusDrill(statusKey, label) {
  const subs = DB.submissions.filter(s => s.status === statusKey);
  $('status-modal-title').textContent = `${label} (${subs.length})`;
  if (!subs.length) {
    $('status-modal-body').innerHTML = '<div class="empty-s"><div class="ei">📭</div><p>لا توجد استبيانات</p></div>';
  } else {
    const stClass = statusKey === 'approved' ? 'st-approved' : statusKey === 'pending' ? 'st-pending' : 'st-rejected';
    $('status-modal-body').innerHTML = subs.map(s => `
      <div style="background:var(--card2);border:1.5px solid var(--border);border-radius:4px;padding:.9rem 1rem;margin-bottom:.7rem">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.4rem;margin-bottom:.5rem">
          <div><span style="font-weight:700;font-size:.9rem">${s.userName}</span>
               <span class="id-tag" style="margin-right:.5rem">${s.userId}</span></div>
          <span class="status-badge ${stClass}">${label}</span>
        </div>
        <div style="font-size:.8rem;color:var(--muted);margin-bottom:.4rem">${s.commName} · ${s.sectionName || ''} · ${s.date}</div>
        ${statusKey === 'rejected' && s.managerComment ? `
          <div style="background:var(--red-bg);border:1px solid rgba(160,32,32,.25);border-radius:3px;padding:.5rem .7rem;font-size:.82rem;color:var(--red);margin-top:.4rem">
            <strong>سبب الرفض:</strong> ${s.managerComment}
          </div>` : ''}
        ${statusKey === 'pending' ? `<div style="font-size:.78rem;color:var(--orange);margin-top:.3rem">⏳ بانتظار موافقة مسؤول القسم</div>` : ''}
        <div style="margin-top:.6rem">
          <button class="btn-sm" onclick="$('status-modal').classList.remove('show');showDetail('${s.id}')">عرض التفاصيل</button>
        </div>
      </div>`).join('');
  }
  $('status-modal').classList.add('show');
}

// ══════════════════════════════════════
//  ZIP DOWNLOAD
// ══════════════════════════════════════
function generateReportHTML(s) {
  const bl  = arr => arr && arr.length ? arr.map(b => `<li>${b}</li>`).join('') : '<li><em>—</em></li>';
  const pct = calcProgress(s) ?? 0;
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
  <title>استبيان - ${s.commName} - ${s.userName}</title>
  <style>body{font-family:Arial,sans-serif;direction:rtl;padding:2rem;max-width:700px;margin:0 auto;}
  h1{color:#1a5c35;font-size:1.3rem;}h2{font-size:1rem;color:#1a5c35;margin:1rem 0 .4rem;}
  .meta{color:#7a7060;font-size:.85rem;border-bottom:2px solid #b8902a;padding-bottom:.6rem;margin-bottom:1rem;}
  ul{background:#f8f4ee;border:1px solid #d4c9b0;padding:.7rem 1rem .7rem 1.5rem;border-radius:3px;}
  li{margin-bottom:.3rem;font-size:.9rem;}</style></head><body>
  <h1>مأتم السنابس — استبيان داخلي</h1>
  <div class="meta">${s.commName} · ${s.sectionName || ''} · ${s.userName} (${s.userId}) · ${s.date} · إنجاز: ${pct}%</div>
  <h2>الإنجازات</h2><ul>${bl(s.achievements)}</ul>
  <h2>المعوقات</h2><ul>${bl(s.obstacles)}</ul>
  <h2>المخططات القادمة</h2><ul>${bl(s.plans)}</ul>
  <h2>ملاحظات</h2><p>${s.notes || '—'}</p>
  </body></html>`;
}

async function downloadAllZip(markArchived = false) {
  const subs = DB.submissions.filter(s => s.status === 'approved' && !s.archived);
  if (!subs.length) { notify('⚠️ لا توجد استبيانات معتمدة للتحميل'); return; }
  notify('⏳ جاري إنشاء ملف ZIP...');
  const zip = new JSZip();
  const folder = zip.folder('استبيانات_السنابس');
  subs.forEach(s => {
    const fname = `${s.commName}_${s.userId}_${s.date}.html`.replace(/[/\\?%*:|"<>]/g, '_');
    folder.file(fname, generateReportHTML(s));
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `استبيانات_السنابس_${new Date().toISOString().split('T')[0]}.zip`;
  a.click(); URL.revokeObjectURL(url);

  if (markArchived) {
    subs.forEach(s => { s.archived = true; saveSubmission(s); }); // ← Firestore per sub
    notify('✅ تم التحميل وإخفاء التقارير من الواجهة');
  } else {
    notify(`✅ تم تحميل ${subs.length} تقرير`);
  }
}

function downloadAndClear() {
  if (!confirm('سيتم تحميل جميع الاستبيانات المعتمدة كـ ZIP وإخفاؤها من الواجهة (تبقى في قاعدة البيانات).\n\nهل أنت متأكد؟')) return;
  downloadAllZip(true);
}

// ══════════════════════════════════════
//  ANALYTICS
// ══════════════════════════════════════
let _charts = [];
function destroyCharts() { _charts.forEach(c => { try { c.destroy(); } catch {} }); _charts = []; }

function renderAnalytics() {
  destroyCharts();
  const subs = approvedSubs();
  const container = $('analytics-content');
  if (!subs.length) { container.innerHTML = '<div class="empty-s"><div class="ei">📊</div><p>لا توجد بيانات كافية للتحليل</p></div>'; return; }

  const bySection = {}; const byComm = {}; const byDate = {};
  const byStatus = { approved: 0, pending: 0, rejected: 0 };
  DB.submissions.forEach(s => { byStatus[s.status] = (byStatus[s.status] || 0) + 1; });
  subs.forEach(s => {
    bySection[s.sectionName || 'غير محدد'] = (bySection[s.sectionName || 'غير محدد'] || 0) + 1;
    byComm[s.commName] = (byComm[s.commName] || 0) + 1;
    byDate[s.date]     = (byDate[s.date] || 0) + 1;
  });

  const withChecklist = subs.filter(s => s.checklist);
  const avgPct  = withChecklist.length ? Math.round(withChecklist.reduce((a, s) => a + calcProgress(s), 0) / withChecklist.length) : 0;
  const fullDone = withChecklist.filter(s => calcProgress(s) === 100).length;

  const avgAch = Math.round(subs.reduce((a, s) => a + (s.achievements || []).length, 0) / subs.length * 10) / 10;
  const avgObs = Math.round(subs.reduce((a, s) => a + (s.obstacles    || []).length, 0) / subs.length * 10) / 10;
  const avgPln = Math.round(subs.reduce((a, s) => a + (s.plans        || []).length, 0) / subs.length * 10) / 10;

  container.innerHTML = `
    <div class="stats-row" style="margin-bottom:1.5rem">
      <div class="stat"><div class="stat-n">${subs.length}</div><div class="stat-l">إجمالي المعتمدة</div></div>
      <div class="stat"><div class="stat-n">${DB.submissions.filter(s => s.status === 'pending').length}</div><div class="stat-l">بانتظار الموافقة</div></div>
      <div class="stat"><div class="stat-n">${avgPct}%</div><div class="stat-l">متوسط نسبة الإنجاز</div></div>
      <div class="stat"><div class="stat-n">${fullDone}</div><div class="stat-l">مكتملة 100%</div></div>
    </div>
    <div class="chart-grid">
      <div class="chart-card"><h4>📊 الاستبيانات حسب القسم الكبير</h4><canvas id="ch-section"></canvas></div>
      <div class="chart-card"><h4>🥧 حالة الاستبيانات <small style="font-size:.7rem;color:var(--muted)">(اضغط للتفاصيل)</small></h4><canvas id="ch-status"></canvas></div>
      <div class="chart-card"><h4>📋 الاستبيانات حسب اللجنة</h4><canvas id="ch-comm"></canvas></div>
      <div class="chart-card"><h4>📅 الاستبيانات حسب التاريخ</h4><canvas id="ch-date"></canvas></div>
      <div class="chart-card"><h4>📝 متوسط عدد النقاط لكل استبيان</h4><canvas id="ch-avg"></canvas></div>
      <div class="chart-card"><h4>✅ توزيع نسب الإنجاز</h4><canvas id="ch-progress"></canvas></div>
    </div>`;

  const COLORS = ['#1a5c35','#b8902a','#2d8a55','#d4aa3a','#226b40','#c06010','#4caf50','#ff9800'];

  function mkChart(id, type, labels, data, extras = {}) {
    const ctx = $(id)?.getContext('2d'); if (!ctx) return;
    const ch = new Chart(ctx, {
      type,
      data: { labels, datasets: [{ data, backgroundColor: COLORS, borderColor: type === 'line' ? '#1a5c35' : 'transparent', borderWidth: type === 'line' ? 2 : 0, fill: type === 'line', tension: .4 }] },
      options: { responsive: true, plugins: { legend: { display: type === 'pie' || type === 'doughnut' }, tooltip: { callbacks: { label: c => ` ${c.raw}` } } }, scales: type !== 'pie' && type !== 'doughnut' ? { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { font: { family: 'Cairo' } } } } : undefined, ...extras }
    });
    _charts.push(ch);
  }

  mkChart('ch-section', 'bar', Object.keys(bySection), Object.values(bySection));

  // Status chart — clickable!
  const statusLabels = ['معتمد', 'بانتظار', 'مرفوض'];
  const statusKeys   = ['approved', 'pending', 'rejected'];
  const ctxS = $('ch-status')?.getContext('2d');
  if (ctxS) {
    const chS = new Chart(ctxS, {
      type: 'doughnut',
      data: { labels: statusLabels, datasets: [{ data: [byStatus.approved, byStatus.pending, byStatus.rejected], backgroundColor: ['#1a5c35','#c06010','#a02020'], borderWidth: 0 }] },
      options: { responsive: true, plugins: { legend: { display: true }, tooltip: { callbacks: { label: c => ` ${c.raw} استبيان` } } },
        onClick: (evt, els) => { if (!els.length) return; showStatusDrill(statusKeys[els[0].index], statusLabels[els[0].index]); }
      }
    });
    _charts.push(chS);
  }

  const commEntries = Object.entries(byComm).sort((a, b) => b[1] - a[1]).slice(0, 8);
  mkChart('ch-comm', 'bar', commEntries.map(e => e[0]), commEntries.map(e => e[1]));
  const dateEntries = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]));
  mkChart('ch-date', 'line', dateEntries.map(e => e[0]), dateEntries.map(e => e[1]));
  mkChart('ch-avg', 'bar', ['الإنجازات', 'المعوقات', 'المخططات'], [avgAch, avgObs, avgPln]);

  const brackets = { '>75': 0, '50-75': 0, '25-50': 0, '<25': 0, 'بدون بيانات': 0 };
  subs.forEach(s => {
    const p = calcProgress(s);
    if (p === null) brackets['بدون بيانات']++;
    else if (p >= 75) brackets['>75']++;
    else if (p >= 50) brackets['50-75']++;
    else if (p >= 25) brackets['25-50']++;
    else brackets['<25']++;
  });
  mkChart('ch-progress', 'doughnut', Object.keys(brackets), Object.values(brackets));
}

// ══════════════════════════════════════
//  ADMIN: USERS
// ══════════════════════════════════════
function renderUsersTable() {
  const search = ($('us-search')?.value || '').toLowerCase();
  const users = Object.entries(DB.users).filter(([nid, u]) => !search || u.name.toLowerCase().includes(search) || nid.includes(search));
  const rl = r => r === 'manager' ? 'مسؤول قسم' : 'رئيس لجنة';
  const rc = r => r === 'manager' ? 'role-manager' : 'role-head';
  const sl = u => { if (u.role === 'manager') { const s = findSection(u.sectionId); return s?.name || '—'; } const c = findCommittee(u.committeeId); return c?.name || '—'; };
  const c = $('us-table');
  if (!users.length) { c.innerHTML = '<div class="empty-s"><div class="ei">👤</div><p>لا يوجد مستخدمون</p></div>'; return; }
  c.innerHTML = `<div class="tbl-wrap" style="margin-bottom:1.1rem"><table>
    <thead><tr><th>الرقم الوطني</th><th>الاسم</th><th>الدور</th><th>النطاق</th><th></th></tr></thead>
    <tbody>${users.map(([nid, u]) => `<tr>
      <td><span class="id-tag">${nid}</span></td><td>${u.name}</td>
      <td><span class="role-tag ${rc(u.role)}">${rl(u.role)}</span></td>
      <td style="color:var(--muted2);font-size:.81rem">${sl(u)}</td>
      <td><button class="btn-sm danger" onclick="deleteUser('${nid}')">حذف</button></td>
    </tr>`).join('')}</tbody></table></div>`;
}

function populateUserFormSelects() {
  $('nu-section').innerHTML = DB.sections.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  onNewUserRoleChange();
}
function onNewUserRoleChange() {
  const role = $('nu-role').value;
  $('nu-comm-row').style.display = role === 'head' ? 'grid' : 'none';
  if (role === 'head') onNewUserSectionChange();
}
function onNewUserSectionChange() {
  const sid = $('nu-section').value;
  const sec = findSection(sid);
  $('nu-comm').innerHTML = (sec ? sec.depts.flatMap(d => d.committees) : []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}
function addUser() {
  const name = $('nu-name').value.trim();
  const nid  = $('nu-nid').value.trim();
  const role = $('nu-role').value;
  if (!name) { notify('⚠️ أدخل الاسم'); return; }
  if (!nid)  { notify('⚠️ أدخل الرقم الوطني'); return; }
  if (/[\u0660-\u0669\u06F0-\u06F9]/.test(nid)) { notify('⚠️ الأرقام العربية غير مقبولة'); return; }
  if (nid === '101010101') { notify('⚠️ هذا الرقم محجوز'); return; }
  if (DB.users[nid]) { notify('⚠️ الرقم الوطني مسجل مسبقاً'); return; }
  if (role === 'manager') { DB.users[nid] = { name, role, sectionId: $('nu-section').value }; }
  else                   { DB.users[nid] = { name, role, committeeId: $('nu-comm').value }; }
  saveDB(); // ← saves config to Firestore
  $('nu-name').value = ''; $('nu-nid').value = '';
  renderUsersTable();
  notify('✅ تم إضافة المستخدم');
}
function deleteUser(nid) {
  if (!confirm(`حذف "${DB.users[nid]?.name}"؟`)) return;
  delete DB.users[nid];
  saveDB(); // ← saves config to Firestore
  renderUsersTable();
  notify('تم حذف المستخدم');
}

// ══════════════════════════════════════
//  ADMIN: STRUCTURE EDITOR
// ══════════════════════════════════════
function renderStructure() {
  $('struct-tree').innerHTML = DB.sections.map(sec => `
    <div class="tree-sec">
      <div class="tree-sec-head">
        <span>${sec.icon} ${sec.name}</span>
        <div style="display:flex;gap:.4rem">
          <button class="btn-sm" onclick="openEditSection('${sec.id}')" style="background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff">✏️</button>
          <button class="btn-sm danger" onclick="deleteSection('${sec.id}')" style="background:rgba(255,255,255,.08);border-color:rgba(255,100,100,.4);color:#ffaaaa">🗑</button>
        </div>
      </div>
      ${sec.depts.map(d => `
        <div class="tree-dept">
          <div class="tree-dept-name">
            <span>📂 ${d.name}</span>
            <div style="display:flex;gap:.3rem">
              <button class="btn-sm" onclick="openEditDept('${sec.id}','${d.id}')">✏️</button>
              <button class="btn-sm danger" onclick="deleteDept('${sec.id}','${d.id}')">🗑</button>
            </div>
          </div>
          ${d.committees.map(c => `
            <div class="tree-comm">
              <span>${c.icon} <span>${c.name}</span></span>
              <div style="display:flex;gap:.3rem">
                <button class="btn-sm" onclick="openEditComm('${sec.id}','${d.id}','${c.id}')">✏️</button>
                <button class="btn-sm danger" onclick="deleteComm('${sec.id}','${d.id}','${c.id}')">🗑</button>
              </div>
            </div>`).join('')}
        </div>`).join('')}
    </div>`).join('');
}

function addSection() {
  const name = $('ns-name').value.trim(); const icon = $('ns-icon').value.trim() || '📁';
  if (!name) { notify('⚠️ أدخل اسم القسم'); return; }
  DB.sections.push({ id: 'sec-' + Date.now(), name, icon, depts: [] });
  saveDB(); $('ns-name').value = ''; $('ns-icon').value = ''; renderStructure(); notify('✅ تمت الإضافة');
}
function deleteSection(sid) {
  if (!confirm('حذف هذا القسم وكل ما تحته؟')) return;
  DB.sections = DB.sections.filter(s => s.id !== sid); saveDB(); renderStructure(); notify('تم الحذف');
}
function openEditSection(sid) {
  const sec = findSection(sid); if (!sec) return;
  $('edit-sec-id').value = sid; $('edit-sec-name').value = sec.name; $('edit-sec-icon').value = sec.icon;
  renderEditDeptsList(sid); $('edit-sec-modal').classList.add('show');
}
function renderEditDeptsList(sid) {
  const sec = findSection(sid);
  $('edit-sec-depts').innerHTML = sec.depts.length
    ? sec.depts.map(d => `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.45rem;background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:.45rem .65rem">
        <span style="flex:1;font-size:.86rem">📂 ${d.name}</span>
        <button class="btn-sm danger" onclick="removeDeptFromSection('${sid}','${d.id}')">🗑</button>
      </div>`).join('')
    : '<p style="font-size:.81rem;color:var(--muted);margin-bottom:.5rem">لا توجد أقسام فرعية</p>';
}
function addDeptToSection() {
  const sid = $('edit-sec-id').value; const name = $('new-dept-name').value.trim();
  if (!name) { notify('⚠️ أدخل اسم القسم'); return; }
  const sec = findSection(sid); if (!sec) return;
  sec.depts.push({ id: 'dept-' + Date.now(), name, committees: [] });
  saveDB(); $('new-dept-name').value = ''; renderEditDeptsList(sid); renderStructure(); notify('✅ تمت الإضافة');
}
function removeDeptFromSection(sid, did) {
  if (!confirm('حذف القسم الفرعي وكل لجانه؟')) return;
  const sec = findSection(sid); if (!sec) return;
  sec.depts = sec.depts.filter(d => d.id !== did);
  saveDB(); renderEditDeptsList(sid); renderStructure(); notify('تم الحذف');
}
function saveEditSection() {
  const sid = $('edit-sec-id').value; const sec = findSection(sid); if (!sec) return;
  const name = $('edit-sec-name').value.trim(); if (!name) { notify('⚠️ أدخل الاسم'); return; }
  sec.name = name; sec.icon = $('edit-sec-icon').value.trim() || sec.icon;
  saveDB(); closeStructModal('edit-sec-modal'); renderStructure(); notify('✅ تم الحفظ');
}
function deleteDept(sid, did) {
  if (!confirm('حذف القسم الفرعي وكل لجانه؟')) return;
  const sec = findSection(sid); if (!sec) return;
  sec.depts = sec.depts.filter(d => d.id !== did); saveDB(); renderStructure(); notify('تم الحذف');
}
function openEditDept(sid, did) {
  const sec = findSection(sid); const dept = sec?.depts.find(d => d.id === did); if (!dept) return;
  $('edit-dept-sid').value = sid; $('edit-dept-id').value = did; $('edit-dept-name').value = dept.name;
  renderEditCommsList(sid, did); $('edit-dept-modal').classList.add('show');
}
function renderEditCommsList(sid, did) {
  const sec = findSection(sid); const dept = sec?.depts.find(d => d.id === did); if (!dept) return;
  $('edit-dept-comms').innerHTML = dept.committees.length
    ? dept.committees.map(c => `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.45rem;background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:.45rem .65rem">
        <span style="flex:1;font-size:.86rem">${c.icon} ${c.name}</span>
        <button class="btn-sm danger" onclick="removeCommFromDept('${sid}','${did}','${c.id}')">🗑</button>
      </div>`).join('')
    : '<p style="font-size:.81rem;color:var(--muted);margin-bottom:.5rem">لا توجد لجان</p>';
}
function addCommToDept() {
  const sid = $('edit-dept-sid').value; const did = $('edit-dept-id').value;
  const name = $('new-comm-name').value.trim(); const icon = $('new-comm-icon').value.trim() || '📌';
  if (!name) { notify('⚠️ أدخل اسم اللجنة'); return; }
  const sec = findSection(sid); const dept = sec?.depts.find(d => d.id === did); if (!dept) return;
  dept.committees.push({ id: 'c-' + Date.now(), name, icon });
  saveDB(); $('new-comm-name').value = ''; $('new-comm-icon').value = '';
  renderEditCommsList(sid, did); renderStructure(); notify('✅ تمت الإضافة');
}
function removeCommFromDept(sid, did, cid) {
  const sec = findSection(sid); const dept = sec?.depts.find(d => d.id === did); if (!dept) return;
  dept.committees = dept.committees.filter(c => c.id !== cid);
  saveDB(); renderEditCommsList(sid, did); renderStructure(); notify('تم الحذف');
}
function saveEditDept() {
  const sid = $('edit-dept-sid').value; const did = $('edit-dept-id').value;
  const sec = findSection(sid); const dept = sec?.depts.find(d => d.id === did); if (!dept) return;
  const name = $('edit-dept-name').value.trim(); if (!name) { notify('⚠️ أدخل الاسم'); return; }
  dept.name = name; saveDB(); closeStructModal('edit-dept-modal'); renderStructure(); notify('✅ تم الحفظ');
}
function openEditComm(sid, did, cid) {
  const sec = findSection(sid); const dept = sec?.depts.find(d => d.id === did);
  const comm = dept?.committees.find(c => c.id === cid); if (!comm) return;
  const newName = prompt('اسم اللجنة:', comm.name); if (newName === null) return;
  const newIcon = prompt('الأيقونة:', comm.icon);   if (newIcon === null) return;
  if (newName.trim()) comm.name = newName.trim();
  if (newIcon.trim()) comm.icon = newIcon.trim();
  saveDB(); renderStructure(); notify('✅ تم التعديل');
}
function deleteComm(sid, did, cid) {
  if (!confirm('حذف هذه اللجنة؟')) return;
  const sec = findSection(sid); const dept = sec?.depts.find(d => d.id === did); if (!dept) return;
  dept.committees = dept.committees.filter(c => c.id !== cid);
  saveDB(); renderStructure(); notify('تم الحذف');
}
function closeStructModal(id) { $(id).classList.remove('show'); }

// INIT
$('nid').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
