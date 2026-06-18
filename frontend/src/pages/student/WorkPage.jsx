// src/pages/student/WorkPage.jsx
import { useEffect, useState } from 'react';
import { api, resolveFileUrl } from '../../api';

function downloadWithProgress(url, filename, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'blob';
    xhr.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(xhr.response);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        resolve();
      } else reject(new Error('Download failed'));
    };
    xhr.onerror = () => {
      // Fallback: open in new tab (e.g. Cloudinary CORS)
      window.open(url, '_blank');
      resolve();
    };
    xhr.send();
  });
}

const TYPE_COLORS = {
  homework:   { bg:'#EFF6FF', color:'#2563EB', icon:'📖' },
  assignment: { bg:'#FFF7ED', color:'#F97316', icon:'📝' },
};

export default function WorkPage() {
  const [work, setWork]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [submitting, setSubmitting] = useState(null);
  const [msg, setMsg]         = useState('');
  const [downloadProgress, setDownloadProgress] = useState({}); // { attachmentId: 0-100 }

  async function handleDownload(e, a) {
    e.preventDefault();
    const url = resolveFileUrl(a.file_url);
    setDownloadProgress(p => ({ ...p, [a.id]: 0 }));
    try {
      await downloadWithProgress(url, a.file_name, (pct) =>
        setDownloadProgress(p => ({ ...p, [a.id]: pct }))
      );
    } catch {}
    setTimeout(() => setDownloadProgress(p => { const n = {...p}; delete n[a.id]; return n; }), 1000);
  }

  const load = () => {
    setLoading(true);
    api.getWork().then(d => setWork(d.work||[])).catch(()=>{}).finally(()=>setLoading(false));
  };
  useEffect(() => { load(); }, []);

  async function handleSubmit(id) {
    setSubmitting(id);
    try {
      const r = await api.submitWork(id);
      setMsg(r.isLate ? '⚠️ Submitted (Late)' : '✅ Submitted successfully!');
      load();
    } catch (e) { setMsg('Error: ' + e.message); }
    setSubmitting(null);
    setTimeout(() => setMsg(''), 3000);
  }

  const filtered = tab === 'all' ? work
    : tab === 'pending' ? work.filter(w => !w.submission || w.submission.status === 'pending')
    : work.filter(w => w.submission && ['submitted','reviewed','late'].includes(w.submission.status));

  const homework   = filtered.filter(w => w.work_type === 'homework');
  const assignment = filtered.filter(w => w.work_type === 'assignment');

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /></div></div>;

  const pending  = work.filter(w => !w.submission || w.submission.status === 'pending').length;
  const due_soon = work.filter(w => {
    const diff = (new Date(w.due_date) - new Date()) / (1000*60*60*24);
    return diff >= 0 && diff <= 2 && (!w.submission || w.submission.status === 'pending');
  }).length;

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">Work</div><div className="page-subtitle">Homework & Assignments</div></div>
      </div>

      {msg && <div className={`alert ${msg.startsWith('Error')?'alert-error':'alert-success'}`}>{msg}</div>}

      {/* Summary cards */}
      <div className="stats-grid" style={{ marginBottom:16 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background:'#FFF7ED', color:'#F97316' }}>📋</div>
          <div><div className="stat-value" style={{ color:'#F97316' }}>{pending}</div><div className="stat-label">Pending</div></div>
        </div>
        <div className="stat-card" onClick={()=>setTab('pending')} style={{ cursor:'pointer' }}>
          <div className="stat-icon" style={{ background:'#FEF2F2', color:'#DC2626' }}>⏰</div>
          <div><div className="stat-value" style={{ color:'#DC2626' }}>{due_soon}</div><div className="stat-label">Due Soon</div></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab-btn ${tab==='all'?'active':''}`} onClick={()=>setTab('all')}>All</button>
        <button className={`tab-btn ${tab==='pending'?'active':''}`} onClick={()=>setTab('pending')}>Pending</button>
        <button className={`tab-btn ${tab==='done'?'active':''}`} onClick={()=>setTab('done')}>Done</button>
      </div>

      {filtered.length === 0 && (
        <div className="empty"><div className="empty-icon">🎉</div><div className="empty-title">All clear!</div><div className="empty-sub">No work in this category</div></div>
      )}

      {/* Homework section */}
      {homework.length > 0 && (
        <>
          <div className="section-header">📖 Homework <span>{homework.length}</span></div>
          {homework.map(w => <WorkCard key={w.id} w={w} expanded={expanded} setExpanded={setExpanded} onSubmit={handleSubmit} submitting={submitting} downloadProgress={downloadProgress} onDownload={handleDownload} />)}
        </>
      )}

      {/* Assignment section */}
      {assignment.length > 0 && (
        <>
          <div className="section-header">📝 Assignments <span>{assignment.length}</span></div>
          {assignment.map(w => <WorkCard key={w.id} w={w} expanded={expanded} setExpanded={setExpanded} onSubmit={handleSubmit} submitting={submitting} downloadProgress={downloadProgress} onDownload={handleDownload} />)}
        </>
      )}
    </div>
  );
}

function WorkCard({ w, expanded, setExpanded, onSubmit, submitting, downloadProgress, onDownload }) {
  const isExp = expanded === w.id;
  const tc = TYPE_COLORS[w.work_type] || TYPE_COLORS.homework;
  const due = new Date(w.due_date);
  const now = new Date();
  const daysLeft = Math.ceil((due - now) / (1000*60*60*24));
  const isOverdue = daysLeft < 0;
  const subStatus = w.submission?.status;

  const statusBadge = () => {
    if (!subStatus || subStatus === 'pending') return isOverdue ? <span className="badge badge-red">Overdue</span> : <span className="badge badge-yellow">Pending</span>;
    if (subStatus === 'submitted') return <span className="badge badge-blue">Submitted</span>;
    if (subStatus === 'reviewed')  return <span className="badge badge-green">Reviewed</span>;
    if (subStatus === 'late')      return <span className="badge badge-red">Late</span>;
    return null;
  };

  return (
    <div className="card" style={{ marginBottom:10, borderLeft: w.is_important ? '3px solid var(--red)' : '3px solid transparent' }}>
      <div className="expandable-header" onClick={()=>setExpanded(isExp ? null : w.id)}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <span style={{ fontSize:18 }}>{tc.icon}</span>
            <div style={{ fontWeight:700, fontSize:14 }}>{w.title}</div>
            {w.is_important && <span style={{ fontSize:10, background:'#fee2e2', color:'#dc2626', padding:'1px 6px', borderRadius:20, fontWeight:800 }}>IMPORTANT</span>}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <span className="badge badge-gray" style={{ fontSize:11 }}>{w.subject}</span>
            {statusBadge()}
            <span style={{ fontSize:11, color: isOverdue ? 'var(--red)' : daysLeft <= 2 ? 'var(--yellow)' : 'var(--muted)', fontWeight:600 }}>
              {isOverdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today!' : `${daysLeft}d left`}
            </span>
          </div>
        </div>
        <span className="expand-icon">{isExp ? '▲' : '▼'}</span>
      </div>

      <div className={`expandable-body ${isExp ? 'open' : ''}`}>
        <div className="divider" />
        <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6, marginBottom:12 }}>{w.description}</div>
        {w.instructions && (
          <div style={{ background:'var(--bg2)', borderRadius:10, padding:'10px 12px', marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:4 }}>INSTRUCTIONS</div>
            <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.5 }}>{w.instructions}</div>
          </div>
        )}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
          <span style={{ fontSize:12, color:'var(--muted)', fontWeight:600 }}>📅 Due: {w.due_date}</span>
          <span style={{ fontSize:12, color:'var(--muted)', fontWeight:600 }}>👤 {w.teacher_name}</span>
        </div>
        {/* Attachments */}
        {w.attachments?.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:2 }}>ATTACHMENTS</div>
            {w.attachments.map(a => {
              const pct = downloadProgress?.[a.id];
              const isDownloading = pct !== undefined;
              return (
                <div key={a.id}>
                  <a href={resolveFileUrl(a.file_url)} onClick={(e) => onDownload(e, a)} className="file-chip" style={{ marginBottom: isDownloading ? 4 : 0 }}>
                    {fileIcon(a.file_type)} {a.file_name}
                    <span style={{ marginLeft:'auto', fontSize:11, color:'var(--muted)' }}>
                      {isDownloading ? `${pct}%` : formatSize(a.file_size)}
                    </span>
                  </a>
                  {isDownloading && (
                    <div style={{ background:'var(--border)', borderRadius:99, height:5, overflow:'hidden', marginBottom:4 }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:'var(--accent)', borderRadius:99, transition:'width 0.2s ease' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {/* Submit button */}
        {(!subStatus || subStatus === 'pending') && (
          <button className="btn btn-primary btn-sm" style={{ width:'100%' }} onClick={()=>onSubmit(w.id)} disabled={submitting===w.id}>
            {submitting===w.id ? 'Submitting...' : '✅ Mark as Submitted'}
          </button>
        )}
        {w.submission?.remark && (
          <div style={{ marginTop:10, background:'var(--bg2)', borderRadius:10, padding:'10px 12px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:3 }}>TEACHER REMARK</div>
            <div style={{ fontSize:13, color:'var(--text2)' }}>{w.submission.remark}</div>
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
  if (bytes > 1024*1024) return `${(bytes/1024/1024).toFixed(1)} MB`;
  return `${(bytes/1024).toFixed(0)} KB`;
}
