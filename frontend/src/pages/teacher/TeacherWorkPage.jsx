// src/pages/teacher/TeacherWorkPage.jsx
import { useEffect, useState } from 'react';
import { api, resolveFileUrl } from '../../api';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const token = () => localStorage.getItem('pnu_token');

function uploadWithProgress(fd, onProgress, retries = 3, retryDelay = 2000) {
  const attempt = (attemptsLeft) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/work`);
    xhr.setRequestHeader('Authorization', `Bearer ${token()}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || 'Upload failed'));
      } catch { reject(new Error('Server error')); }
    };
    xhr.onerror = () => {
      if (attemptsLeft > 1) {
        onProgress(0); // reset bar so user sees it retry
        setTimeout(() => attempt(attemptsLeft - 1).then(resolve).catch(reject), retryDelay);
      } else {
        reject(new Error('Upload failed after several attempts. Check your connection.'));
      }
    };
    xhr.send(fd);
  });
  return attempt(retries);
}

const WORK_TYPES = ['homework', 'assignment'];
const SUBJECTS   = ['Mathematics','Science','English','History','Geography','Physics','Chemistry','Biology','Computer','Art','Physical Education','Other'];

export default function TeacherWorkPage() {
  const [tab,      setTab]      = useState('list');
  const [work,     setWork]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [subs,     setSubs]     = useState({});
  const [msg,      setMsg]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form state
  const [form, setForm] = useState({
    work_type:'homework', title:'', subject:'Mathematics', description:'',
    instructions:'', due_date:'', is_important:false,
  });
  const [files, setFiles] = useState([]);

  const load = () => {
    setLoading(true);
    api.getWork('status=all').then(d => setWork(d.work||[])).catch(()=>{}).finally(()=>setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function createWork() {
    if (!form.title || !form.due_date) { setMsg('Title and due date are required.'); return; }

    // Read teacher's class from saved user profile
    let teacherClass = '';
    try { teacherClass = JSON.parse(localStorage.getItem('pnu_user')||'{}').class || ''; } catch {}
    if (!teacherClass) {
      setMsg('Error: You have no class assigned. Ask admin to assign your class first.');
      return;
    }

    setSubmitting(true); setMsg(''); setUploadProgress(0);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append('class', teacherClass);
      files.forEach(f => fd.append('files', f));
      await uploadWithProgress(fd, setUploadProgress);
      setUploadProgress(100);
      setMsg('✅ Work created successfully!');
      setForm({ work_type:'homework', title:'', subject:'Mathematics', description:'', instructions:'', due_date:'', is_important:false });
      setFiles([]);
      setTab('list');
      load();
    } catch (e) { setMsg('Error: ' + e.message); setUploadProgress(0); }
    setSubmitting(false);
    setTimeout(() => { setMsg(''); setUploadProgress(0); }, 4000);
  }

  async function deleteWork(id) {
    if (!window.confirm('Delete this work item?')) return;
    try { await api.deleteWork(id); load(); }
    catch (e) { setMsg('Error: ' + e.message); }
  }

  async function loadSubs(workId) {
    if (subs[workId]) return;
    const d = await api.getSubmissions(workId).catch(() => ({ submissions:[] }));
    setSubs(prev => ({ ...prev, [workId]: d.submissions||[] }));
  }

  async function toggleExpand(id) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    await loadSubs(id);
  }

  function handleFileChange(e) {
    const selected = Array.from(e.target.files);
    const totalFiles = files.length + selected.length;
    if (totalFiles > 10) { setMsg('Maximum 10 files allowed.'); return; }
    const oversized = selected.filter(f => f.size > 100 * 1024 * 1024);
    if (oversized.length) { setMsg('Each file must be under 100MB.'); return; }
    setFiles(prev => [...prev, ...selected]);
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  const active  = work.filter(w => w.status === 'active');
  const expired = work.filter(w => w.status === 'expired');

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">Work</div><div className="page-subtitle">Homework & Assignments</div></div>
      </div>

      <div className="tab-bar">
        <button className={`tab-btn ${tab==='list'?'active':''}`}   onClick={()=>setTab('list')}>Posted</button>
        <button className={`tab-btn ${tab==='create'?'active':''}`} onClick={()=>setTab('create')}>+ Create</button>
        <button className={`tab-btn ${tab==='expired'?'active':''}`} onClick={()=>setTab('expired')}>Expired</button>
      </div>

      {msg && <div className={`alert ${msg.startsWith('Error')||msg.startsWith('Max')||msg.startsWith('Each')?'alert-error':'alert-success'}`}>{msg}</div>}

      {/* ── LIST TAB ── */}
      {tab === 'list' && (
        <>
          {/* Summary */}
          <div className="stats-grid" style={{ marginBottom:14 }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background:'#EFF6FF', color:'#2563EB' }}>📚</div>
              <div><div className="stat-value" style={{ color:'#2563EB' }}>{active.filter(w=>w.work_type==='homework').length}</div><div className="stat-label">Homework</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background:'#FFF7ED', color:'#F97316' }}>📝</div>
              <div><div className="stat-value" style={{ color:'#F97316' }}>{active.filter(w=>w.work_type==='assignment').length}</div><div className="stat-label">Assignments</div></div>
            </div>
          </div>

          {loading && <div className="loading"><div className="spinner" /></div>}
          {!loading && active.length === 0 && (
            <div className="empty"><div className="empty-icon">📚</div><div className="empty-title">No active work</div><div className="empty-sub">Tap "+ Create" to add homework or assignments</div></div>
          )}

          {active.map(w => <WorkItem key={w.id} w={w} expanded={expanded} onToggle={toggleExpand} onDelete={deleteWork} subs={subs[w.id]} onReview={async(sid,status,remark)=>{ await api.reviewSubmission(w.id,sid,{status,remark}).catch(()=>{}); loadSubs(w.id); }} />)}
        </>
      )}

      {/* ── CREATE TAB ── */}
      {tab === 'create' && (
        <div className="card">
          <div style={{ fontWeight:800, fontSize:16, marginBottom:16 }}>Create New Work</div>

          {/* Work type selector */}
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            {WORK_TYPES.map(t => (
              <button key={t} onClick={()=>set('work_type',t)} style={{ flex:1, padding:'10px', borderRadius:10, border:`2px solid ${form.work_type===t?'var(--accent)':'var(--border)'}`, background: form.work_type===t?'#EFF6FF':'var(--bg2)', color: form.work_type===t?'var(--accent)':'var(--muted)', fontWeight:800, fontSize:13, cursor:'pointer', transition:'all 0.2s' }}>
                {t === 'homework' ? '📖 Homework' : '📝 Assignment'}
              </button>
            ))}
          </div>

          <div className="input-wrap"><label>Title *</label><input placeholder="e.g. Chapter 5 Exercise" value={form.title} onChange={e=>set('title',e.target.value)} /></div>

          <div className="input-wrap">
            <label>Subject</label>
            <select value={form.subject} onChange={e=>set('subject',e.target.value)}>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="input-wrap"><label>Description</label><textarea placeholder="Describe the task..." value={form.description} onChange={e=>set('description',e.target.value)} /></div>
          <div className="input-wrap"><label>Instructions</label><textarea placeholder="Specific instructions for students..." value={form.instructions} onChange={e=>set('instructions',e.target.value)} /></div>
          <div className="input-wrap"><label>Due Date *</label><input type="date" value={form.due_date} onChange={e=>set('due_date',e.target.value)} min={new Date().toISOString().slice(0,10)} /></div>

          {form.work_type === 'homework' && (
            <div style={{ background:'#EFF6FF', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#1D4ED8', fontWeight:600 }}>
              ℹ️ Homework files auto-expire in 2 weeks
            </div>
          )}
          {form.work_type === 'assignment' && (
            <div style={{ background:'#FFF7ED', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#C2410C', fontWeight:600 }}>
              ℹ️ Assignment files expire 1 day after the due date
            </div>
          )}

          {/* Important toggle */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, padding:'12px 14px', background:'var(--bg2)', borderRadius:10 }}>
            <div><div style={{ fontWeight:700, fontSize:14 }}>Mark as Important</div><div style={{ fontSize:12, color:'var(--muted)' }}>Students will see a priority badge</div></div>
            <label className="toggle">
              <input type="checkbox" checked={form.is_important} onChange={e=>set('is_important',e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* File upload */}
          <div className="input-wrap">
            <label>Attachments (max 10 files, 100MB each)</label>
            <label style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'16px', border:'2px dashed var(--border)', borderRadius:10, cursor:'pointer', background:'var(--bg2)', color:'var(--muted)', fontWeight:600, fontSize:14 }}>
              📎 Tap to attach files
              <input type="file" multiple style={{ display:'none' }} onChange={handleFileChange}
                accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt" />
            </label>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
              {files.map((f, i) => (
                <div key={i} className="file-chip" style={{ justifyContent:'space-between' }}>
                  <span>{fileIcon(f.type)} {f.name}</span>
                  <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:11, color:'var(--muted)' }}>{formatSize(f.size)}</span>
                    <button onClick={()=>removeFile(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--red)', fontWeight:800, fontSize:14, padding:0 }}>×</button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {submitting && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:700, color:'var(--muted)', marginBottom:6 }}>
                <span>{uploadProgress === 0 && '🔄 Retrying...'}{uploadProgress > 0 && '📤 Uploading...'}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div style={{ background:'var(--border)', borderRadius:99, height:8, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${uploadProgress}%`, background:'var(--accent)', borderRadius:99, transition:'width 0.3s ease' }} />
              </div>
            </div>
          )}

          <button className="btn btn-primary" onClick={createWork} disabled={submitting}>
            {submitting ? 'Uploading...' : '📤 Post Work'}
          </button>
        </div>
      )}

      {/* ── EXPIRED TAB ── */}
      {tab === 'expired' && (
        <>
          {expired.length === 0 && <div className="empty"><div className="empty-icon">🗂️</div><div className="empty-title">No expired work</div></div>}
          {expired.map(w => (
            <div key={w.id} className="list-item" style={{ opacity:0.7 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div className="list-item-title">{w.title}</div>
                  <div className="list-item-sub">{w.subject} • Due: {w.due_date}</div>
                </div>
                <span className="badge badge-gray">Expired</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function WorkItem({ w, expanded, onToggle, onDelete, subs, onReview }) {
  const isExp = expanded === w.id;
  const pendingSubs = (subs||[]).filter(s => s.status === 'pending' || !s.status).length;

  return (
    <div className="card" style={{ marginBottom:10, borderLeft: w.is_important ? '3px solid var(--red)' : '3px solid transparent' }}>
      <div className="expandable-header" onClick={()=>onToggle(w.id)}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
            <span>{w.work_type==='homework'?'📖':'📝'}</span>
            <div style={{ fontWeight:700, fontSize:14 }}>{w.title}</div>
            {w.is_important && <span style={{ fontSize:10, background:'#fee2e2', color:'#dc2626', padding:'1px 6px', borderRadius:20, fontWeight:800 }}>!</span>}
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            <span className="badge badge-gray" style={{ fontSize:11 }}>{w.subject}</span>
            <span style={{ fontSize:11, color:'var(--muted)', fontWeight:600 }}>📅 {w.due_date}</span>
            {pendingSubs > 0 && <span className="badge badge-yellow" style={{ fontSize:11 }}>{pendingSubs} pending</span>}
            {w.attachments?.length > 0 && <span style={{ fontSize:11, color:'var(--muted)' }}>📎 {w.attachments.length}</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={e=>{e.stopPropagation();onDelete(w.id);}} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:18 }}>🗑️</button>
          <span className="expand-icon">{isExp?'▲':'▼'}</span>
        </div>
      </div>

      <div className={`expandable-body ${isExp?'open':''}`}>
        <div className="divider" />
        {w.description && <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6, marginBottom:10 }}>{w.description}</p>}
        {w.instructions && (
          <div style={{ background:'var(--bg2)', borderRadius:10, padding:'10px 12px', marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:3 }}>INSTRUCTIONS</div>
            <div style={{ fontSize:13, color:'var(--text2)' }}>{w.instructions}</div>
          </div>
        )}

        {/* Attachments */}
        {w.attachments?.length > 0 && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:6 }}>ATTACHMENTS</div>
            {w.attachments.map(a => (
              <a key={a.id} href={resolveFileUrl(a.file_url)} target="_blank" rel="noreferrer" className="file-chip" style={{ marginBottom:4 }}>
                {fileIcon(a.file_type)} {a.file_name}
                <span style={{ marginLeft:'auto', fontSize:11, color:'var(--muted)' }}>{formatSize(a.file_size)}</span>
              </a>
            ))}
          </div>
        )}

        {/* Submission counts */}
        {w.submissionCounts && (
          <div style={{ display:'flex', gap:10, marginBottom:10 }}>
            {[['Submitted', w.submissionCounts.submitted,'badge-green'],['Late', w.submissionCounts.late,'badge-red'],['Total', w.submissionCounts.total,'badge-gray']].map(([l,v,b])=>(
              <div key={l} style={{ textAlign:'center', flex:1, background:'var(--bg2)', borderRadius:10, padding:'8px 4px' }}>
                <div style={{ fontWeight:900, fontSize:18 }}>{v||0}</div>
                <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600 }}>{l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Submissions list */}
        {subs && subs.length > 0 && (
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', marginBottom:6 }}>SUBMISSIONS</div>
            {subs.map(s => (
              <div key={s.student_id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13 }}>{s.student_name}</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '–'}</div>
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <span className={`badge ${s.status==='submitted'?'badge-blue':s.status==='reviewed'?'badge-green':s.status==='late'?'badge-red':'badge-gray'}`}>{s.status||'pending'}</span>
                  {s.status === 'submitted' && (
                    <button onClick={()=>onReview(s.student_id,'reviewed','')} style={{ padding:'4px 10px', borderRadius:20, border:'none', background:'var(--green)', color:'#fff', fontWeight:700, fontSize:11, cursor:'pointer' }}>✓</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function fileIcon(mime) {
  if (!mime) return '📎';
  if (mime.startsWith('image')) return '🖼️';
  if (mime.startsWith('video')) return '🎬';
  if (mime === 'application/pdf') return '📄';
  return '📎';
}
function formatSize(bytes) {
  if (!bytes) return '';
  return bytes > 1024*1024 ? `${(bytes/1024/1024).toFixed(1)}MB` : `${(bytes/1024).toFixed(0)}KB`;
}
