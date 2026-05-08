// ══════════════════════════════════════════════════════════════
//  مأتم السنابس — app.js  v3  (Firebase + All Features)
// ══════════════════════════════════════════════════════════════

const DEFAULT_SECTIONS = [
  {id:'sec-1',name:'مدير المأتم',icon:'🏛',depts:[{id:'dept-1a',name:'مديرية المأتم',committees:[{id:'c-01',name:'الصيانة',icon:'🔧'},{id:'c-02',name:'الخدمات',icon:'🛎'},{id:'c-03',name:'الترتيب الداخلي (اللوجستية)',icon:'📦'},{id:'c-04',name:'الديكور',icon:'🎨'}]}]},
  {id:'sec-2',name:'نائب الرئيس',icon:'👤',depts:[{id:'dept-2a',name:'تنمية الموارد البشرية',committees:[{id:'c-05',name:'المواهب والسواد',icon:'⭐'},{id:'c-06',name:'التدريب والتطوير',icon:'📚'},{id:'c-07',name:'الجودة',icon:'✅'}]}]},
  {id:'sec-3',name:'منسق اللجان الداعمة',icon:'🤝',depts:[{id:'dept-3a',name:'العلاقات العامة والإعلام',committees:[{id:'c-08',name:'العلاقات العامة',icon:'🤝'},{id:'c-09',name:'الإعلام',icon:'📡'}]},{id:'dept-3b',name:'الفنية',committees:[{id:'c-10',name:'الصوتيات',icon:'🎙'},{id:'c-11',name:'البث',icon:'📺'},{id:'c-12',name:'الإنتاج الفني',icon:'🎬'}]}]},
  {id:'sec-4',name:'منسق اللجان الفاعلة',icon:'⚡',depts:[{id:'dept-4a',name:'الثقافية',committees:[{id:'c-13',name:'الثقافة',icon:'📖'},{id:'c-14',name:'الخطباء',icon:'🎤'},{id:'c-15',name:'التنسيقية',icon:'📋'}]},{id:'dept-4b',name:'الموكب',committees:[{id:'c-16',name:'تنظيم الجدول',icon:'📅'},{id:'c-17',name:'مراجعة القصائد',icon:'📜'}]}]}
];

let DB = {
  sections: JSON.parse(JSON.stringify(DEFAULT_SECTIONS)),
  users: {}, admins: { '101010101': { name: 'المسؤول الرئيسي', password: 'admin' } },
  submissions: []
};

let _fdb=null, _fbReady=false, _detailSub=null, _adminLogs=[], _recyclebin=[], _logoutTimer=null;
const LOGOUT_MS=5*60*1000, RECYCLE_DAYS=180;

// ══ EMAILJS INIT (from generated emailjs-config.js) ══
window.addEventListener('load', ()=>{
  if(typeof ejsConfig!=='undefined' && ejsConfig.publicKey && typeof emailjs!=='undefined'){
    emailjs.init(ejsConfig.publicKey);
  }
});

// ══ FIREBASE ══
window.addEventListener('load', initFirebase);
async function initFirebase() {
  try {
    firebase.initializeApp(firebaseConfig);
    _fdb = firebase.firestore();
    _fdb.collection('config').doc('main').onSnapshot(doc => {
      if (doc.exists) { const d=doc.data(); if(d.sections?.length) DB.sections=d.sections; if(d.users) DB.users=d.users; if(d.admins) DB.admins=d.admins; }
      else saveConfig();
      if (!_fbReady) { _fbReady=true; hideLoader(); restoreSession(); }
      refreshLists();
    }, err => { console.error(err); showFbError(); });
    _fdb.collection('submissions').onSnapshot(snap => {
      DB.submissions=snap.docs.map(d=>({...d.data(),id:d.id}));
      refreshLists();
      if (_detailSub) { const f=DB.submissions.find(s=>s.id===_detailSub.id); if(f) _detailSub=f; }
    }, err => console.error('Subs:',err));
    _fdb.collection('logs').orderBy('ts','desc').limit(300).onSnapshot(snap => {
      _adminLogs=snap.docs.map(d=>({...d.data(),id:d.id}));
      if (document.querySelector('.panel.active')?.id==='p-logs') renderLogs();
    }, err => console.error('Logs:',err));
    _fdb.collection('recyclebin').onSnapshot(snap => {
      const cutoff=Date.now()-RECYCLE_DAYS*86400000;
      _recyclebin=snap.docs.map(d=>({...d.data(),id:d.id}));
      _recyclebin.filter(r=>r.deletedAt<cutoff).forEach(r=>_fdb.collection('recyclebin').doc(r.id).delete());
      _recyclebin=_recyclebin.filter(r=>r.deletedAt>=cutoff);
      if (document.querySelector('.panel.active')?.id==='p-recycle') renderRecycleBin();
    }, err => console.error('Recycle:',err));
  } catch(e) { console.error('Firebase:',e); showFbError(); }
}

function saveConfig() { if(!_fdb) return; _fdb.collection('config').doc('main').set({sections:DB.sections,users:DB.users,admins:DB.admins}).catch(()=>notify('⚠️ خطأ في الحفظ')); }
function saveDB() { saveConfig(); }
function saveSubmission(sub) { if(!_fdb){notify('⚠️ غير متصل');return;} _fdb.collection('submissions').doc(sub.id).set(sub).catch(()=>notify('⚠️ خطأ في الحفظ')); }
function addLog(action, details) {
  if(!_fdb||!window._cu) return;
  _fdb.collection('logs').add({ adminCpr:window._cu.nid, adminName:window._cu.name, action, details, ts:Date.now(), tsStr:new Date().toLocaleString('ar-BH') });
}
function hideLoader() { const e=$('loading-overlay'); if(e) e.style.display='none'; }
function showFbError() { hideLoader(); const e=$('fb-error'); if(e) e.style.display='flex'; }
function restoreSession(){
  try{
    const saved=sessionStorage.getItem('_cu');
    if(!saved)return;
    const cu=JSON.parse(saved);
    if(!cu||!cu.nid)return;
    window._cu=cu;
    window._adminLoggedIn=cu.role==='admin';
    resetLogoutTimer();
    if(cu.role==='admin'){
      showScreen('screen-admin');renderOverview();
    } else {
      $('u-badge').textContent=cu.name;
      const rb=$('u-role-badge');rb.textContent=cu.role==='manager'?'مسؤول قسم':'رئيس لجنة';rb.style.display='block';
      showScreen('screen-user');
      if(cu.role==='manager'){$('head-view').style.display='none';$('manager-view').style.display='block';renderManagerView();}
      else{$('head-view').style.display='block';$('manager-view').style.display='none';renderHeadView();}
    }
  }catch(e){sessionStorage.removeItem('_cu');}
}

function refreshLists() {
  const screen=document.querySelector('.screen.active')?.id;
  if (!screen) return;
  if (screen==='screen-admin') {
    const p=document.querySelector('.panel.active')?.id;
    if(p==='p-overview') renderOverview();
    if(p==='p-results') renderResults();
    if(p==='p-analytics') renderAnalytics();
    if(p==='p-users') renderUsersTable();
    if(p==='p-logs') renderLogs();
    if(p==='p-recycle') renderRecycleBin();
    if(p==='p-annual') renderAnnualExport();
  }
  if (screen==='screen-user'&&window._cu) {
    if(window._cu.role==='manager') { const rt=$('mgr-review-tab'); if(rt&&rt.style.display!=='none') renderManagerView(); }
    else { const fv=$('form-section')?.style.display==='block'; if(!fv) renderHeadView(); }
  }
}

// ══ INACTIVITY LOGOUT 5 MIN ══
function resetLogoutTimer() {
  clearTimeout(_logoutTimer);
  if (!window._cu&&!window._adminLoggedIn) return;
  _logoutTimer=setTimeout(()=>{ notify('⏱ تم تسجيل خروجك تلقائياً بسبب عدم النشاط'); setTimeout(doLogout,1500); }, LOGOUT_MS);
}
['click','keydown','mousemove','touchstart','scroll'].forEach(ev=>document.addEventListener(ev,resetLogoutTimer,{passive:true}));

// ══ HELPERS ══
const $=id=>document.getElementById(id);
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active');}
function notify(msg,dur=3000){const n=$('notif');n.textContent=msg;n.classList.add('show');setTimeout(()=>n.classList.remove('show'),dur);}
function showPanel(id,btn){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.sb-btn').forEach(b=>b.classList.remove('active'));
  $(id).classList.add('active'); btn.classList.add('active');
  if(id==='p-overview') renderOverview();
  if(id==='p-results'){populateResultFilters();renderResults();}
  if(id==='p-analytics') renderAnalytics();
  if(id==='p-users'){renderUsersTable();populateUserFormSelects();}
  if(id==='p-structure') renderStructure();
  if(id==='p-admins') renderAdminsTable();
  if(id==='p-logs') renderLogs();
  if(id==='p-recycle') renderRecycleBin();
  if(id==='p-annual') renderAnnualExport();
}
function findSection(id){return DB.sections.find(s=>s.id===id);}
function findCommittee(id){for(const s of DB.sections)for(const d of s.depts)for(const c of d.committees)if(c.id===id)return c;return null;}
function getCommSection(cid){for(const s of DB.sections)for(const d of s.depts)for(const c of d.committees)if(c.id===cid)return s;return null;}
function getCommDept(cid){for(const s of DB.sections)for(const d of s.depts)for(const c of d.committees)if(c.id===cid)return d;return null;}
function allCommittees(){return DB.sections.flatMap(s=>s.depts.flatMap(d=>d.committees));}
function approvedSubs(){return DB.submissions.filter(s=>s.status==='approved'&&!s.archived&&!s.deleted);}
function getManagerForComm(cid){const sec=getCommSection(cid);if(!sec)return null;const mgr=Object.entries(DB.users).find(([n,u])=>u.role==='manager'&&u.sectionId===sec.id);return mgr?{nid:mgr[0],...mgr[1]}:null;}

// ══ ARABIC PREVENTION ══
function handleNidInput(input){
  const arabic=/[\u0660-\u0669\u06F0-\u06F9]/g;
  const orig=input.value; const cleaned=orig.replace(arabic,'').replace(/[^0-9]/g,'');
  const warn=$(input.id+'-warn');
  if(cleaned!==orig){input.value=cleaned;if(warn){warn.style.display='block';setTimeout(()=>warn.style.display='none',3500);}}
  if(input.id==='nid'){$('admin-extra').style.display=DB.admins[cleaned]?'block':'none';$('err').style.display='none';}
}

// ══ LOGIN ══
function doLogin(){
  const nid=$('nid').value.trim(); const err=$('err'); err.style.display='none';
  if(!nid){err.textContent='الرجاء إدخال الرقم الوطني';err.style.display='block';return;}
  if(/[\u0660-\u0669\u06F0-\u06F9]/.test(nid)){err.textContent='الأرقام العربية غير مقبولة';err.style.display='block';return;}
  if(DB.admins[nid]){
    const ar=DB.admins[nid]; const pass=$('a-pass').value.trim();
    if(!pass){err.textContent='الرجاء إدخال كلمة المرور';err.style.display='block';return;}
    if(pass!==ar.password){err.textContent='كلمة المرور خاطئة';err.style.display='block';return;}
    window._cu={nid,name:ar.name,role:'admin'}; window._adminLoggedIn=true;
    sessionStorage.setItem('_cu',JSON.stringify(window._cu));
    resetLogoutTimer(); addLog('تسجيل دخول',`دخل المسؤول ${ar.name}`);
    showScreen('screen-admin'); renderOverview(); return;
  }
  const user=DB.users[nid];
  if(!user){err.textContent='عذراً، أنت غير مسجل في النظام';err.style.display='block';return;}
  window._cu={nid,...user}; window._adminLoggedIn=false; resetLogoutTimer();
  sessionStorage.setItem('_cu',JSON.stringify(window._cu));
  $('u-badge').textContent=user.name;
  const rb=$('u-role-badge'); rb.textContent=user.role==='manager'?'مسؤول قسم':'رئيس لجنة'; rb.style.display='block';
  showScreen('screen-user');
  if(user.role==='manager'){$('head-view').style.display='none';$('manager-view').style.display='block';renderManagerView();}
  else{$('head-view').style.display='block';$('manager-view').style.display='none';renderHeadView();}
}

function doLogout(){
  clearTimeout(_logoutTimer);
  if(window._cu?.role==='admin') addLog('تسجيل خروج',`خرج المسؤول ${window._cu.name}`);
  window._cu=null;window._sc=null;window._editingSubId=null;window._adminLoggedIn=false;
  sessionStorage.removeItem('_cu');
  $('nid').value='';$('a-pass').value='';$('admin-extra').style.display='none';
  const fs=$('form-section');if(fs)fs.style.display='none';
  const ra=$('rejected-alert');if(ra)ra.style.display='none';
  showScreen('screen-login');
}

// ══ 3-MONTH LIMIT ══
function canSubmitNow(userId,committeeId){
  const d=new Date();d.setDate(d.getDate()-90);const cutoff=d.toISOString().split('T')[0];
  return !DB.submissions.some(s=>{
    if(s.userId!==userId||s.committeeId!==committeeId||s.deleted)return false;
    if(s.status==='rejected')return false;
    // approved: use approvedDate; pending: use submission date
    const refDate=s.status==='approved'&&s.approvedDate?s.approvedDate:s.date;
    return refDate>=cutoff;
  });
}
function getNextSubmissionDate(userId,committeeId){
  const recent=DB.submissions.filter(s=>s.userId===userId&&s.committeeId===committeeId&&s.status!=='rejected'&&!s.deleted).sort((a,b)=>{
    const da=a.status==='approved'&&a.approvedDate?a.approvedDate:a.date;
    const db2=b.status==='approved'&&b.approvedDate?b.approvedDate:b.date;
    return db2.localeCompare(da);
  })[0];
  if(!recent)return null;
  const refDate=recent.status==='approved'&&recent.approvedDate?recent.approvedDate:recent.date;
  const d=new Date(refDate); d.setDate(d.getDate()+90); return d.toLocaleDateString('ar-BH');
}

// ══ HEAD VIEW ══
function renderHeadView(){
  const user=window._cu; const comm=findCommittee(user.committeeId); if(!comm)return;
  $('u-title').textContent='تقريرك';
  const rejected=DB.submissions.find(s=>s.userId===user.nid&&s.status==='rejected'&&!s.deleted);
  if(rejected){$('rejected-alert').style.display='flex';$('rejected-comment').textContent=rejected.managerComment||'لم يُذكر سبب';window._rejectedSub=rejected;}
  else{$('rejected-alert').style.display='none';window._rejectedSub=null;}
  const existing=DB.submissions.find(s=>s.userId===user.nid&&(s.status==='pending'||s.status==='approved')&&!s.deleted);
  const grid=$('comm-grid');
  if(existing){
    const stLabel=existing.status==='pending'?'⏳ بانتظار الموافقة':'✅ تم اعتماده';
    const stClass=existing.status==='pending'?'st-pending':'st-approved';
    grid.innerHTML=`<div class="comm-card sel" style="cursor:default"><div class="cc-icon">${comm.icon}</div><div class="cc-name">${comm.name}</div><div style="margin-top:.6rem"><span class="status-badge ${stClass}">${stLabel}</span></div></div>`;
    $('form-section').style.display='none';
  } else if(!canSubmitNow(user.nid,comm.id)){
    const next=getNextSubmissionDate(user.nid,comm.id);
    grid.innerHTML=`<div class="comm-card sel" style="cursor:default"><div class="cc-icon">${comm.icon}</div><div class="cc-name">${comm.name}</div><div style="margin-top:.6rem;font-size:.8rem;color:var(--orange)">⏳ التقرير القادم بعد ${next||'90 يوماً'}</div></div>`;
    $('form-section').style.display='none';
  } else {
    grid.innerHTML=`<div class="comm-card" id="cc-${comm.id}" onclick="selectComm('${comm.id}')"><div class="cc-icon">${comm.icon}</div><div class="cc-name">${comm.name}</div><div class="cc-parent">${getCommDept(comm.id)?.name||''}</div></div>`;
    selectComm(comm.id);
  }
}

function loadRejectedForEdit(){
  const sub=window._rejectedSub;if(!sub)return;
  window._editingSubId=sub.id; sub.status='draft'; saveSubmission(sub);
  const comm=findCommittee(sub.committeeId);if(!comm)return;
  selectComm(sub.committeeId,false);
  fillBullets('b-achievements',sub.achievements||[]);fillBullets('b-obstacles',sub.obstacles||[]);fillBullets('b-plans',sub.plans||[]);
  $('f-notes').value=sub.notes||'';$('rejected-alert').style.display='none';
}
function fillBullets(wid,arr){const wrap=$(wid);wrap.innerHTML='';const items=arr.length?arr:[''];items.forEach(v=>addBulletRow(wid,v));}

// ══ MANAGER VIEW ══
function renderManagerView(){
  const user=window._cu; const sec=findSection(user.sectionId);
  if(!sec){$('mgr-title').textContent='لا يوجد قسم مرتبط';return;}
  $('mgr-title').textContent=sec.name;
  const commIds=sec.depts.flatMap(d=>d.committees.map(c=>c.id));
  const pending=DB.submissions.filter(s=>s.status==='pending'&&commIds.includes(s.committeeId)&&!s.deleted);
  const pb=$('u-pending-badge');
  if(pending.length){pb.textContent=`${pending.length} بانتظار المراجعة`;pb.style.display='inline-flex';}else{pb.style.display='none';}
  $('mgr-sub').textContent=`${pending.length} تقرير بانتظار موافقتك`;
  const list=$('review-list');
  if(!pending.length){list.innerHTML=`<div class="review-empty"><div class="rei">✅</div><p>لا توجد تقارير بانتظار المراجعة</p></div>`;return;}
  const bl=arr=>arr?.length?arr.map(b=>`• ${b}`).join('\n'):'—';
  list.innerHTML=pending.map(s=>`<div class="review-card">
    <div class="review-card-head"><div><div class="review-card-title">${s.commName}</div><div class="review-card-meta">${s.userName} · <span class="id-tag">${s.userId}</span> · ${s.date}</div></div><span class="status-badge st-pending">⏳ بانتظار الموافقة</span></div>
    <div class="review-card-body">
      <div class="ans-q">الإنجازات</div><div class="ans-v">${bl(s.achievements)}</div>
      <div class="ans-q">الصعوبات والحلول المقترحة</div><div class="ans-v ${!s.obstacles?.length?'ev':''}">${bl(s.obstacles)}</div>
      <div class="ans-q">المخططات القادمة</div><div class="ans-v">${bl(s.plans)}</div>
      ${s.notes?`<div class="ans-q">ملاحظات</div><div class="ans-v">${s.notes}</div>`:''}
    </div>
    <div class="review-actions"><button class="btn-reject" onclick="openRejectFromManager('${s.id}')">❌ رفض</button><button class="btn-approve" onclick="approveSubmission('${s.id}')">✅ قبول</button></div>
  </div>`).join('');
}

function approveSubmission(sid){const s=DB.submissions.find(x=>x.id===sid);if(!s)return;s.status='approved';s.approvedDate=new Date().toISOString().split('T')[0];saveSubmission(s);sendApprovalEmails(s);notify('✅ تم قبول التقرير وإرساله للإدارة');}
function openRejectFromManager(sid){$('reject-sub-id').value=sid;$('reject-comment').value='';$('reject-modal').classList.add('show');}
function confirmReject(){
  const sid=$('reject-sub-id').value; const comment=$('reject-comment').value.trim();
  if(!comment){notify('⚠️ اكتب سبب الرفض');return;}
  const s=DB.submissions.find(x=>x.id===sid);if(!s)return;
  s.status='rejected';s.managerComment=comment;saveSubmission(s);closeRejectModal();notify('تم الرفض وإشعار المستخدم');
}
function closeRejectModal(){$('reject-modal').classList.remove('show');}

// ══ COMMITTEES & BULLETS ══
function selectComm(cid,resetForm=true){
  window._sc=cid;document.querySelectorAll('.comm-card').forEach(c=>c.classList.remove('sel'));$('cc-'+cid)?.classList.add('sel');
  const comm=findCommittee(cid);$('fh-icon').textContent=comm.icon;$('fh-title').textContent=comm.name;$('f-comm-name').textContent=comm.name;
  if(resetForm){initBullets('b-achievements');initBullets('b-obstacles');initBullets('b-plans');$('f-notes').value='';}
  const fs=$('form-section');fs.style.display='block';setTimeout(()=>fs.scrollIntoView({behavior:'smooth',block:'nearest'}),50);
}
function initBullets(wid){const w=$(wid);w.innerHTML='';addBulletRow(wid);}
function addBulletRow(wid,value=''){
  const wrap=$(wid); const row=document.createElement('div');row.className='bullet-row';
  row.innerHTML=`<span class="bullet-dot">•</span><textarea class="bullet-inp" rows="1" placeholder="اكتب هنا...">${value}</textarea><button class="btn-rm" onclick="removeBullet(this,'${wid}')">✕</button>`;
  const ta=row.querySelector('textarea');
  ta.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(ta.value.trim())addBulletRow(wid);wrap.querySelectorAll('.bullet-inp')[wrap.querySelectorAll('.bullet-inp').length-1].focus();}});
  ta.addEventListener('input',()=>{ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';});
  wrap.appendChild(row);
  if(value==='')setTimeout(()=>ta.focus(),30);else setTimeout(()=>{ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';},10);
}
function removeBullet(btn,wid){const wrap=$(wid);if(wrap.querySelectorAll('.bullet-row').length<=1){btn.closest('.bullet-row').querySelector('textarea').value='';return;}btn.closest('.bullet-row').remove();}
function getBullets(wid){return[...$(wid).querySelectorAll('.bullet-inp')].map(t=>t.value.trim()).filter(Boolean);}

// ══ SUBMIT ══
function submitForm(){
  const cid=window._sc;if(!cid)return;const user=window._cu;
  if(!canSubmitNow(user.nid,cid)){notify(`⚠️ التقرير القادم: ${getNextSubmissionDate(user.nid,cid)}`);return;}
  const achievements=getBullets('b-achievements'),obstacles=getBullets('b-obstacles'),plans=getBullets('b-plans'),notes=$('f-notes').value.trim();
  if(!achievements.length){notify('⚠️ الإنجازات إجبارية');return;}if(!plans.length){notify('⚠️ المخططات القادمة إجبارية');return;}
  const comm=findCommittee(cid),dept=getCommDept(cid),sec=getCommSection(cid);
  if(window._editingSubId){
    const ex=DB.submissions.find(s=>s.id===window._editingSubId);
    if(ex){ex.achievements=achievements;ex.obstacles=obstacles;ex.plans=plans;ex.notes=notes;ex.status='pending';ex.managerComment='';ex.date=new Date().toISOString().split('T')[0];ex.checklist=null;saveSubmission(ex);window._editingSubId=null;$('success-overlay').classList.add('show');return;}
  }
  const quarter='Q'+Math.ceil((new Date().getMonth()+1)/3);
  saveSubmission({id:'sub-'+Date.now(),userId:user.nid,userName:user.name,sectionId:sec?.id,sectionName:sec?.name,deptId:dept?.id,deptName:dept?.name,committeeId:cid,commName:comm?.name,date:new Date().toISOString().split('T')[0],year:new Date().getFullYear(),quarter,achievements,obstacles,plans,notes,status:'pending',managerComment:'',archived:false,checklist:null,deleted:false});
  $('success-overlay').classList.add('show');
}
function closeSuccess(){$('success-overlay').classList.remove('show');$('form-section').style.display='none';window._sc=null;window._editingSubId=null;initBullets('b-achievements');initBullets('b-obstacles');initBullets('b-plans');renderHeadView();}

// ══ MANAGER TABS ══
function switchMgrTab(tab){document.querySelectorAll('.mgr-tab').forEach(t=>t.classList.remove('active'));$('tab-'+tab).classList.add('active');$('mgr-review-tab').style.display=tab==='review'?'block':'none';$('mgr-fill-tab').style.display=tab==='fill'?'block':'none';if(tab==='fill')renderMgrFillGrid();}
function renderMgrFillGrid(){
  const user=window._cu;const sec=findSection(user.sectionId);if(!sec){$('mgr-comm-grid').innerHTML='<p style="color:var(--muted)">لا يوجد قسم</p>';return;}
  $('mgr-comm-grid').innerHTML=sec.depts.flatMap(d=>d.committees).map(c=>{
    const dept=getCommDept(c.id);const existing=DB.submissions.find(s=>s.committeeId===c.id&&s.userId===user.nid&&(s.status==='pending'||s.status==='approved')&&!s.deleted);
    const canSub=canSubmitNow(user.nid,c.id);const disabled=!!(existing||!canSub);
    const badge=existing?`<span class="status-badge ${existing.status==='approved'?'st-approved':'st-pending'}">${existing.status==='approved'?'معتمد':'بانتظار'}</span>`:!canSub?`<span style="font-size:.75rem;color:var(--orange)">⏳ ${getNextSubmissionDate(user.nid,c.id)}</span>`:'';
    return `<div class="comm-card ${disabled?'sel':''}" id="mgr-cc-${c.id}" onclick="${disabled?'':` selectMgrComm('${c.id}')`}" style="${disabled?'cursor:default':''}"><div class="cc-icon">${c.icon}</div><div class="cc-name">${c.name}</div><div class="cc-parent">${dept?.name||''}</div>${badge?`<div style="margin-top:.5rem">${badge}</div>`:''}</div>`;
  }).join('');
  $('mgr-form-section').style.display='none';
}
function selectMgrComm(cid){
  window._mgrSc=cid;document.querySelectorAll('#mgr-comm-grid .comm-card').forEach(c=>c.classList.remove('sel'));$('mgr-cc-'+cid)?.classList.add('sel');
  const comm=findCommittee(cid);$('mgr-fh-icon').textContent=comm.icon;$('mgr-fh-title').textContent=comm.name;$('mgr-f-comm-name').textContent=comm.name;
  initBullets('mgr-b-achievements');initBullets('mgr-b-obstacles');initBullets('mgr-b-plans');$('mgr-f-notes').value='';
  const fs=$('mgr-form-section');fs.style.display='block';setTimeout(()=>fs.scrollIntoView({behavior:'smooth',block:'nearest'}),50);
}
function submitManagerForm(){
  const cid=window._mgrSc;if(!cid)return;const user=window._cu;
  if(!canSubmitNow(user.nid,cid)){notify('⚠️ لا يمكن تقديم أكثر من تقرير كل 3 أشهر');return;}
  const achievements=getBullets('mgr-b-achievements'),obstacles=getBullets('mgr-b-obstacles'),plans=getBullets('mgr-b-plans'),notes=$('mgr-f-notes').value.trim();
  if(!achievements.length){notify('⚠️ الإنجازات إجبارية');return;}if(!plans.length){notify('⚠️ المخططات إجبارية');return;}
  const comm=findCommittee(cid),dept=getCommDept(cid),sec=getCommSection(cid);const quarter='Q'+Math.ceil((new Date().getMonth()+1)/3);
  saveSubmission({id:'sub-'+Date.now(),userId:user.nid,userName:user.name,sectionId:sec?.id,sectionName:sec?.name,deptId:dept?.id,deptName:dept?.name,committeeId:cid,commName:comm?.name,date:new Date().toISOString().split('T')[0],year:new Date().getFullYear(),quarter,achievements,obstacles,plans,notes,status:'approved',managerComment:'',archived:false,checklist:null,deleted:false});
  $('mgr-form-section').style.display='none';window._mgrSc=null;renderMgrFillGrid();notify('✅ تم الإرسال والاعتماد');
}

// ══ ADMIN OVERVIEW ══
function renderOverview(){
  const total=DB.sections.reduce((a,s)=>a+s.depts.reduce((b,d)=>b+d.committees.length,0),0);
  const approved=approvedSubs();const pending=DB.submissions.filter(s=>s.status==='pending'&&!s.deleted).length;
  $('a-stats').innerHTML=`
    <div class="stat"><div class="stat-n">${approved.length}</div><div class="stat-l">تقارير معتمدة</div></div>
    <div class="stat" style="cursor:pointer" onclick="showPendingDrill()"><div class="stat-n" style="color:var(--orange)">${pending}</div><div class="stat-l">بانتظار الموافقة ←</div></div>
    <div class="stat"><div class="stat-n">${Object.keys(DB.users).length}</div><div class="stat-l">المستخدمون</div></div>
    <div class="stat"><div class="stat-n">${total}</div><div class="stat-l">اللجان</div></div>`;
  const recent=[...approved].reverse().slice(0,6);
  $('a-recent').innerHTML=recent.length?`<div class="tbl-wrap"><table><thead><tr><th>الاسم</th><th>اللجنة</th><th>القسم</th><th>التاريخ</th></tr></thead><tbody>${recent.map(s=>`<tr><td>${s.userName}</td><td>${s.commName}</td><td style="color:var(--muted);font-size:.78rem">${s.sectionName||''}</td><td style="color:var(--muted);font-size:.78rem">${s.date}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty-s"><div class="ei">📭</div><p>لا توجد تقارير معتمدة بعد</p></div>`;
}

// ══ PENDING DRILL ══
function showPendingDrill(){
  const pending=DB.submissions.filter(s=>s.status==='pending'&&!s.deleted);
  $('status-modal-title').textContent=`بانتظار الموافقة (${pending.length})`;
  $('status-modal-body').innerHTML=!pending.length?'<div class="empty-s"><div class="ei">✅</div><p>لا توجد تقارير بانتظار</p></div>':pending.map(s=>{
    const mgr=getManagerForComm(s.committeeId);
    return `<div style="background:var(--card2);border:1.5px solid var(--border);border-radius:4px;padding:.9rem 1rem;margin-bottom:.7rem">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.4rem;margin-bottom:.4rem">
        <div><span style="font-weight:700">${s.userName}</span> <span class="id-tag">${s.userId}</span></div>
        <span class="status-badge st-pending">⏳ بانتظار</span>
      </div>
      <div style="font-size:.82rem;color:var(--muted);margin-bottom:.35rem">📋 ${s.commName} · ${s.sectionName||''} · ${s.date}</div>
      <div style="font-size:.82rem;background:var(--orange-bg);border:1px solid rgba(192,96,16,.25);border-radius:3px;padding:.4rem .7rem;color:var(--orange)">⏳ بانتظار موافقة: <strong>${mgr?mgr.name+' ('+mgr.nid+')':'لا يوجد مسؤول'}</strong></div>
    </div>`;
  }).join('');
  $('status-modal').classList.add('show');
}

// ══ RESULTS ══
function populateResultFilters(){const rs=$('r-section');rs.innerHTML='<option value="">كل الأقسام</option>'+DB.sections.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');populateResultComms();}
function populateResultComms(){const sid=$('r-section').value;let comms=sid?(findSection(sid)?.depts.flatMap(d=>d.committees)||[]):allCommittees();$('r-comm').innerHTML='<option value="">كل اللجان</option>'+comms.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');}
function onResultSectionChange(){populateResultComms();renderResults();}
function renderResults(){
  const search=($('r-search')?.value||'').toLowerCase(),sid=$('r-section').value,cid=$('r-comm').value,sf=$('r-status').value;
  let subs=DB.submissions.filter(s=>{
    if(s.deleted)return false;if(s.archived&&sf!=='')return false;
    return(!search||s.userName.toLowerCase().includes(search)||s.userId.includes(search))&&(!sid||s.sectionId===sid)&&(!cid||s.committeeId===cid)&&(!sf||s.status===sf);
  });
  const c=$('r-table');if(!subs.length){c.innerHTML='<div class="empty-s"><div class="ei">📭</div><p>لا توجد نتائج</p></div>';return;}
  c.innerHTML=`<div class="tbl-wrap"><table><thead><tr><th>الرقم الوطني</th><th>الاسم</th><th>اللجنة</th><th>القسم</th><th>الحالة</th><th>التاريخ</th><th></th></tr></thead><tbody>${subs.map(s=>{
    const stC=s.status==='approved'?'st-approved':s.status==='pending'?'st-pending':'st-rejected';
    const stL=s.status==='approved'?'معتمد':s.status==='pending'?'بانتظار':'مرفوض';
    const pct=calcProgress(s);
    return `<tr><td><span class="id-tag">${s.userId}</span></td><td>${s.userName}</td><td>${s.commName}</td><td style="color:var(--muted);font-size:.78rem">${s.sectionName||''}</td><td><span class="status-badge ${stC}">${stL}</span></td><td style="color:var(--muted);font-size:.78rem">${s.date}</td><td style="display:flex;gap:.3rem;align-items:center">${pct!==null?`<span style="font-size:.72rem;color:var(--green);font-weight:700">${pct}%</span>`:''}<button class="btn-sm" onclick="showDetail('${s.id}')">عرض</button><button class="btn-sm danger" onclick="deleteToRecycle('${s.id}')">🗑</button></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

// ══ RECYCLE BIN ══
function deleteToRecycle(sid){
  if(!confirm('نقل إلى سلة المحذوفات؟'))return;
  const s=DB.submissions.find(x=>x.id===sid);if(!s)return;
  _fdb.collection('recyclebin').doc(sid).set({...s,deletedAt:Date.now(),deletedBy:window._cu?.nid||'admin'}).then(()=>{s.deleted=true;saveSubmission(s);addLog('حذف تقرير',`نقل تقرير ${s.commName} (${s.userName}) لسلة المحذوفات`);notify('✅ تم النقل لسلة المحذوفات');}).catch(()=>notify('⚠️ خطأ'));
}
function renderRecycleBin(){
  const c=$('recycle-table');if(!c)return;
  if(!_recyclebin.length){c.innerHTML='<div class="empty-s"><div class="ei">🗑</div><p>سلة المحذوفات فارغة</p></div>';return;}
  c.innerHTML=`<div class="tbl-wrap"><table><thead><tr><th>الاسم</th><th>اللجنة</th><th>تاريخ الحذف</th><th>حذف تلقائي</th><th></th></tr></thead><tbody>${_recyclebin.map(r=>{
    const autoDel=new Date(r.deletedAt+RECYCLE_DAYS*86400000).toLocaleDateString('ar-BH');
    return `<tr><td>${r.userName}</td><td>${r.commName}</td><td style="color:var(--muted);font-size:.78rem">${new Date(r.deletedAt).toLocaleDateString('ar-BH')}</td><td style="color:var(--red-l);font-size:.78rem">${autoDel}</td><td style="display:flex;gap:.3rem"><button class="btn-sm" onclick="restoreFromRecycle('${r.id}')">↩️ استرداد</button><button class="btn-sm danger" onclick="permanentDelete('${r.id}')">🗑 نهائي</button></td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function restoreFromRecycle(sid){
  if(!confirm('استرداد هذا التقرير؟'))return;
  const r=_recyclebin.find(x=>x.id===sid);if(!r)return;
  const res={...r};delete res.deletedAt;delete res.deletedBy;res.deleted=false;
  saveSubmission(res);_fdb.collection('recyclebin').doc(sid).delete();
  addLog('استرداد تقرير',`استرداد ${r.commName} (${r.userName})`);notify('✅ تم الاسترداد');
}
function permanentDelete(sid){
  if(!confirm('حذف نهائي؟ لا يمكن التراجع.'))return;
  const r=_recyclebin.find(x=>x.id===sid);_fdb.collection('recyclebin').doc(sid).delete();
  addLog('حذف نهائي',`حذف نهائي: ${r?.commName||sid}`);notify('تم الحذف النهائي');
}

// ══ DETAIL MODAL ══
function calcProgress(s){if(!s.checklist)return null;const all=[...(s.checklist.ach||[]),...(s.checklist.obs||[]),...(s.checklist.pln||[])];if(!all.length)return null;return Math.round(all.filter(Boolean).length/all.length*100);}
function showDetail(sid){
  const s=DB.submissions.find(x=>x.id===sid);if(!s)return;_detailSub=s;
  $('m-title').textContent=`${s.userName} — ${s.commName}`;
  if(!s.checklist){s.checklist={ach:(s.achievements||[]).map(()=>false),obs:(s.obstacles||[]).map(()=>false),pln:(s.plans||[]).map(()=>false)};}
  const pct=calcProgress(s),totalItems=s.checklist.ach.length+s.checklist.obs.length+s.checklist.pln.length,doneItems=[...s.checklist.ach,...s.checklist.obs,...s.checklist.pln].filter(Boolean).length;
  $('m-body').innerHTML=`
    <div style="margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid var(--bg2);display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">
      <span class="id-tag">${s.userId}</span><span style="color:var(--muted);font-size:.8rem">${s.date}${s.quarter?' · '+s.quarter:''}</span>
      <span style="color:var(--muted2);font-size:.78rem">${s.sectionName||''} ← ${s.deptName||''} ← ${s.commName}</span>
    </div>
    ${totalItems>0?`<div class="progress-wrap" style="margin-bottom:1.2rem"><div class="progress-label"><span>نسبة الإنجاز المُوثَّق</span><span style="font-weight:700;color:var(--green)">${pct??0}% (${doneItems}/${totalItems})</span></div><div class="progress-bar"><div class="progress-fill" style="width:${pct??0}%"></div></div></div>`:''}
    ${renderCheckSection('الإنجازات','ach',s.achievements,s.checklist.ach,s.id)}
    ${renderCheckSection('الصعوبات والحلول المقترحة','obs',s.obstacles,s.checklist.obs,s.id)}
    ${renderCheckSection('المخططات القادمة','pln',s.plans,s.checklist.pln,s.id)}
    <div class="ans-block"><div class="ans-q">ملاحظات</div><div class="ans-v ${!s.notes?'ev':''}">${s.notes||'—'}</div></div>
    ${s.managerComment?`<div class="ans-block"><div class="ans-q">تعليق المسؤول</div><div class="ans-v" style="color:var(--orange)">${s.managerComment}</div></div>`:''}`;
  $('detail-modal').classList.add('show');
}
function renderCheckSection(title,key,items,checks,sid){
  if(!items||!items.length)return`<div class="ans-block"><div class="ans-q">${title}</div><div class="ans-v ev">—</div></div>`;
  // obstacles section (obs) — plain list, no checkboxes
  if(key==='obs'){
    return`<div class="ans-block"><div class="ans-q">${title}</div><div style="background:var(--card2);border:1px solid var(--border);border-radius:3px;padding:.5rem .7rem">${items.map(item=>`<div style="padding:.25rem 0;font-size:.88rem">• ${item}</div>`).join('')}</div></div>`;
  }
  return`<div class="ans-block"><div class="ans-q">${title}</div><div style="background:var(--card2);border:1px solid var(--border);border-radius:3px;padding:.5rem .7rem">${items.map((item,i)=>`<div class="checklist-item"><input type="checkbox" id="chk-${key}-${i}" ${checks[i]?'checked':''} onchange="tickItem('${sid}','${key}',${i},this.checked)"><label for="chk-${key}-${i}" class="${checks[i]?'done':''}">${item}</label></div>`).join('')}</div></div>`;
}
function tickItem(sid,key,index,val){
  const s=DB.submissions.find(x=>x.id===sid);if(!s||!s.checklist)return;s.checklist[key][index]=val;saveSubmission(s);
  const keyLabel={'ach':'الإنجازات','pln':'المخططات'};
  addLog('تحديث قائمة التحقق',`${val?'✅':'☐'} ${keyLabel[key]||key} #${index+1} — ${s.commName} (${s.userName})`);
  const pct=calcProgress(s),totalItems=s.checklist.ach.length+s.checklist.obs.length+s.checklist.pln.length,doneItems=[...s.checklist.ach,...s.checklist.obs,...s.checklist.pln].filter(Boolean).length;
  const pw=document.querySelector('.progress-fill'),pl=document.querySelector('.progress-label span:last-child');
  if(pw)pw.style.width=(pct??0)+'%';if(pl)pl.textContent=`${pct??0}% (${doneItems}/${totalItems})`;
  document.querySelectorAll('.checklist-item label').forEach(lbl=>{const chk=lbl.previousElementSibling;if(chk)lbl.className=chk.checked?'done':'';});
}
function closeModal(){$('detail-modal').classList.remove('show');renderResults();}
function printDetail(){
  const s=_detailSub;if(!s)return;const bl=arr=>arr?.length?arr.map(b=>`<div>• ${b}</div>`).join(''):'<em>—</em>';const pct=calcProgress(s)??0;
  const win=window.open('','_blank','width=800,height=900');
  win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير - ${s.commName}</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&family=Tajawal:wght@700&display=swap" rel="stylesheet"><style>body{font-family:'Cairo',sans-serif;direction:rtl;padding:2rem;max-width:700px;margin:0 auto;}h1{color:#1a5c35;}.meta{color:#7a7060;font-size:.85rem;border-bottom:2px solid #b8902a;padding-bottom:.6rem;margin-bottom:1rem;}.section{margin-bottom:1.2rem;}.sec-title{font-size:.75rem;font-weight:700;color:#1a5c35;text-transform:uppercase;margin-bottom:.4rem;}.sec-body{background:#f8f4ee;border:1px solid #d4c9b0;border-radius:3px;padding:.7rem;font-size:.88rem;line-height:1.7;}.prog-bar{height:10px;background:#e8e2d8;border-radius:5px;overflow:hidden;margin-bottom:1.2rem;}.prog-fill{height:100%;background:#1a5c35;}</style></head><body><h1>مأتم السنابس — تقرير داخلي</h1><div class="meta"><strong>${s.commName}</strong> · ${s.sectionName||''} · ${s.userName} · ${s.userId} · ${s.date}${s.quarter?' · '+s.quarter:''}</div><div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:.3rem"><span>نسبة الإنجاز</span><strong style="color:#1a5c35">${pct}%</strong></div><div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div><div class="section"><div class="sec-title">الإنجازات</div><div class="sec-body">${bl(s.achievements)}</div></div><div class="section"><div class="sec-title">الصعوبات والحلول المقترحة</div><div class="sec-body">${s.obstacles?.length?bl(s.obstacles):'<em>—</em>'}</div></div><div class="section"><div class="sec-title">المخططات القادمة</div><div class="sec-body">${bl(s.plans)}</div></div><div class="section"><div class="sec-title">ملاحظات</div><div class="sec-body">${s.notes||'<em>—</em>'}</div></div>${s.managerComment?`<div class="section"><div class="sec-title">تعليق المسؤول</div><div class="sec-body" style="color:#c06010">${s.managerComment}</div></div>`:''}<script>window.onload=()=>{window.print();}<\/script></body></html>`);
  win.document.close();
}

// ══ STATUS DRILL (from chart) ══
function showStatusDrill(statusKey,label){
  if(statusKey==='pending'){showPendingDrill();return;}
  const subs=DB.submissions.filter(s=>s.status===statusKey&&!s.deleted);
  $('status-modal-title').textContent=`${label} (${subs.length})`;
  const stC=statusKey==='approved'?'st-approved':'st-rejected';
  $('status-modal-body').innerHTML=!subs.length?'<div class="empty-s"><div class="ei">📭</div><p>لا توجد تقارير</p></div>':subs.map(s=>`<div style="background:var(--card2);border:1.5px solid var(--border);border-radius:4px;padding:.9rem 1rem;margin-bottom:.7rem"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:.4rem;margin-bottom:.5rem"><div><span style="font-weight:700">${s.userName}</span> <span class="id-tag">${s.userId}</span></div><span class="status-badge ${stC}">${label}</span></div><div style="font-size:.8rem;color:var(--muted);margin-bottom:.4rem">${s.commName} · ${s.sectionName||''} · ${s.date}</div>${statusKey==='rejected'&&s.managerComment?`<div style="background:var(--red-bg);border:1px solid rgba(160,32,32,.25);border-radius:3px;padding:.5rem;font-size:.82rem;color:var(--red);margin-top:.4rem"><strong>سبب الرفض:</strong> ${s.managerComment}</div>`:''}<div style="margin-top:.6rem"><button class="btn-sm" onclick="$('status-modal').classList.remove('show');showDetail('${s.id}')">عرض</button></div></div>`).join('');
  $('status-modal').classList.add('show');
}

// ══ ZIP ══
function generateReportHTML(s){const bl=arr=>arr?.length?arr.map(b=>`<li>${b}</li>`).join(''):'<li><em>—</em></li>';const pct=calcProgress(s)??0;return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>تقرير-${s.commName}</title><style>body{font-family:Arial,sans-serif;direction:rtl;padding:2rem;max-width:700px;margin:0 auto;}h1{color:#1a5c35;}h2{color:#1a5c35;margin:1rem 0 .4rem;}.meta{color:#7a7060;font-size:.85rem;border-bottom:2px solid #b8902a;padding-bottom:.6rem;margin-bottom:1rem;}ul{background:#f8f4ee;border:1px solid #d4c9b0;padding:.7rem 1rem .7rem 1.5rem;border-radius:3px;}li{margin-bottom:.3rem;}</style></head><body><h1>مأتم السنابس — تقرير داخلي</h1><div class="meta">${s.commName} · ${s.sectionName||''} · ${s.userName} (${s.userId}) · ${s.date}${s.quarter?' · '+s.quarter:''} · إنجاز: ${pct}%</div><h2>الإنجازات</h2><ul>${bl(s.achievements)}</ul><h2>الصعوبات والحلول المقترحة</h2><ul>${bl(s.obstacles)}</ul><h2>المخططات القادمة</h2><ul>${bl(s.plans)}</ul><h2>ملاحظات</h2><p>${s.notes||'—'}</p></body></html>`;}
async function downloadAllZip(markArchived=false){
  const subs=DB.submissions.filter(s=>s.status==='approved'&&!s.archived&&!s.deleted);
  if(!subs.length){notify('⚠️ لا توجد تقارير للتحميل');return;}notify('⏳ جاري الإنشاء...');
  const zip=new JSZip(),folder=zip.folder('تقارير_السنابس');
  subs.forEach(s=>folder.file(`${s.commName}_${s.userId}_${s.date}.html`.replace(/[/\\?%*:|"<>]/g,'_'),generateReportHTML(s)));
  const blob=await zip.generateAsync({type:'blob'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`تقارير_السنابس_${new Date().toISOString().split('T')[0]}.zip`;a.click();
  if(markArchived){subs.forEach(s=>{s.archived=true;saveSubmission(s);});addLog('تحميل وإخفاء',`${subs.length} تقرير`);notify('✅ تم التحميل والإخفاء');}
  else{addLog('تحميل ZIP',`${subs.length} تقرير`);notify(`✅ تم تحميل ${subs.length} تقرير`);}
}
function downloadAndClear(){if(!confirm('تحميل الكل وإخفاؤها من الواجهة؟'))return;downloadAllZip(true);}

// ══ ANNUAL EXPORT ══
function renderAnnualExport(){
  const container=$('annual-content');if(!container)return;
  const years=[...new Set(DB.submissions.filter(s=>s.year).map(s=>s.year))].sort((a,b)=>b-a);
  if(!years.length){container.innerHTML='<div class="empty-s"><div class="ei">📅</div><p>لا توجد بيانات سنوية بعد</p></div>';return;}
  const selectedYear=$('annual-year')?.value||years[0];
  container.innerHTML=`<div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap"><div><label style="font-size:.78rem;color:var(--green);font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:.35rem">السنة</label><select id="annual-year" class="inp" style="max-width:140px" onchange="renderAnnualExport()">${years.map(y=>`<option value="${y}" ${y==selectedYear?'selected':''}>${y}</option>`).join('')}</select></div><button class="btn-gold" style="margin-top:1.3rem" onclick="exportAnnualZip(${selectedYear})">📥 تصدير سنة ${selectedYear}</button></div>`;
  const yearSubs=DB.submissions.filter(s=>s.year==selectedYear&&s.status==='approved'&&!s.deleted);
  const quarters=['Q1','Q2','Q3','Q4'];const byComm={};
  yearSubs.forEach(s=>{if(!byComm[s.committeeId])byComm[s.committeeId]={name:s.commName,section:s.sectionName,q:{}};byComm[s.committeeId].q[s.quarter]=s;});
  if(!Object.keys(byComm).length){container.innerHTML+='<div class="empty-s"><div class="ei">📭</div><p>لا توجد تقارير لهذه السنة</p></div>';return;}
  container.innerHTML+=`<div class="tbl-wrap"><table><thead><tr><th>اللجنة</th><th>القسم</th>${quarters.map(q=>`<th>${q}</th>`).join('')}<th>المجموع</th></tr></thead><tbody>${Object.entries(byComm).map(([cid,cd])=>{
    const total=quarters.filter(q=>cd.q[q]).length;const color=total===4?'var(--green)':total>=2?'var(--orange)':'var(--red-l)';
    return `<tr><td style="font-weight:600">${cd.name}</td><td style="color:var(--muted);font-size:.78rem">${cd.section||''}</td>${quarters.map(q=>cd.q[q]?`<td><span class="status-badge st-approved">✅ ${cd.q[q].userName}</span></td>`:`<td><span style="color:var(--muted2)">—</span></td>`).join('')}<td><strong style="color:${color}">${total}/4</strong></td></tr>`;
  }).join('')}</tbody></table></div><div style="margin-top:1rem;font-size:.8rem;color:var(--muted)">✅ مكتملة: ${Object.values(byComm).filter(c=>Object.keys(c.q).length===4).length} · ⚠️ ناقصة: ${Object.values(byComm).filter(c=>Object.keys(c.q).length<4&&Object.keys(c.q).length>0).length} · ❌ لم تقدم: ${allCommittees().length-Object.keys(byComm).length}</div>`;
}
async function exportAnnualZip(year){
  const yearSubs=DB.submissions.filter(s=>s.year==year&&s.status==='approved'&&!s.deleted);
  if(!yearSubs.length){notify(`⚠️ لا توجد تقارير لسنة ${year}`);return;}notify('⏳ جاري الإنشاء...');
  const zip=new JSZip(),folder=zip.folder(`تقارير_${year}`),bySection={};
  yearSubs.forEach(s=>{const sec=s.sectionName||'عام';if(!bySection[sec])bySection[sec]=[];bySection[sec].push(s);});
  Object.entries(bySection).forEach(([sec,subs])=>{const sf=folder.folder(sec);subs.forEach(s=>sf.file(`${s.commName}_${s.quarter||''}_${s.userId}.html`.replace(/[/\\?%*:|"<>]/g,'_'),generateReportHTML(s)));});
  const blob=await zip.generateAsync({type:'blob'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`تقارير_السنابس_${year}.zip`;a.click();
  addLog('تصدير سنوي',`سنة ${year} - ${yearSubs.length} تقرير`);notify(`✅ تصدير ${yearSubs.length} تقرير`);
}

// ══ ANALYTICS ══
let _charts=[];
function destroyCharts(){_charts.forEach(c=>{try{c.destroy();}catch{}});_charts=[];}
function renderAnalytics(){
  destroyCharts();const subs=approvedSubs();const container=$('analytics-content');
  if(!subs.length){container.innerHTML='<div class="empty-s"><div class="ei">📊</div><p>لا توجد بيانات</p></div>';return;}
  const bySection={},byComm={},byDate={},byStatus={approved:0,pending:0,rejected:0};
  DB.submissions.filter(s=>!s.deleted).forEach(s=>{byStatus[s.status]=(byStatus[s.status]||0)+1;});
  subs.forEach(s=>{bySection[s.sectionName||'غير محدد']=(bySection[s.sectionName||'غير محدد']||0)+1;byComm[s.commName]=(byComm[s.commName]||0)+1;byDate[s.date]=(byDate[s.date]||0)+1;});
  const wc=subs.filter(s=>s.checklist),avgPct=wc.length?Math.round(wc.reduce((a,s)=>a+calcProgress(s),0)/wc.length):0,fullDone=wc.filter(s=>calcProgress(s)===100).length;
  const avgAch=Math.round(subs.reduce((a,s)=>a+(s.achievements||[]).length,0)/subs.length*10)/10;
  const avgObs=Math.round(subs.reduce((a,s)=>a+(s.obstacles||[]).length,0)/subs.length*10)/10;
  const avgPln=Math.round(subs.reduce((a,s)=>a+(s.plans||[]).length,0)/subs.length*10)/10;
  container.innerHTML=`<div class="stats-row" style="margin-bottom:1.5rem"><div class="stat"><div class="stat-n">${subs.length}</div><div class="stat-l">إجمالي المعتمدة</div></div><div class="stat"><div class="stat-n">${DB.submissions.filter(s=>s.status==='pending'&&!s.deleted).length}</div><div class="stat-l">بانتظار الموافقة</div></div><div class="stat"><div class="stat-n">${avgPct}%</div><div class="stat-l">متوسط نسبة الإنجاز</div></div><div class="stat"><div class="stat-n">${fullDone}</div><div class="stat-l">مكتملة 100%</div></div></div><div class="chart-grid"><div class="chart-card"><h4>📊 التقارير حسب القسم</h4><canvas id="ch-section"></canvas></div><div class="chart-card"><h4>🥧 حالة التقارير <small style="font-size:.7rem;color:var(--muted)">(اضغط للتفاصيل)</small></h4><canvas id="ch-status"></canvas></div><div class="chart-card"><h4>📋 حسب اللجنة</h4><canvas id="ch-comm"></canvas></div><div class="chart-card"><h4>📅 حسب التاريخ</h4><canvas id="ch-date"></canvas></div><div class="chart-card"><h4>📝 متوسط النقاط</h4><canvas id="ch-avg"></canvas></div><div class="chart-card"><h4>✅ نسب الإنجاز</h4><canvas id="ch-progress"></canvas></div></div>`;
  const COLORS=['#1a5c35','#b8902a','#2d8a55','#d4aa3a','#226b40','#c06010','#4caf50','#ff9800'];
  function mkChart(id,type,labels,data,extras={}){const ctx=$(id)?.getContext('2d');if(!ctx)return;const ch=new Chart(ctx,{type,data:{labels,datasets:[{data,backgroundColor:COLORS,borderColor:type==='line'?'#1a5c35':'transparent',borderWidth:type==='line'?2:0,fill:type==='line',tension:.4}]},options:{responsive:true,plugins:{legend:{display:type==='pie'||type==='doughnut'},tooltip:{callbacks:{label:c=>` ${c.raw}`}}},scales:type!=='pie'&&type!=='doughnut'?{y:{beginAtZero:true,ticks:{precision:0}},x:{ticks:{font:{family:'Cairo'}}}}:undefined,...extras}});_charts.push(ch);}
  mkChart('ch-section','bar',Object.keys(bySection),Object.values(bySection));
  const statusLabels=['معتمد','بانتظار','مرفوض'],statusKeys=['approved','pending','rejected'];
  const ctxS=$('ch-status')?.getContext('2d');if(ctxS){const chS=new Chart(ctxS,{type:'doughnut',data:{labels:statusLabels,datasets:[{data:[byStatus.approved,byStatus.pending,byStatus.rejected],backgroundColor:['#1a5c35','#c06010','#a02020'],borderWidth:0}]},options:{responsive:true,plugins:{legend:{display:true},tooltip:{callbacks:{label:c=>` ${c.raw} تقرير`}}},onClick:(evt,els)=>{if(!els.length)return;showStatusDrill(statusKeys[els[0].index],statusLabels[els[0].index]);}}});_charts.push(chS);}
  const ce=Object.entries(byComm).sort((a,b)=>b[1]-a[1]).slice(0,8);mkChart('ch-comm','bar',ce.map(e=>e[0]),ce.map(e=>e[1]));
  const de=Object.entries(byDate).sort((a,b)=>a[0].localeCompare(b[0]));mkChart('ch-date','line',de.map(e=>e[0]),de.map(e=>e[1]));
  mkChart('ch-avg','bar',['الإنجازات','الصعوبات','المخططات'],[avgAch,avgObs,avgPln]);
  const brackets={'>75':0,'50-75':0,'25-50':0,'<25':0,'بدون بيانات':0};
  subs.forEach(s=>{const p=calcProgress(s);if(p===null)brackets['بدون بيانات']++;else if(p>=75)brackets['>75']++;else if(p>=50)brackets['50-75']++;else if(p>=25)brackets['25-50']++;else brackets['<25']++;});
  mkChart('ch-progress','doughnut',Object.keys(brackets),Object.values(brackets));
}

// ══ USERS ══
function renderUsersTable(){
  const search=($('us-search')?.value||'').toLowerCase();const users=Object.entries(DB.users).filter(([nid,u])=>!search||u.name.toLowerCase().includes(search)||nid.includes(search));
  const rl=r=>r==='manager'?'مسؤول قسم':'رئيس لجنة',rc=r=>r==='manager'?'role-manager':'role-head';
  const sl=u=>{if(u.role==='manager'){const s=findSection(u.sectionId);return s?.name||'—';}const c=findCommittee(u.committeeId);return c?.name||'—';};
  const c=$('us-table');if(!users.length){c.innerHTML='<div class="empty-s"><div class="ei">👤</div><p>لا يوجد مستخدمون</p></div>';return;}
  c.innerHTML=`<div class="tbl-wrap" style="margin-bottom:1.1rem"><table><thead><tr><th>الرقم الوطني</th><th>الاسم</th><th>الدور</th><th>النطاق</th><th></th></tr></thead><tbody>${users.map(([nid,u])=>`<tr><td><span class="id-tag">${nid}</span></td><td>${u.name}</td><td><span class="role-tag ${rc(u.role)}">${rl(u.role)}</span></td><td style="color:var(--muted2);font-size:.81rem">${sl(u)}</td><td><button class="btn-sm danger" onclick="deleteUser('${nid}')">حذف</button></td></tr>`).join('')}</tbody></table></div>`;
}
function populateUserFormSelects(){$('nu-section').innerHTML=DB.sections.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');onNewUserRoleChange();}
function onNewUserRoleChange(){const role=$('nu-role').value;$('nu-comm-row').style.display=role==='head'?'grid':'none';if(role==='head')onNewUserSectionChange();}
function onNewUserSectionChange(){const sid=$('nu-section').value;const sec=findSection(sid);$('nu-comm').innerHTML=(sec?sec.depts.flatMap(d=>d.committees):[]).map(c=>`<option value="${c.id}">${c.name}</option>`).join('');}
function addUser(){
  const name=$('nu-name').value.trim(),nid=$('nu-nid').value.trim(),role=$('nu-role').value;
  if(!name){notify('⚠️ أدخل الاسم');return;}if(!nid){notify('⚠️ أدخل الرقم الوطني');return;}
  if(/[\u0660-\u0669\u06F0-\u06F9]/.test(nid)){notify('⚠️ الأرقام العربية غير مقبولة');return;}
  if(DB.admins[nid]){notify('⚠️ هذا الرقم مسجل كمسؤول');return;}if(DB.users[nid]){notify('⚠️ مسجل مسبقاً');return;}
  if(role==='manager'){DB.users[nid]={name,role,sectionId:$('nu-section').value};}else{DB.users[nid]={name,role,committeeId:$('nu-comm').value};}
  saveDB();addLog('إضافة مستخدم',`${name} (${nid}) - ${role}`);$('nu-name').value='';$('nu-nid').value='';renderUsersTable();notify('✅ تم الإضافة');
}
function deleteUser(nid){
  if(!confirm(`حذف "${DB.users[nid]?.name}"؟`))return;const name=DB.users[nid]?.name;
  delete DB.users[nid];saveDB();addLog('حذف مستخدم',`${name} (${nid})`);renderUsersTable();notify('تم الحذف');
}

// ══ EMAILJS ══
function _getEjs(){ return (typeof ejsConfig!=='undefined'&&ejsConfig.serviceId)?ejsConfig:null; }
async function testEmailJS(){
  const cfg=_getEjs();if(!cfg){notify('⚠️ emailjs-config.js غير محمل — تأكد من الـ GitHub secrets');return;}
  const adminEmails=Object.entries(DB.admins).filter(([,a])=>a.email);
  if(!adminEmails.length){notify('⚠️ لا يوجد مسؤول بإيميل مسجل');return;}
  notify('⏳ جاري الإرسال...');
  try{
    await emailjs.send(cfg.serviceId,cfg.templateId,{
      to_email:adminEmails[0][1].email,to_name:adminEmails[0][1].name,
      reporter_name:'اختبار النظام',committee_name:'لجنة الاختبار',section_name:'اختبار',
      report_date:new Date().toLocaleDateString('ar-BH'),message:'هذه رسالة اختبار من نظام مأتم السنابس'
    });
    notify('✅ تم إرسال رسالة اختبار');$('ejs-status').innerHTML='<span style="color:var(--green)">✅ الاختبار نجح</span>';
  }catch(e){notify('❌ فشل الإرسال: '+(e.text||e));$('ejs-status').innerHTML=`<span style="color:var(--red)">❌ ${e.text||'خطأ'}</span>`;}
}
async function sendApprovalEmails(sub){
  const cfg=_getEjs();if(!cfg||typeof emailjs==='undefined')return;
  const adminEmails=Object.entries(DB.admins).filter(([,a])=>a.email);
  if(!adminEmails.length)return;
  const params={reporter_name:sub.userName,committee_name:sub.commName,section_name:sub.sectionName||'',report_date:sub.date,message:`تم اعتماد تقرير ${sub.commName} المقدم من ${sub.userName} بتاريخ ${sub.date}`};
  for(const [,admin] of adminEmails){
    try{ await emailjs.send(cfg.serviceId,cfg.templateId,{...params,to_email:admin.email,to_name:admin.name}); }
    catch(e){ console.error('EmailJS error:',e); }
  }
  addLog('إرسال إشعار بريد',`اعتماد: ${sub.commName} (${sub.userName}) — ${adminEmails.length} مسؤول`);
}

// ══ ADMIN USERS ══
function renderAdminsTable(){
  const c=$('admins-table');if(!c)return;const admins=Object.entries(DB.admins);
  if(!admins.length){c.innerHTML='<div class="empty-s"><div class="ei">🛡</div><p>لا يوجد مسؤولون</p></div>';return;}
  c.innerHTML=`<div class="tbl-wrap" style="margin-bottom:1.1rem"><table><thead><tr><th>الرقم الوطني (CPR)</th><th>الاسم</th><th>البريد الإلكتروني</th><th></th></tr></thead><tbody>${admins.map(([cpr,a])=>`<tr><td><span class="id-tag">${cpr}</span></td><td>${a.name}</td><td style="color:var(--muted);font-size:.8rem">${a.email||'<span style="color:var(--muted2)">—</span>'}</td><td><button class="btn-sm danger" onclick="deleteAdmin('${cpr}')" ${admins.length<=1?'disabled':''}>${admins.length<=1?'المسؤول الوحيد':'حذف'}</button></td></tr>`).join('')}</tbody></table></div>`;
  const ejsOk=typeof ejsConfig!=='undefined'&&ejsConfig.serviceId;
  const st=$('ejs-status');if(st)st.innerHTML=ejsOk?'<span style="color:var(--green)">✅ EmailJS محمّل وجاهز</span>':'<span style="color:var(--orange)">⚠️ emailjs-config.js غير موجود — أضف الـ GitHub secrets وادفع commit</span>';
}
function addAdmin(){
  const name=$('na-name').value.trim(),cpr=$('na-cpr').value.trim(),pass=$('na-pass').value.trim(),email=$('na-email').value.trim();
  if(!name){notify('⚠️ أدخل الاسم');return;}if(!cpr){notify('⚠️ أدخل الرقم الوطني');return;}if(!pass){notify('⚠️ أدخل كلمة المرور');return;}
  if(/[\u0660-\u0669\u06F0-\u06F9]/.test(cpr)){notify('⚠️ الأرقام العربية غير مقبولة');return;}
  if(DB.admins[cpr]){notify('⚠️ CPR مسجل مسبقاً');return;}if(DB.users[cpr]){notify('⚠️ مسجل كمستخدم عادي');return;}
  const adminObj={name,password:pass};if(email)adminObj.email=email;
  DB.admins[cpr]=adminObj;saveDB();addLog('إضافة مسؤول',`${name} (${cpr})${email?' — '+email:''}`);
  $('na-name').value='';$('na-cpr').value='';$('na-pass').value='';$('na-email').value='';renderAdminsTable();notify('✅ تم إضافة المسؤول');
}
function deleteAdmin(cpr){
  if(Object.keys(DB.admins).length<=1){notify('⚠️ لا يمكن حذف المسؤول الوحيد');return;}
  if(!confirm(`حذف "${DB.admins[cpr]?.name}"؟`))return;const name=DB.admins[cpr]?.name;
  delete DB.admins[cpr];saveDB();addLog('حذف مسؤول',`${name} (${cpr})`);renderAdminsTable();notify('تم الحذف');
}

// ══ LOGS ══
function renderLogs(){
  const c=$('logs-table');if(!c)return;const search=($('logs-search')?.value||'').toLowerCase();
  const filtered=_adminLogs.filter(l=>!search||l.adminName?.toLowerCase().includes(search)||l.action?.toLowerCase().includes(search)||l.details?.toLowerCase().includes(search));
  if(!filtered.length){c.innerHTML='<div class="empty-s"><div class="ei">📋</div><p>لا توجد سجلات</p></div>';return;}
  c.innerHTML=`<div class="tbl-wrap"><table><thead><tr><th>الوقت</th><th>المسؤول</th><th>الإجراء</th><th>التفاصيل</th></tr></thead><tbody>${filtered.map(l=>`<tr><td style="color:var(--muted);font-size:.76rem;white-space:nowrap">${l.tsStr||new Date(l.ts).toLocaleString('ar-BH')}</td><td><span class="id-tag">${l.adminCpr}</span><br><span style="font-size:.78rem">${l.adminName}</span></td><td style="font-weight:600;color:var(--green);font-size:.82rem">${l.action}</td><td style="font-size:.8rem;color:var(--text2)">${l.details}</td></tr>`).join('')}</tbody></table></div>`;
}

// ══ STRUCTURE ══
function renderStructure(){
  $('struct-tree').innerHTML=DB.sections.map(sec=>`<div class="tree-sec"><div class="tree-sec-head"><span>${sec.icon} ${sec.name}</span><div style="display:flex;gap:.4rem"><button class="btn-sm" onclick="openEditSection('${sec.id}')" style="background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff">✏️</button><button class="btn-sm danger" onclick="deleteSection('${sec.id}')" style="background:rgba(255,255,255,.08);border-color:rgba(255,100,100,.4);color:#ffaaaa">🗑</button></div></div>${sec.depts.map(d=>`<div class="tree-dept"><div class="tree-dept-name"><span>📂 ${d.name}</span><div style="display:flex;gap:.3rem"><button class="btn-sm" onclick="openEditDept('${sec.id}','${d.id}')">✏️</button><button class="btn-sm danger" onclick="deleteDept('${sec.id}','${d.id}')">🗑</button></div></div>${d.committees.map(c=>`<div class="tree-comm"><span>${c.icon} <span>${c.name}</span></span><div style="display:flex;gap:.3rem"><button class="btn-sm" onclick="openEditComm('${sec.id}','${d.id}','${c.id}')">✏️</button><button class="btn-sm danger" onclick="deleteComm('${sec.id}','${d.id}','${c.id}')">🗑</button></div></div>`).join('')}</div>`).join('')}</div>`).join('');
}
function addSection(){const name=$('ns-name').value.trim(),icon=$('ns-icon').value.trim()||'📁';if(!name){notify('⚠️ أدخل اسم القسم');return;}DB.sections.push({id:'sec-'+Date.now(),name,icon,depts:[]});saveDB();addLog('تعديل هيكل',`إضافة قسم: ${name}`);$('ns-name').value='';$('ns-icon').value='';renderStructure();notify('✅ تمت الإضافة');}
function deleteSection(sid){if(!confirm('حذف هذا القسم وكل ما تحته؟'))return;const sec=findSection(sid);DB.sections=DB.sections.filter(s=>s.id!==sid);saveDB();addLog('تعديل هيكل',`حذف قسم: ${sec?.name}`);renderStructure();notify('تم الحذف');}
function openEditSection(sid){const sec=findSection(sid);if(!sec)return;$('edit-sec-id').value=sid;$('edit-sec-name').value=sec.name;$('edit-sec-icon').value=sec.icon;renderEditDeptsList(sid);$('edit-sec-modal').classList.add('show');}
function renderEditDeptsList(sid){const sec=findSection(sid);$('edit-sec-depts').innerHTML=sec.depts.length?sec.depts.map(d=>`<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.45rem;background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:.45rem .65rem"><span style="flex:1;font-size:.86rem">📂 ${d.name}</span><button class="btn-sm danger" onclick="removeDeptFromSection('${sid}','${d.id}')">🗑</button></div>`).join(''):'<p style="font-size:.81rem;color:var(--muted);margin-bottom:.5rem">لا توجد أقسام فرعية</p>';}
function addDeptToSection(){const sid=$('edit-sec-id').value,name=$('new-dept-name').value.trim();if(!name){notify('⚠️ أدخل اسم القسم');return;}const sec=findSection(sid);if(!sec)return;sec.depts.push({id:'dept-'+Date.now(),name,committees:[]});saveDB();$('new-dept-name').value='';renderEditDeptsList(sid);renderStructure();notify('✅ تمت الإضافة');}
function removeDeptFromSection(sid,did){if(!confirm('حذف القسم الفرعي وكل لجانه؟'))return;const sec=findSection(sid);if(!sec)return;sec.depts=sec.depts.filter(d=>d.id!==did);saveDB();renderEditDeptsList(sid);renderStructure();notify('تم الحذف');}
function saveEditSection(){const sid=$('edit-sec-id').value,sec=findSection(sid);if(!sec)return;const name=$('edit-sec-name').value.trim();if(!name){notify('⚠️ أدخل الاسم');return;}sec.name=name;sec.icon=$('edit-sec-icon').value.trim()||sec.icon;saveDB();addLog('تعديل هيكل',`تعديل: ${name}`);closeStructModal('edit-sec-modal');renderStructure();notify('✅ تم الحفظ');}
function deleteDept(sid,did){if(!confirm('حذف القسم الفرعي وكل لجانه؟'))return;const sec=findSection(sid);if(!sec)return;sec.depts=sec.depts.filter(d=>d.id!==did);saveDB();renderStructure();notify('تم الحذف');}
function openEditDept(sid,did){const sec=findSection(sid),dept=sec?.depts.find(d=>d.id===did);if(!dept)return;$('edit-dept-sid').value=sid;$('edit-dept-id').value=did;$('edit-dept-name').value=dept.name;renderEditCommsList(sid,did);$('edit-dept-modal').classList.add('show');}
function renderEditCommsList(sid,did){const sec=findSection(sid),dept=sec?.depts.find(d=>d.id===did);if(!dept)return;$('edit-dept-comms').innerHTML=dept.committees.length?dept.committees.map(c=>`<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.45rem;background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:.45rem .65rem"><span style="flex:1;font-size:.86rem">${c.icon} ${c.name}</span><button class="btn-sm danger" onclick="removeCommFromDept('${sid}','${did}','${c.id}')">🗑</button></div>`).join(''):'<p style="font-size:.81rem;color:var(--muted);margin-bottom:.5rem">لا توجد لجان</p>';}
function addCommToDept(){const sid=$('edit-dept-sid').value,did=$('edit-dept-id').value,name=$('new-comm-name').value.trim(),icon=$('new-comm-icon').value.trim()||'📌';if(!name){notify('⚠️ أدخل اسم اللجنة');return;}const sec=findSection(sid),dept=sec?.depts.find(d=>d.id===did);if(!dept)return;dept.committees.push({id:'c-'+Date.now(),name,icon});saveDB();$('new-comm-name').value='';$('new-comm-icon').value='';renderEditCommsList(sid,did);renderStructure();notify('✅ تمت الإضافة');}
function removeCommFromDept(sid,did,cid){const sec=findSection(sid),dept=sec?.depts.find(d=>d.id===did);if(!dept)return;dept.committees=dept.committees.filter(c=>c.id!==cid);saveDB();renderEditCommsList(sid,did);renderStructure();notify('تم الحذف');}
function saveEditDept(){const sid=$('edit-dept-sid').value,did=$('edit-dept-id').value,sec=findSection(sid),dept=sec?.depts.find(d=>d.id===did);if(!dept)return;const name=$('edit-dept-name').value.trim();if(!name){notify('⚠️ أدخل الاسم');return;}dept.name=name;saveDB();closeStructModal('edit-dept-modal');renderStructure();notify('✅ تم الحفظ');}
function openEditComm(sid,did,cid){const sec=findSection(sid),dept=sec?.depts.find(d=>d.id===did),comm=dept?.committees.find(c=>c.id===cid);if(!comm)return;const nn=prompt('اسم اللجنة:',comm.name);if(nn===null)return;const ni=prompt('الأيقونة:',comm.icon);if(ni===null)return;if(nn.trim())comm.name=nn.trim();if(ni.trim())comm.icon=ni.trim();saveDB();addLog('تعديل هيكل',`تعديل لجنة: ${comm.name}`);renderStructure();notify('✅ تم التعديل');}
function deleteComm(sid,did,cid){if(!confirm('حذف هذه اللجنة؟'))return;const sec=findSection(sid),dept=sec?.depts.find(d=>d.id===did);if(!dept)return;const comm=dept.committees.find(c=>c.id===cid);dept.committees=dept.committees.filter(c=>c.id!==cid);saveDB();addLog('تعديل هيكل',`حذف لجنة: ${comm?.name}`);renderStructure();notify('تم الحذف');}
function closeStructModal(id){$(id).classList.remove('show');}

// INIT
$('nid').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
resetLogoutTimer();
