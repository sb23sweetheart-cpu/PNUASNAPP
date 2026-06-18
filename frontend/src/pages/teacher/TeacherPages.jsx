// src/pages/teacher/TeacherPages.jsx — remaining teacher pages

import { useEffect, useState, useRef } from 'react';
import { api } from '../../api';
import ChangePasswordOtp from '../../components/ChangePasswordOtp';

// ── LEAVE ─────────────────────────────────────────────────────────
export function TeacherLeavePage() {
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [updating, setUpdating] = useState(null);
  const [remark,   setRemark]   = useState({});
  const [msg,      setMsg]      = useState('');

  const load = () => { setLoading(true); api.getClassLeave().then(d=>setRequests(d.requests||[])).catch(()=>{}).finally(()=>setLoading(false)); };
  useEffect(()=>{ load(); },[]);

  async function decide(id, status) {
    setUpdating(id);
    try {
      await api.updateLeave(id, { status, teacher_remark: remark[id]||'' });
      setMsg(`✅ Leave ${status}`);
      load();
    } catch(e) { setMsg('Error: '+e.message); }
    setUpdating(null);
    setTimeout(()=>setMsg(''),3000);
  }

  const pending  = requests.filter(r=>r.status==='pending');
  const resolved = requests.filter(r=>r.status!=='pending');

  if (loading) return <div className="page"><div className="loading"><div className="spinner"/></div></div>;

  return (
    <div className="page">
      <div className="page-header"><div><div className="page-title">Leave Requests</div><div className="page-subtitle">{pending.length} pending review</div></div></div>
      {msg && <div className={`alert ${msg.startsWith('Error')?'alert-error':'alert-success'}`}>{msg}</div>}

      <div className="section-header">Pending <span>{pending.length}</span></div>
      {pending.length===0 && <div style={{ color:'var(--muted)', fontSize:14, fontWeight:600, marginBottom:20 }}>🎉 No pending requests!</div>}
      {pending.map(r=>(
        <div key={r.id} className="card" style={{ marginBottom:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
            <div>
              <div style={{ fontWeight:800, fontSize:14 }}>{r.student_name}</div>
              <div style={{ fontSize:12, color:'var(--muted)' }}>{r.leave_type||'Casual'} Leave • {r.from_date} → {r.to_date}</div>
            </div>
            <span className="badge badge-yellow">pending</span>
          </div>
          <div style={{ background:'var(--bg2)', borderRadius:10, padding:'10px 12px', marginBottom:12, fontSize:13, color:'var(--text2)', fontStyle:'italic' }}>"{r.reason}"</div>
          <div className="input-wrap" style={{ marginBottom:10 }}>
            <label>Remark (optional)</label>
            <input placeholder="Add a remark..." value={remark[r.id]||''} onChange={e=>setRemark(prev=>({...prev,[r.id]:e.target.value}))} />
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>decide(r.id,'approved')} disabled={updating===r.id} className="btn btn-green" style={{ flex:1, padding:'10px' }}>{updating===r.id?'...':'✅ Approve'}</button>
            <button onClick={()=>decide(r.id,'rejected')} disabled={updating===r.id} className="btn btn-red"   style={{ flex:1, padding:'10px' }}>{updating===r.id?'...':'❌ Reject'}</button>
          </div>
        </div>
      ))}

      {resolved.length>0 && (
        <>
          <div className="section-header">History</div>
          {resolved.map(r=>(
            <div key={r.id} className="list-item">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div className="list-item-title">{r.student_name}</div>
                  <div className="list-item-sub">{r.from_date} → {r.to_date}</div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:2, fontStyle:'italic' }}>"{r.reason}"</div>
                  {r.teacher_remark && <div style={{ fontSize:12, color:'var(--accent)', marginTop:2 }}>💬 {r.teacher_remark}</div>}
                </div>
                <span className={`badge ${r.status==='approved'?'badge-green':'badge-red'}`}>{r.status}</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── EXAMS ─────────────────────────────────────────────────────────
const EXAM_TYPES = ['unit','midterm','final','practical','quiz'];
export function TeacherExamsPage() {
  const [tab,     setTab]     = useState('list');
  const [exams,   setExams]   = useState([]);
  const [students,setStudents]= useState([]);
  const [loading, setLoading] = useState(true);
  const [examForm,setExamForm]= useState({ subject:'', exam_date:'', exam_type:'unit', total_marks:100 });
  const [resultForm,setResultForm]= useState({ student_id:'', exam_id:'', marks:'', total_marks:'100', grade:'', remarks:'' });
  const [msg, setMsg]         = useState('');
  const [submitting,setSubmitting]=useState(false);

  const loadAllExams = () => api.getClassExams().then(d=>setExams(d.exams||[])).catch(()=>{});

  useEffect(()=>{
    Promise.all([loadAllExams(), api.getStudents().catch(()=>({students:[]}))])
      .then(([,s])=>setStudents(s.students||[]))
      .finally(()=>setLoading(false));
  },[]);

  const setE = (k,v) => setExamForm(f=>({...f,[k]:v}));
  const setR = (k,v) => setResultForm(f=>({...f,[k]:v}));

  async function addExam() {
    if (!examForm.subject||!examForm.exam_date) { setMsg('Subject and date required.'); return; }
    // Read teacher's class from saved user profile
    let teacherClass = '';
    try { teacherClass = JSON.parse(localStorage.getItem('pnu_user')||'{}').class || ''; } catch {}
    if (!teacherClass) { setMsg('Error: You have no class assigned. Ask admin to assign your class first.'); return; }
    setSubmitting(true);
    try {
      await api.addExam({ ...examForm, class: teacherClass });
      setMsg('✅ Exam added!');
      setExamForm({subject:'',exam_date:'',exam_type:'unit',total_marks:100});
      loadAllExams();
      setTab('list');
    }
    catch(e) { setMsg('Error: '+e.message); }
    setSubmitting(false); setTimeout(()=>setMsg(''),3000);
  }

  async function addResult() {
    if (!resultForm.student_id||!resultForm.exam_id||resultForm.marks==='') { setMsg('Student, exam and marks required.'); return; }
    setSubmitting(true);
    try { await api.addResult(resultForm); setMsg('✅ Result posted!'); setResultForm({student_id:'',exam_id:'',marks:'',total_marks:'100',grade:'',remarks:''}); }
    catch(e) { setMsg('Error: '+e.message); }
    setSubmitting(false); setTimeout(()=>setMsg(''),3000);
  }

  if (loading) return <div className="page"><div className="loading"><div className="spinner"/></div></div>;

  return (
    <div className="page">
      <div className="page-header"><div><div className="page-title">Examinations</div><div className="page-subtitle">Schedule exams & post results</div></div></div>

      <div className="tab-bar">
        <button className={`tab-btn ${tab==='list'?'active':''}`}    onClick={()=>setTab('list')}>Exams</button>
        <button className={`tab-btn ${tab==='add'?'active':''}`}     onClick={()=>setTab('add')}>+ Schedule</button>
        <button className={`tab-btn ${tab==='results'?'active':''}`} onClick={()=>setTab('results')}>Post Results</button>
      </div>

      {msg && <div className={`alert ${msg.startsWith('Error')?'alert-error':'alert-success'}`}>{msg}</div>}

      {tab==='list' && (
        <>
          {exams.length===0 && <div className="empty"><div className="empty-icon">📋</div><div className="empty-title">No exams scheduled</div></div>}
          {exams.map(e=>(
            <div key={e.id} className="list-item">
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <div><div className="list-item-title">{e.subject}</div><div className="list-item-sub">📅 {e.exam_date} • {e.total_marks} marks</div></div>
                <span className="badge badge-yellow">{e.exam_type}</span>
              </div>
            </div>
          ))}
        </>
      )}

      {tab==='add' && (
        <div className="card">
          <div style={{ fontWeight:800, fontSize:16, marginBottom:16 }}>Schedule Exam</div>
          <div className="input-wrap"><label>Subject *</label><input placeholder="e.g. Mathematics" value={examForm.subject} onChange={e=>setE('subject',e.target.value)} /></div>
          <div className="input-wrap"><label>Exam Date *</label><input type="date" value={examForm.exam_date} onChange={e=>setE('exam_date',e.target.value)} /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div className="input-wrap">
              <label>Type</label>
              <select value={examForm.exam_type} onChange={e=>setE('exam_type',e.target.value)}>
                {EXAM_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="input-wrap"><label>Total Marks</label><input type="number" value={examForm.total_marks} onChange={e=>setE('total_marks',parseInt(e.target.value))} /></div>
          </div>
          <button className="btn btn-primary" onClick={addExam} disabled={submitting}>{submitting?'Adding...':'Schedule Exam'}</button>
        </div>
      )}

      {tab==='results' && (
        <div className="card">
          <div style={{ fontWeight:800, fontSize:16, marginBottom:16 }}>Post Result</div>
          <div className="input-wrap">
            <label>Student *</label>
            <select value={resultForm.student_id} onChange={e=>setR('student_id',e.target.value)}>
              <option value="">Select student...</option>
              {students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="input-wrap">
            <label>Exam *</label>
            <select value={resultForm.exam_id} onChange={e=>setR('exam_id',e.target.value)}>
              <option value="">Select exam...</option>
              {exams.map(e=><option key={e.id} value={e.id}>{e.subject} — {e.exam_date}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div className="input-wrap"><label>Marks *</label><input type="number" placeholder="85" value={resultForm.marks} onChange={e=>setR('marks',e.target.value)} /></div>
            <div className="input-wrap"><label>Out of</label><input type="number" placeholder="100" value={resultForm.total_marks} onChange={e=>setR('total_marks',e.target.value)} /></div>
          </div>
          <div className="input-wrap"><label>Grade (auto-calculated if blank)</label><input placeholder="A+" value={resultForm.grade} onChange={e=>setR('grade',e.target.value)} /></div>
          <div className="input-wrap"><label>Remarks</label><input placeholder="Optional teacher remarks..." value={resultForm.remarks} onChange={e=>setR('remarks',e.target.value)} /></div>
          <button className="btn btn-primary" onClick={addResult} disabled={submitting}>{submitting?'Posting...':'Post Result'}</button>
        </div>
      )}
    </div>
  );
}

// ── CLASS RESULTS ─────────────────────────────────────────────────
export function TeacherResultsPage() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{ api.getClassResults().then(d=>setResults(d.results||[])).catch(()=>{}).finally(()=>setLoading(false)); },[]);
  if (loading) return <div className="page"><div className="loading"><div className="spinner"/></div></div>;
  return (
    <div className="page">
      <div className="page-header"><div><div className="page-title">Class Results</div><div className="page-subtitle">{results.length} results recorded</div></div></div>
      {results.length===0 && <div className="empty"><div className="empty-icon">📊</div><div className="empty-title">No results yet</div><div className="empty-sub">Post results from the Exams tab</div></div>}
      {results.map((r,i)=>{
        const pct=Math.round(r.marks/r.total_marks*100);
        const color=pct>=80?'var(--green)':pct>=50?'var(--yellow)':'var(--red)';
        return (
          <div key={i} className="list-item">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div><div className="list-item-title">{r.student_name}</div><div className="list-item-sub">{r.subject} • {r.exam_date} • {r.exam_type}</div></div>
              <div style={{ textAlign:'right' }}><div style={{ fontWeight:900, fontSize:20, color }}>{pct}%</div><div style={{ fontSize:12, color:'var(--muted)' }}>{r.marks}/{r.total_marks}</div></div>
            </div>
            <div className="progress-bar" style={{ marginTop:8 }}>
              <div className="progress-fill" style={{ width:`${pct}%`, background:color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── MESSAGES ──────────────────────────────────────────────────────
export function TeacherMessagesPage() {
  const [notices, setNotices] = useState([]);
  const [form, setForm]       = useState({ title:'', body:'', target:'all', priority:'normal' });
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [msg, setMsg]         = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const load = () => api.getMessages().then(d=>setNotices(d.notices||[])).catch(()=>{}).finally(()=>setLoading(false));
  useEffect(()=>{ load(); },[]);
  async function post() {
    if (!form.title||!form.body) { setMsg('Title and body required.'); return; }
    setPosting(true);
    try { await api.postMessage(form); setMsg('✅ Notice posted!'); setForm({title:'',body:'',target:'all',priority:'normal'}); load(); }
    catch(e) { setMsg('Error: '+e.message); }
    setPosting(false); setTimeout(()=>setMsg(''),3000);
  }
  async function del(id) { await api.deleteMessage(id).catch(()=>{}); load(); }

  return (
    <div className="page">
      <div className="page-header"><div><div className="page-title">Notices</div><div className="page-subtitle">Post school announcements</div></div></div>
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontWeight:800, fontSize:15, marginBottom:14 }}>Post Notice</div>
        {msg && <div className={`alert ${msg.startsWith('Error')?'alert-error':'alert-success'}`}>{msg}</div>}
        <div className="input-wrap"><label>Title</label><input placeholder="e.g. Exam postponed" value={form.title} onChange={e=>set('title',e.target.value)} /></div>
        <div className="input-wrap"><label>Message</label><textarea placeholder="Write your notice..." value={form.body} onChange={e=>set('body',e.target.value)} /></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div className="input-wrap"><label>Target</label><select value={form.target} onChange={e=>set('target',e.target.value)}><option value="all">All</option><option value="student">Students</option><option value="teacher">Teachers</option></select></div>
          <div className="input-wrap"><label>Priority</label><select value={form.priority} onChange={e=>set('priority',e.target.value)}><option value="normal">Normal</option><option value="high">High</option></select></div>
        </div>
        <button className="btn btn-primary" onClick={post} disabled={posting}>{posting?'Posting...':'📢 Post Notice'}</button>
      </div>
      {loading && <div className="loading"><div className="spinner"/></div>}
      {!loading && notices.length===0 && <div className="empty"><div className="empty-icon">✉️</div><div className="empty-title">No notices yet</div></div>}
      {notices.map(n=>(
        <div key={n.id} className="list-item">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
            <div className="list-item-title">{n.title}</div>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <span className={`badge ${n.priority==='high'?'badge-red':'badge-blue'}`}>{n.target}</span>
              <button onClick={()=>del(n.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:16 }}>🗑️</button>
            </div>
          </div>
          <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.5 }}>{n.body}</div>
          <div style={{ fontSize:11, color:'var(--muted)', marginTop:8 }}>{n.created_at?.slice(0,10)}</div>
        </div>
      ))}
    </div>
  );
}

// ── CALENDAR ──────────────────────────────────────────────────────
const TYPE_STYLE = { holiday:{bg:'#fee2e2',color:'#dc2626',icon:'🏖️'}, exam:{bg:'#fef9c3',color:'#a16207',icon:'📝'}, event:{bg:'#dbeafe',color:'#2563eb',icon:'🎉'}, general:{bg:'#f3f4f6',color:'#6b7280',icon:'📌'} };
export function TeacherCalendarPage() {
  const [events, setEvents] = useState([]);
  const [form,   setForm]   = useState({ title:'', description:'', event_date:'', end_date:'', event_type:'general' });
  const [loading,setLoading]= useState(true);
  const [adding, setAdding] = useState(false);
  const [msg,    setMsg]    = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const load = () => api.getCalendar().then(d=>setEvents(d.events||[])).catch(()=>{}).finally(()=>setLoading(false));
  useEffect(()=>{ load(); },[]);
  async function add() {
    if (!form.title||!form.event_date) { setMsg('Title and date required.'); return; }
    setAdding(true);
    try { await api.addCalendarEvent(form); setMsg('✅ Event added!'); setForm({title:'',description:'',event_date:'',end_date:'',event_type:'general'}); load(); }
    catch(e) { setMsg('Error: '+e.message); }
    setAdding(false); setTimeout(()=>setMsg(''),3000);
  }
  async function del(id) { await api.deleteEvent(id).catch(()=>{}); load(); }

  return (
    <div className="page">
      <div className="page-header"><div><div className="page-title">Calendar</div><div className="page-subtitle">Manage school events</div></div></div>
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontWeight:800, fontSize:15, marginBottom:14 }}>Add Event</div>
        {msg && <div className={`alert ${msg.startsWith('Error')?'alert-error':'alert-success'}`}>{msg}</div>}
        <div className="input-wrap"><label>Title *</label><input placeholder="e.g. Annual Sports Day" value={form.title} onChange={e=>set('title',e.target.value)} /></div>
        <div className="input-wrap"><label>Description</label><input placeholder="Optional details..." value={form.description} onChange={e=>set('description',e.target.value)} /></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div className="input-wrap"><label>Start Date *</label><input type="date" value={form.event_date} onChange={e=>set('event_date',e.target.value)} /></div>
          <div className="input-wrap"><label>End Date</label><input type="date" value={form.end_date} onChange={e=>set('end_date',e.target.value)} /></div>
        </div>
        <div className="input-wrap"><label>Type</label><select value={form.event_type} onChange={e=>set('event_type',e.target.value)}><option value="general">General</option><option value="holiday">Holiday</option><option value="exam">Exam</option><option value="event">Event</option></select></div>
        <button className="btn btn-primary" onClick={add} disabled={adding}>{adding?'Adding...':'Add Event'}</button>
      </div>
      {loading && <div className="loading"><div className="spinner"/></div>}
      {events.map(e=>{ const s=TYPE_STYLE[e.event_type]||TYPE_STYLE.general; return (
        <div key={e.id} className="list-item" style={{ display:'flex', gap:12, alignItems:'center' }}>
          <div style={{ width:40,height:40,borderRadius:12,background:s.bg,color:s.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0 }}>{s.icon}</div>
          <div style={{ flex:1 }}>
            <div className="list-item-title">{e.title}</div>
            {e.description&&<div className="list-item-sub">{e.description}</div>}
            <div style={{ fontSize:11,color:'var(--muted)',marginTop:2 }}>📅 {e.event_date}{e.end_date&&e.end_date!==e.event_date?` → ${e.end_date}`:''}</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end' }}>
            <span className="badge" style={{ background:s.bg, color:s.color }}>{e.event_type}</span>
            <button onClick={()=>del(e.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:16 }}>🗑️</button>
          </div>
        </div>
      ); })}
    </div>
  );
}

// ── TIMETABLE ─────────────────────────────────────────────────────
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_COLORS = { Monday:'#2563EB',Tuesday:'#7C3AED',Wednesday:'#0891B2',Thursday:'#16A34A',Friday:'#E11D48',Saturday:'#D97706' };
export function TeacherTimetablePage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState({ day:'Monday', subject:'', time_start:'', time_end:'' });
  const [msg,     setMsg]     = useState('');
  const [adding,  setAdding]  = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const load = () => api.getTimetable().then(setData).catch(()=>{}).finally(()=>setLoading(false));
  useEffect(()=>{ load(); },[]);
  async function add() {
    if (!form.subject||!form.time_start||!form.time_end) { setMsg('All fields required.'); return; }
    setAdding(true);
    try { await api.addTimetableSlot(form); setMsg('✅ Slot added!'); setForm({day:'Monday',subject:'',time_start:'',time_end:''}); load(); }
    catch(e) { setMsg('Error: '+e.message); }
    setAdding(false); setTimeout(()=>setMsg(''),3000);
  }
  async function del(id) { await api.deleteTimetable(id).catch(()=>{}); load(); }
  const byDay = {};
  data?.timetable?.forEach(t=>{ if(!byDay[t.day]) byDay[t.day]=[]; byDay[t.day].push(t); });
  if (loading) return <div className="page"><div className="loading"><div className="spinner"/></div></div>;
  return (
    <div className="page">
      <div className="page-header"><div><div className="page-title">Timetable</div><div className="page-subtitle">Class {data?.class||'–'}</div></div></div>
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontWeight:800, fontSize:15, marginBottom:14 }}>Add Slot</div>
        {msg && <div className={`alert ${msg.startsWith('Error')?'alert-error':'alert-success'}`}>{msg}</div>}
        <div className="input-wrap"><label>Day</label><select value={form.day} onChange={e=>set('day',e.target.value)}>{DAYS.map(d=><option key={d}>{d}</option>)}</select></div>
        <div className="input-wrap"><label>Subject</label><input placeholder="e.g. Mathematics" value={form.subject} onChange={e=>set('subject',e.target.value)} /></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div className="input-wrap"><label>Start Time</label><input type="time" value={form.time_start} onChange={e=>set('time_start',e.target.value)} /></div>
          <div className="input-wrap"><label>End Time</label><input type="time" value={form.time_end} onChange={e=>set('time_end',e.target.value)} /></div>
        </div>
        <button className="btn btn-primary" onClick={add} disabled={adding}>{adding?'Adding...':'Add Slot'}</button>
      </div>
      {Object.keys(byDay).length===0 && <div className="empty"><div className="empty-icon">🕐</div><div className="empty-title">No timetable yet</div></div>}
      {DAYS.filter(d=>byDay[d]).map(day=>(
        <div key={day} style={{ marginBottom:16 }}>
          <div style={{ fontWeight:800, fontSize:13, color:DAY_COLORS[day], textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>{day}</div>
          {byDay[day].map(s=>(
            <div key={s.id} className="list-item" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderLeft:`3px solid ${DAY_COLORS[day]}` }}>
              <div><div className="list-item-title">{s.subject}</div><div className="list-item-sub">{s.time_start} – {s.time_end}</div></div>
              <button onClick={()=>del(s.id)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:16 }}>🗑️</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── SEARCH ────────────────────────────────────────────────────────
export function SearchPage({ onNavigate }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  function search(q) {
    setQuery(q);
    clearTimeout(timer.current);
    if (!q.trim()) { setResults(null); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try { setResults(await api.searchTeacher(q)); } catch {}
      setLoading(false);
    }, 350);
  }

  return (
    <div className="page">
      <div className="page-header"><div><div className="page-title">Search</div></div></div>
      <div style={{ position:'relative', marginBottom:20 }}>
        <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16 }}>🔍</span>
        <input value={query} onChange={e => search(e.target.value)} placeholder="Search students, work, subjects…"
          style={{ paddingLeft:40 }} autoFocus />
      </div>
      {loading && <div className="loading" style={{ padding:'20px 0' }}><div className="spinner"/></div>}
      {results && !loading && (
        <>
          {results.students?.length > 0 && (
            <>
              <div className="section-header">👤 Students</div>
              {results.students.map(s => (
                <div key={s.id} className="list-item" style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer' }} onClick={() => onNavigate('t-students')}>
                  <div style={{ width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,var(--accent),var(--navy2))', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, flexShrink:0 }}>
                    {s.photo_url ? <img src={s.photo_url} style={{ width:38, height:38, borderRadius:'50%', objectFit:'cover' }} alt="" /> : s.name[0]}
                  </div>
                  <div>
                    <div className="list-item-title">{s.name}</div>
                    <div className="list-item-sub">Roll {s.roll_number} · Class {s.class}{s.section ? `-${s.section}` : ''}</div>
                  </div>
                </div>
              ))}
            </>
          )}
          {results.work?.length > 0 && (
            <>
              <div className="section-header">📚 Work</div>
              {results.work.map(w => (
                <div key={w.id} className="list-item" style={{ cursor:'pointer' }} onClick={() => onNavigate('t-work')}>
                  <div className="list-item-title">{w.title}</div>
                  <div className="list-item-sub">{w.work_type} · {w.subject} · Due: {w.due_date || 'N/A'}</div>
                </div>
              ))}
            </>
          )}
          {!results.students?.length && !results.work?.length && (
            <div className="empty"><div className="empty-icon">🔎</div><div className="empty-title">No results for "{query}"</div></div>
          )}
        </>
      )}
      {!results && !loading && (
        <div className="empty" style={{ paddingTop:20 }}>
          <div className="empty-icon">🔍</div>
          <div className="empty-title">Search anything</div>
          <div className="empty-sub">Students by name or roll number, or work by title</div>
        </div>
      )}
    </div>
  );
}

// ── ACTIVITY LOG ──────────────────────────────────────────────────
const ACTION_ICON = { 'Created work':'📝', 'Deleted work':'🗑️', 'Reviewed submission':'✅', 'Marked attendance':'📊', 'Updated fee':'💳', 'Added exam':'📅', 'Published result':'🏆' };

export function ActivityLogPage() {
  const [log, setLog]         = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getActivityLog().then(d => setLog(d.log || [])).finally(() => setLoading(false));
  }, []);

  function fmt(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) + ' · ' +
           d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
  }

  if (loading) return <div className="page"><div className="loading"><div className="spinner"/></div></div>;

  return (
    <div className="page">
      <div className="page-header"><div><div className="page-title">Activity Log</div><div className="page-subtitle">{log.length} actions recorded</div></div></div>
      {log.length === 0 && <div className="empty"><div className="empty-icon">📋</div><div className="empty-title">No activity yet</div></div>}
      {log.map((entry, i) => (
        <div key={entry.id} className="list-item" style={{ borderLeft:`3px solid var(--accent)` }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
            <div style={{ fontSize:20, flexShrink:0 }}>{ACTION_ICON[entry.action] || '🔹'}</div>
            <div style={{ flex:1 }}>
              <div className="list-item-title">{entry.action}</div>
              {entry.detail && <div className="list-item-sub">{entry.detail}</div>}
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>🕐 {fmt(entry.created_at)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── SETTINGS ──────────────────────────────────────────────────────
export function SettingsPage({ theme, toggleTheme, onLogout }) {
  const [notifPrefs, setNotifPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pnu_notif_prefs')||'{}'); } catch { return {}; }
  });
  function toggleNotif(key) {
    setNotifPrefs(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('pnu_notif_prefs', JSON.stringify(updated));
      return updated;
    });
  }

  const notifSettings = [
    { key:'messages',  label:'Message Notifications',  sub:'Get notified for new notices' },
    { key:'work',      label:'Homework Notifications',  sub:'New homework & assignments' },
    { key:'fees',      label:'Fee Alerts',               sub:'Fee due dates & payments' },
    { key:'leave',     label:'Leave Updates',            sub:'Approve/reject notifications' },
    { key:'results',   label:'Result Alerts',            sub:'When marks are published' },
  ];

  return (
    <div className="page">
      <div className="page-title" style={{ marginBottom:20 }}>Settings</div>

      {/* Appearance */}
      <div style={{ fontWeight:800, fontSize:12, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Appearance</div>
      <div className="card" style={{ marginBottom:16 }}>
        <div className="settings-row">
          <div><div style={{ fontWeight:700, fontSize:14 }}>Dark Mode</div><div style={{ fontSize:12, color:'var(--muted)' }}>Switch to dark theme</div></div>
          <label className="toggle"><input type="checkbox" checked={theme==='dark'} onChange={toggleTheme}/><span className="toggle-slider"/></label>
        </div>
        <div className="settings-row">
          <div><div style={{ fontWeight:700, fontSize:14 }}>App Theme</div><div style={{ fontSize:12, color:'var(--muted)' }}>{theme==='dark'?'Dark':'Light'} mode active</div></div>
          <span style={{ fontSize:20 }}>{theme==='dark'?'🌙':'☀️'}</span>
        </div>
      </div>

      {/* Notifications */}
      <div style={{ fontWeight:800, fontSize:12, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Notifications</div>
      <div className="card" style={{ marginBottom:16 }}>
        {notifSettings.map(n=>(
          <div key={n.key} className="settings-row">
            <div><div style={{ fontWeight:700, fontSize:14 }}>{n.label}</div><div style={{ fontSize:12, color:'var(--muted)' }}>{n.sub}</div></div>
            <label className="toggle"><input type="checkbox" checked={notifPrefs[n.key]!==false} onChange={()=>toggleNotif(n.key)}/><span className="toggle-slider"/></label>
          </div>
        ))}
      </div>

      {/* Account */}
      <div style={{ fontWeight:800, fontSize:12, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Account</div>
      <div className="card" style={{ marginBottom:16 }}>
        <div className="settings-row" style={{ cursor:'pointer' }}>
          <div><div style={{ fontWeight:700, fontSize:14 }}>Change Password</div><div style={{ fontSize:12, color:'var(--muted)' }}>Use OTP sent to your email</div></div>
          <span style={{ color:'var(--accent)', fontWeight:700 }}>→</span>
        </div>
      </div>

      <button className="btn btn-red" onClick={onLogout}>Log Out</button>
    </div>
  );
}

// ── TEACHER PROFILE ───────────────────────────────────────────────
export function TeacherProfilePage({ user, onLogout, theme, toggleTheme, onUserUpdate, onNavigate }) {
  const [editing,      setEditing]      = useState(false);
  const [cls,          setCls]          = useState(user?.class   || '');
  const [section,      setSection]      = useState(user?.section || '');
  const [saving,       setSaving]       = useState(false);
  const [msg,          setMsg]          = useState('');
  const [showChangePw, setShowChangePw] = useState(false);

  async function saveProfile() {
    if (!cls.trim()) { setMsg('Please enter your class (e.g. 10).'); return; }
    if (section && !/^[a-zA-Z]+$/.test(section.trim())) { setMsg('Section must be letters only (e.g. A, B).'); return; }
    setSaving(true); setMsg('');
    try {
      await api.updateMyProfile({ class: cls.trim(), section: section.trim() });
      const stored  = JSON.parse(localStorage.getItem('pnu_user') || '{}');
      const updated = { ...stored, class: cls.trim(), section: section.trim() };
      localStorage.setItem('pnu_user', JSON.stringify(updated));
      if (onUserUpdate) onUserUpdate(updated);
      setMsg('✅ Profile saved!');
      setEditing(false);
    } catch (e) { setMsg('Error: ' + e.message); }
    setSaving(false);
  }

  const currentClass = (() => {
    try { return JSON.parse(localStorage.getItem('pnu_user') || '{}').class || user?.class || ''; } catch { return user?.class || ''; }
  })();

  return (
    <div className="page">
      {/* OTP Change Password overlay */}
      {showChangePw && <ChangePasswordOtp onClose={() => setShowChangePw(false)} />}

      <div className="page-title" style={{ marginBottom:20 }}>My Profile</div>

      {/* Avatar */}
      <div style={{ background:'linear-gradient(135deg,#1E3A8A,#7C3AED)', borderRadius:20, padding:28, color:'#fff', textAlign:'center', marginBottom:16 }}>
        <div style={{ fontSize:64, marginBottom:12 }}>👩‍🏫</div>
        <div style={{ fontWeight:800, fontSize:20 }}>{user?.name}</div>
        <div style={{ opacity:0.65, fontSize:13, marginTop:4 }}>{user?.email}</div>
        <div style={{ marginTop:10, display:'inline-block', background:'rgba(255,255,255,0.15)', borderRadius:20, padding:'4px 16px', fontSize:12, fontWeight:700 }}>TEACHER</div>
      </div>

      {msg && <div className={`alert ${msg.startsWith('Error') ? 'alert-error' : 'alert-success'}`}>{msg}</div>}

      {/* Class assignment */}
      <div className="card" style={{ marginBottom:12, borderLeft: !currentClass ? '3px solid var(--red)' : '3px solid var(--green)' }}>
        <div style={{ fontWeight:800, fontSize:15, marginBottom:4 }}>
          {currentClass ? '✅ Class Assigned' : '⚠️ No Class Assigned'}
        </div>
        <div style={{ fontSize:13, color:'var(--muted)', marginBottom:14 }}>
          {currentClass
            ? `Class ${currentClass}${section ? ` · Section ${section}` : ''}. Work, exams and attendance use this class.`
            : 'Set your class before creating work, exams or marking attendance.'}
        </div>
        {!editing ? (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--muted)' }}>Class</span>
              <span style={{ fontWeight:800, color: currentClass ? 'var(--accent)' : 'var(--red)' }}>{currentClass || 'Not set'}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--muted)' }}>Section</span>
              <span style={{ fontWeight:800, color:'var(--accent)' }}>{section || '—'}</span>
            </div>
            <button className="btn btn-primary" onClick={() => setEditing(true)}>
              ✏️ {currentClass ? 'Edit Class' : 'Set My Class'}
            </button>
          </>
        ) : (
          <div>
            <div className="input-wrap">
              <label>Class * (e.g. 10, 9, Grade 5)</label>
              <input
                placeholder="Enter your class e.g. 10"
                value={cls}
                onChange={e => setCls(e.target.value)}
                autoFocus
              />
            </div>
            <div className="input-wrap">
              <label>Section — letters only (e.g. A, B, C)</label>
              <input
                placeholder="e.g. A"
                value={section}
                maxLength={3}
                onChange={e => {
                  // Strip out anything that is not a letter
                  const lettersOnly = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
                  setSection(lettersOnly);
                }}
              />
              {section && !/^[a-zA-Z]+$/.test(section) && (
                <div style={{ fontSize:12, color:'var(--red)', marginTop:4, fontWeight:600 }}>
                  Section must be letters only (e.g. A, B)
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary" onClick={saveProfile} disabled={saving} style={{ flex:1 }}>
                {saving ? 'Saving...' : '💾 Save'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setEditing(false); setMsg(''); }} style={{ flex:1 }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Change Password */}
      <div className="card" style={{ marginBottom:12 }}>
        <div className="settings-row" style={{ cursor:'pointer' }} onClick={() => setShowChangePw(true)}>
          <div>
            <div style={{ fontWeight:700, fontSize:14 }}>🔐 Change Password</div>
            <div style={{ fontSize:12, color:'var(--muted)' }}>Verify with OTP sent to your email</div>
          </div>
          <span style={{ color:'var(--accent)', fontWeight:700, fontSize:20 }}>›</span>
        </div>
      </div>

      {/* Theme */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontWeight:800, fontSize:14, marginBottom:2 }}>Appearance</div>
        <div className="settings-row">
          <div><div style={{ fontWeight:700, fontSize:14 }}>Dark Mode</div></div>
          <label className="toggle">
            <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {onNavigate && (
        <button className="btn btn-ghost" onClick={() => onNavigate('t-activity')} style={{ marginBottom:10 }}>
          📋 View Activity Log
        </button>
      )}

      <button className="btn btn-red" onClick={onLogout}>Log Out</button>
    </div>
  );
}
