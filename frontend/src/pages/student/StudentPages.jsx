// src/pages/student/StudentPages.jsx — all remaining student pages

import { useEffect, useState } from 'react';
import { api } from '../../api';
import ChangePasswordOtp from '../../components/ChangePasswordOtp';

// ── RESULTS ───────────────────────────────────────────────────────
export function ResultsPage() {
  const [exams, setExams]     = useState([]);
  const [results, setResults] = useState([]);
  const [tab, setTab]         = useState('results');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getExams(), api.getResults()])
      .then(([e, r]) => { setExams(e.exams||[]); setResults(r.results||[]); })
      .finally(()=>setLoading(false));
  }, []);

  if (loading) return <div className="page"><div className="loading"><div className="spinner"/></div></div>;

  const avg = results.length ? Math.round(results.reduce((s,r) => s + (r.marks/r.total_marks*100), 0) / results.length) : 0;

  return (
    <div className="page">
      <div className="page-header"><div><div className="page-title">Examination</div><div className="page-subtitle">Your academic results</div></div></div>

      {results.length > 0 && (
        <div className="card" style={{ textAlign:'center', marginBottom:16, background:'linear-gradient(135deg,#1E3A8A,#2563EB)' }}>
          <div style={{ color:'rgba(255,255,255,0.7)', fontSize:13, fontWeight:600 }}>Overall Average</div>
          <div style={{ color:'#fff', fontSize:40, fontWeight:900 }}>{avg}%</div>
          <div style={{ color:'rgba(255,255,255,0.65)', fontSize:13 }}>{results.length} results recorded</div>
        </div>
      )}

      <div className="tab-bar">
        <button className={`tab-btn ${tab==='results'?'active':''}`} onClick={()=>setTab('results')}>Results</button>
        <button className={`tab-btn ${tab==='upcoming'?'active':''}`} onClick={()=>setTab('upcoming')}>Upcoming Exams</button>
      </div>

      {tab === 'results' && (
        <>
          {results.length === 0 && <div className="empty"><div className="empty-icon">📊</div><div className="empty-title">No results yet</div></div>}
          {results.map((r, i) => {
            const pct = Math.round(r.marks/r.total_marks*100);
            const color = pct>=80?'var(--green)':pct>=50?'var(--yellow)':'var(--red)';
            return (
              <div key={i} className="list-item">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div className="list-item-title">{r.subject}</div>
                    <div className="list-item-sub">{r.exam_type} • {r.exam_date}</div>
                    {r.remarks && <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>💬 {r.remarks}</div>}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontWeight:900, fontSize:22, color }}>{r.marks}/{r.total_marks}</div>
                    <span className="badge" style={{ background: pct>=80?'#dcfce7':pct>=50?'#fef9c3':'#fee2e2', color }}>{r.grade || computeGrade(r.marks,r.total_marks)}</span>
                  </div>
                </div>
                <div className="progress-bar" style={{ marginTop:10 }}>
                  <div className="progress-fill" style={{ width:`${pct}%`, background:color }} />
                </div>
              </div>
            );
          })}
        </>
      )}
      {tab === 'upcoming' && (
        <>
          {exams.length === 0 && <div className="empty"><div className="empty-icon">📅</div><div className="empty-title">No exams scheduled</div></div>}
          {exams.map(e => (
            <div key={e.id} className="list-item">
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <div><div className="list-item-title">{e.subject}</div><div className="list-item-sub">📅 {e.exam_date}</div></div>
                <span className="badge badge-yellow">{e.exam_type}</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── LEAVE ─────────────────────────────────────────────────────────
const LEAVE_TYPES = ['casual','medical','emergency','sick','family function','personal','excused','other'];
export function LeavePage() {
  const [requests, setRequests] = useState([]);
  const [form, setForm]         = useState({ reason:'', leave_type:'casual', from_date:'', to_date:'' });
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const load = () => api.getLeave().then(d=>setRequests(d.requests||[])).catch(()=>{}).finally(()=>setLoading(false));
  useEffect(()=>{ load(); }, []);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  async function submit() {
    setError(''); setSuccess(''); setSubmitting(true);
    try { await api.submitLeave(form); setSuccess('Leave request submitted!'); setForm({reason:'',leave_type:'casual',from_date:'',to_date:''}); load(); }
    catch(e) { setError(e.message); }
    setSubmitting(false);
  }

  return (
    <div className="page">
      <div className="page-header"><div><div className="page-title">Leave</div><div className="page-subtitle">Request & track leaves</div></div></div>
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontWeight:800, fontSize:15, marginBottom:14 }}>Apply for Leave</div>
        {error   && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <div className="input-wrap"><label>Leave Type</label><select value={form.leave_type} onChange={e=>set('leave_type',e.target.value)}>{LEAVE_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)} Leave</option>)}</select></div>
        <div className="input-wrap"><label>Reason</label><textarea placeholder="Describe your reason..." value={form.reason} onChange={e=>set('reason',e.target.value)} /></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div className="input-wrap"><label>From</label><input type="date" value={form.from_date} onChange={e=>set('from_date',e.target.value)} /></div>
          <div className="input-wrap"><label>To</label><input type="date" value={form.to_date} onChange={e=>set('to_date',e.target.value)} /></div>
        </div>
        <button className="btn btn-primary" onClick={submit} disabled={submitting}>{submitting?'Submitting...':'Submit Request'}</button>
      </div>
      <div className="section-header">My Requests</div>
      {loading && <div className="loading"><div className="spinner"/></div>}
      {!loading && requests.length===0 && <div className="empty"><div className="empty-icon">📋</div><div className="empty-title">No requests yet</div></div>}
      {requests.map(r => (
        <div key={r.id} className="list-item">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div><div className="list-item-title">{r.reason}</div><div className="list-item-sub">{r.leave_type} • {r.from_date} → {r.to_date}</div>{r.teacher_remark&&<div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>💬 {r.teacher_remark}</div>}</div>
            <span className={`badge ${r.status==='approved'?'badge-green':r.status==='rejected'?'badge-red':'badge-yellow'}`}>{r.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── MESSAGES ──────────────────────────────────────────────────────
export function MessagesPage() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{ api.getMessages().then(setData).catch(()=>{}).finally(()=>setLoading(false)); },[]);
  if (loading) return <div className="page"><div className="loading"><div className="spinner"/></div></div>;
  return (
    <div className="page">
      <div className="page-header"><div><div className="page-title">Messages</div><div className="page-subtitle">School notices & announcements</div></div></div>
      {data?.notices?.length===0 && <div className="empty"><div className="empty-icon">✉️</div><div className="empty-title">No notices yet</div></div>}
      {data?.notices?.map(n => (
        <div key={n.id} className="list-item">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
            <div className="list-item-title">{n.title}</div>
            <span className={`badge ${n.priority==='high'?'badge-red':'badge-blue'}`}>{n.target==='all'?'All':n.target}</span>
          </div>
          <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>{n.body}</div>
          <div style={{ fontSize:11, color:'var(--muted)', marginTop:8 }}>From {n.sender_name} • {n.created_at?.slice(0,10)}</div>
        </div>
      ))}
    </div>
  );
}

// ── CALENDAR ──────────────────────────────────────────────────────
const MONTHS_CAL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const TYPE_STYLE = { holiday:{bg:'#fee2e2',color:'#dc2626',icon:'🏖️'}, exam:{bg:'#fef9c3',color:'#a16207',icon:'📝'}, event:{bg:'#dbeafe',color:'#2563eb',icon:'🎉'}, general:{bg:'#f3f4f6',color:'#6b7280',icon:'📌'} };

export function CalendarPage() {
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewMonth, setViewMonth] = useState(() => { const d=new Date(); return {month:d.getMonth()+1,year:d.getFullYear()}; });

  useEffect(()=>{ api.getCalendar().then(d=>setEvents(d.events||[])).catch(()=>{}).finally(()=>setLoading(false)); },[]);

  const eventMap = {};
  events.forEach(e => { const key=e.event_date; if(!eventMap[key]) eventMap[key]=[]; eventMap[key].push(e); });

  const calDays = buildCalendar(viewMonth.year, viewMonth.month);
  const selectedEvents = selectedDate ? (eventMap[selectedDate]||[]) : [];

  if (loading) return <div className="page"><div className="loading"><div className="spinner"/></div></div>;

  return (
    <div className="page">
      <div className="page-header"><div><div className="page-title">Calendar</div><div className="page-subtitle">School events & schedule</div></div></div>
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <button onClick={()=>setViewMonth(m=>m.month===1?{month:12,year:m.year-1}:{month:m.month-1,year:m.year})} style={{background:'none',border:'none',cursor:'pointer',fontSize:22,color:'var(--text2)',padding:'4px 8px'}}>‹</button>
          <div style={{ fontWeight:800, fontSize:16 }}>{MONTHS_CAL[viewMonth.month-1]} {viewMonth.year}</div>
          <button onClick={()=>setViewMonth(m=>m.month===12?{month:1,year:m.year+1}:{month:m.month+1,year:m.year})} style={{background:'none',border:'none',cursor:'pointer',fontSize:22,color:'var(--text2)',padding:'4px 8px'}}>›</button>
        </div>
        <div className="cal-grid">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=><div key={d} style={{textAlign:'center',fontSize:11,fontWeight:700,color:'var(--muted)',paddingBottom:4}}>{d}</div>)}</div>
        <div className="cal-grid">
          {calDays.map((d,i) => {
            if (!d) return <div key={i}/>;
            const dateStr=`${viewMonth.year}-${String(viewMonth.month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const today=new Date(); const isToday=today.getFullYear()===viewMonth.year&&today.getMonth()+1===viewMonth.month&&today.getDate()===d;
            const hasEvent=!!eventMap[dateStr];
            return (
              <div key={i} className={`cal-day ${isToday?'today':''} ${hasEvent?'has-event':''}`}
                style={{background:selectedDate===dateStr?'var(--accent)':isToday?'var(--accent)':hasEvent?'var(--bg2)':'transparent',color:selectedDate===dateStr||isToday?'#fff':'var(--text)',fontSize:13}}
                onClick={()=>setSelectedDate(selectedDate===dateStr?null:dateStr)}>
                {d}
              </div>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <>
          <div className="section-header">{selectedDate}</div>
          {selectedEvents.length===0 && <div style={{color:'var(--muted)',fontSize:13,fontWeight:600,padding:'8px 0'}}>No events on this day</div>}
          {selectedEvents.map(e => { const s=TYPE_STYLE[e.event_type]||TYPE_STYLE.general; return (
            <div key={e.id} className="list-item" style={{display:'flex',gap:12,alignItems:'center'}}>
              <div style={{width:40,height:40,borderRadius:12,background:s.bg,color:s.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{s.icon}</div>
              <div><div className="list-item-title">{e.title}</div>{e.description&&<div className="list-item-sub">{e.description}</div>}</div>
            </div>
          ); })}
        </>
      )}

      <div className="section-header">Upcoming Events</div>
      {events.filter(e=>new Date(e.event_date)>=new Date()).slice(0,10).map(e => {
        const s=TYPE_STYLE[e.event_type]||TYPE_STYLE.general;
        return (
          <div key={e.id} className="list-item" style={{display:'flex',gap:12,alignItems:'center'}}>
            <div style={{width:40,height:40,borderRadius:12,background:s.bg,color:s.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{s.icon}</div>
            <div style={{flex:1}}>
              <div className="list-item-title">{e.title}</div>
              {e.description&&<div className="list-item-sub">{e.description}</div>}
              <div style={{fontSize:11,color:'var(--muted)',marginTop:3}}>📅 {e.event_date}</div>
            </div>
            <span className="badge" style={{background:s.bg,color:s.color}}>{e.event_type}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── TIMETABLE ─────────────────────────────────────────────────────
const DAY_COLORS = { Monday:'#2563EB',Tuesday:'#7C3AED',Wednesday:'#0891B2',Thursday:'#16A34A',Friday:'#E11D48',Saturday:'#D97706' };
export function TimetablePage() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{ api.getTimetable().then(setData).catch(()=>{}).finally(()=>setLoading(false)); },[]);
  if (loading) return <div className="page"><div className="loading"><div className="spinner"/></div></div>;
  const byDay = {};
  data?.timetable?.forEach(t=>{ if(!byDay[t.day]) byDay[t.day]=[]; byDay[t.day].push(t); });
  const today = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
  return (
    <div className="page">
      <div className="page-header"><div><div className="page-title">Timetable</div><div className="page-subtitle">Class: {data?.class||'Not assigned'}</div></div></div>
      {data?.message && <div className="alert alert-info">{data.message}</div>}
      {Object.keys(byDay).length===0 && <div className="empty"><div className="empty-icon">🕐</div><div className="empty-title">No timetable yet</div></div>}
      {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].filter(d=>byDay[d]).map(day => (
        <div key={day} style={{marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:13,color:DAY_COLORS[day]||'var(--text)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8,display:'flex',alignItems:'center',gap:8}}>
            {day} {day===today&&<span style={{fontSize:10,background:DAY_COLORS[day],color:'#fff',padding:'2px 8px',borderRadius:20}}>TODAY</span>}
          </div>
          {byDay[day].map(s=>(
            <div key={s.id} className="list-item" style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderLeft:`3px solid ${DAY_COLORS[day]||'var(--border)'}`}}>
              <div><div className="list-item-title">{s.subject}</div><div className="list-item-sub">{s.time_start} – {s.time_end}</div></div>
              {s.teacher_name&&<span style={{fontSize:12,color:'var(--muted)',fontWeight:600}}>{s.teacher_name}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────
const NOTIF_ICONS = { attendance:'📊', work:'📚', leave:'📋', fees:'💳', result:'🏆', exam:'📅', message:'✉️', general:'🔔' };
export function NotificationsPage() {
  const [notifs, setNotifs]   = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.getNotifications().then(d=>setNotifs(d.notifications||[])).catch(()=>{}).finally(()=>setLoading(false));
  useEffect(()=>{ load(); },[]);

  async function markAll() { await api.markAllRead().catch(()=>{}); load(); }
  async function markOne(id) { await api.markRead(id).catch(()=>{}); setNotifs(n=>n.map(x=>x.id===id?{...x,is_read:1}:x)); }

  if (loading) return <div className="page"><div className="loading"><div className="spinner"/></div></div>;
  const unread = notifs.filter(n=>!n.is_read).length;

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">Notifications</div><div className="page-subtitle">{unread} unread</div></div>
        {unread>0&&<button className="btn btn-ghost btn-sm" onClick={markAll}>Mark all read</button>}
      </div>
      {notifs.length===0&&<div className="empty"><div className="empty-icon">🔔</div><div className="empty-title">All caught up!</div></div>}
      {notifs.map(n=>(
        <div key={n.id} onClick={()=>!n.is_read&&markOne(n.id)} className="list-item"
          style={{opacity:n.is_read?0.6:1,borderLeft:`3px solid ${n.is_read?'var(--border)':'var(--accent)'}`,cursor:n.is_read?'default':'pointer'}}>
          <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
            <div style={{fontSize:24,flexShrink:0}}>{NOTIF_ICONS[n.type]||'🔔'}</div>
            <div style={{flex:1}}>
              <div className="list-item-title">{n.title}</div>
              <div className="list-item-sub" style={{marginTop:3}}>{n.body}</div>
              <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>{new Date(n.created_at).toLocaleString()}</div>
            </div>
            {!n.is_read&&<div style={{width:8,height:8,borderRadius:'50%',background:'var(--accent)',flexShrink:0,marginTop:6}}/>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── PROFILE ───────────────────────────────────────────────────────
export function ProfilePage({ user, onLogout, theme, toggleTheme }) {
  const [showChangePw, setShowChangePw] = useState(false);

  return (
    <div className="page">
      <div className="page-title" style={{ marginBottom:20 }}>Profile</div>

      {/* OTP Change Password overlay */}
      {showChangePw && <ChangePasswordOtp onClose={() => setShowChangePw(false)} />}

      {/* Avatar card */}
      <div style={{ background:'linear-gradient(135deg,#1E3A8A,#2563EB)', borderRadius:20, padding:28, color:'#fff', textAlign:'center', marginBottom:16 }}>
        {user?.photo_url
          ? <img src={user.photo_url} alt="" style={{ width:80, height:80, borderRadius:'50%', objectFit:'cover', border:'3px solid rgba(255,255,255,0.3)', marginBottom:12 }} />
          : <div style={{ fontSize:64, marginBottom:12 }}>🎓</div>}
        <div style={{ fontWeight:800, fontSize:20 }}>{user?.name}</div>
        <div style={{ opacity:0.65, fontSize:13, marginTop:4 }}>{user?.email}</div>
        <div style={{ marginTop:10, display:'inline-block', background:'rgba(255,255,255,0.15)', borderRadius:20, padding:'4px 16px', fontSize:12, fontWeight:700 }}>
          {user?.role?.toUpperCase()}
        </div>
      </div>

      {/* Info */}
      <div className="card" style={{ marginBottom:12 }}>
        {[['Class', user?.class || 'Not assigned'], ['Section', user?.section || 'N/A'], ['Grade', user?.grade || 'N/A']].map(([l, v]) => (
          <div key={l} className="settings-row">
            <span style={{ fontWeight:700, fontSize:14 }}>{l}</span>
            <span style={{ fontWeight:700, color:'var(--accent)' }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Appearance */}
      <div className="card" style={{ marginBottom:12 }}>
        <div style={{ fontWeight:800, fontSize:14, marginBottom:4 }}>Appearance</div>
        <div className="settings-row">
          <div>
            <div style={{ fontWeight:700, fontSize:14 }}>Dark Mode</div>
            <div style={{ fontSize:12, color:'var(--muted)' }}>Toggle dark / light theme</div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* Change Password */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="settings-row" style={{ cursor:'pointer' }} onClick={() => setShowChangePw(true)}>
          <div>
            <div style={{ fontWeight:700, fontSize:14 }}>🔐 Change Password</div>
            <div style={{ fontSize:12, color:'var(--muted)' }}>Verify with OTP sent to your email</div>
          </div>
          <span style={{ color:'var(--accent)', fontWeight:700, fontSize:20 }}>›</span>
        </div>
      </div>

      <button className="btn btn-red" onClick={onLogout}>Log Out</button>
    </div>
  );
}

// helpers
function buildCalendar(year, month) {
  const first = new Date(year, month-1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  return [...Array(first).fill(null), ...Array.from({length:days},(_,i)=>i+1)];
}
function computeGrade(marks, total) {
  const p=(marks/total)*100;
  return p>=90?'A+':p>=80?'A':p>=70?'B+':p>=60?'B':p>=50?'C':p>=40?'D':'F';
}
