// src/pages/teacher/TeacherAttendancePage.jsx
import { useEffect, useState } from 'react';
import { api } from '../../api';

const LEAVE_REASONS = ['Medical Leave','Casual Leave','Emergency Leave','Sick Leave','Family Function Leave','Personal Leave','Excused Leave','Other'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function TeacherAttendancePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab]           = useState('mark');
  const [date, setDate]         = useState(today);
  const [students, setStudents] = useState([]);
  const [attendance, setAtt]    = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(); return { month: d.getMonth()+1, year: d.getFullYear() }; });
  const [reportRecords, setReportRecords] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  // Load students once
  useEffect(() => {
    api.getStudents()
      .then(d => {
        const list = d.students || [];
        setStudents(list);
        const def = {};
        list.forEach(s => { def[s.id] = { status: 'present', is_late: false, leave_reason: '' }; });
        setAtt(def);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load existing attendance when date changes
  useEffect(() => {
    if (!date) return;
    const p = `date=${date}`;
    api.getClassAttendance(p).then(d => {
      if (d.records?.length > 0) {
        setAtt(prev => {
          const updated = { ...prev };
          d.records.forEach(r => {
            updated[r.student_id] = {
              status: r.status,
              is_late: !!r.is_late,
              leave_reason: r.leave_reason || '',
            };
          });
          return updated;
        });
      }
    }).catch(() => {});
  }, [date]);

  // Load monthly report
  useEffect(() => {
    if (tab !== 'report') return;
    setReportLoading(true);
    const p = `month=${viewMonth.month}&year=${viewMonth.year}`;
    api.getClassAttendance(p)
      .then(d => setReportRecords(d.records || []))
      .catch(() => {})
      .finally(() => setReportLoading(false));
  }, [tab, viewMonth]);

  function setField(id, key, val) {
    setAtt(prev => ({ ...prev, [id]: { ...prev[id], [key]: val } }));
  }

  async function saveAll() {
    setSaving(true); setMsg('');
    try {
      const records = students.map(s => ({
        student_id: s.id,
        status: attendance[s.id]?.status || 'present',
        is_late: attendance[s.id]?.is_late || false,
        leave_reason: attendance[s.id]?.leave_reason || null,
      }));
      await api.saveAttendance({ date, records });
      setMsg('✅ Attendance saved successfully!');
    } catch (e) { setMsg('Error: ' + e.message); }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  }

  function markAll(status) {
    setAtt(prev => {
      const updated = { ...prev };
      students.forEach(s => { updated[s.id] = { ...updated[s.id], status }; });
      return updated;
    });
  }

  const presentCount = Object.values(attendance).filter(v => v.status === 'present').length;
  const absentCount  = students.length - presentCount;
  const lateCount    = Object.values(attendance).filter(v => v.is_late).length;

  // Report summary
  const reportByStudent = {};
  reportRecords.forEach(r => {
    if (!reportByStudent[r.student_id]) reportByStudent[r.student_id] = { name: r.student_name, roll: r.roll_number, total: 0, present: 0, late: 0 };
    reportByStudent[r.student_id].total++;
    if (r.status === 'present') reportByStudent[r.student_id].present++;
    if (r.is_late) reportByStudent[r.student_id].late++;
  });

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /></div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">Attendance</div><div className="page-subtitle">Mark & manage class attendance</div></div>
      </div>

      <div className="tab-bar">
        <button className={`tab-btn ${tab==='mark'?'active':''}`}   onClick={()=>setTab('mark')}>Mark</button>
        <button className={`tab-btn ${tab==='report'?'active':''}`} onClick={()=>setTab('report')}>Report</button>
      </div>

      {/* ── MARK TAB ── */}
      {tab === 'mark' && (
        <>
          {/* Date picker */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="input-wrap" style={{ marginBottom: 0 }}>
              <label>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} max={today} />
            </div>
          </div>

          {/* Summary bar */}
          <div style={{ background:'linear-gradient(135deg,#2563EB,#0891B2)', borderRadius:14, padding:'14px 18px', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontWeight:900, fontSize:22 }}>{presentCount}</div>
              <div style={{ fontSize:11, opacity:0.75 }}>Present</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontWeight:900, fontSize:22 }}>{absentCount}</div>
              <div style={{ fontSize:11, opacity:0.75 }}>Absent</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontWeight:900, fontSize:22 }}>{lateCount}</div>
              <div style={{ fontSize:11, opacity:0.75 }}>Late</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontWeight:900, fontSize:22 }}>{students.length > 0 ? Math.round((presentCount/students.length)*100) : 0}%</div>
              <div style={{ fontSize:11, opacity:0.75 }}>Rate</div>
            </div>
          </div>

          {/* Quick mark all */}
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <button className="btn btn-green btn-sm" style={{ flex:1 }} onClick={()=>markAll('present')}>✅ All Present</button>
            <button className="btn btn-red btn-sm"   style={{ flex:1 }} onClick={()=>markAll('absent')}>❌ All Absent</button>
          </div>

          {msg && <div className={`alert ${msg.startsWith('Error')?'alert-error':'alert-success'}`}>{msg}</div>}

          {students.length === 0 && <div className="empty"><div className="empty-icon">🎓</div><div className="empty-title">No students in your class</div></div>}

          {students.map(s => {
            const att = attendance[s.id] || { status:'present', is_late:false, leave_reason:'' };
            const isPresent = att.status === 'present';
            return (
              <div key={s.id} className="card" style={{ marginBottom:8, borderLeft:`3px solid ${isPresent?'var(--green)':'var(--red)'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    {s.photo_url
                      ? <img src={s.photo_url} alt="" style={{ width:40,height:40,borderRadius:'50%',objectFit:'cover' }} />
                      : <div style={{ width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,#2563EB,#7C3AED)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800 }}>{s.name?.charAt(0)}</div>}
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>{s.name}</div>
                      <div style={{ fontSize:11, color:'var(--muted)' }}>Roll {s.roll_number||'–'}</div>
                    </div>
                  </div>
                  {/* Present / Absent toggle */}
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={()=>setField(s.id,'status','present')} style={{ padding:'7px 14px', borderRadius:20, border:'none', cursor:'pointer', fontWeight:800, fontSize:12, background: isPresent?'var(--green)':'var(--bg2)', color: isPresent?'#fff':'var(--muted)', transition:'all 0.2s' }}>P</button>
                    <button onClick={()=>setField(s.id,'status','absent')} style={{ padding:'7px 14px', borderRadius:20, border:'none', cursor:'pointer', fontWeight:800, fontSize:12, background: !isPresent?'var(--red)':'var(--bg2)', color: !isPresent?'#fff':'var(--muted)', transition:'all 0.2s' }}>A</button>
                  </div>
                </div>

                {/* Late checkbox */}
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13, fontWeight:600, color:'var(--text2)' }}>
                    <input type="checkbox" checked={!!att.is_late} onChange={e=>setField(s.id,'is_late',e.target.checked)}
                      style={{ width:16, height:16, accentColor:'var(--yellow)', cursor:'pointer' }} />
                    ⏰ Late
                  </label>
                </div>

                {/* Leave reason (only when absent) */}
                {!isPresent && (
                  <div style={{ marginTop:10 }}>
                    <select value={att.leave_reason||''} onChange={e=>setField(s.id,'leave_reason',e.target.value)}
                      style={{ fontSize:13, padding:'9px 12px' }}>
                      <option value="">Select leave reason...</option>
                      {LEAVE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                )}
              </div>
            );
          })}

          {students.length > 0 && (
            <button className="btn btn-primary" onClick={saveAll} disabled={saving} style={{ marginTop:8 }}>
              {saving ? 'Saving...' : '💾 Save Attendance'}
            </button>
          )}
        </>
      )}

      {/* ── REPORT TAB ── */}
      {tab === 'report' && (
        <>
          {/* Month navigation */}
          <div className="card" style={{ marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <button onClick={()=>setViewMonth(m=>m.month===1?{month:12,year:m.year-1}:{month:m.month-1,year:m.year})} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22,color:'var(--text2)',padding:'4px 10px' }}>‹</button>
              <div style={{ fontWeight:800, fontSize:15 }}>{MONTHS[viewMonth.month-1]} {viewMonth.year}</div>
              <button onClick={()=>setViewMonth(m=>m.month===12?{month:1,year:m.year+1}:{month:m.month+1,year:m.year})} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22,color:'var(--text2)',padding:'4px 10px' }}>›</button>
            </div>
          </div>

          {reportLoading && <div className="loading"><div className="spinner" /></div>}

          {!reportLoading && Object.keys(reportByStudent).length === 0 && (
            <div className="empty"><div className="empty-icon">📊</div><div className="empty-title">No attendance records this month</div></div>
          )}

          {!reportLoading && Object.entries(reportByStudent).map(([id, s]) => {
            const pct = s.total > 0 ? Math.round((s.present/s.total)*100) : 0;
            const color = pct>=75?'var(--green)':pct>=50?'var(--yellow)':'var(--red)';
            return (
              <div key={id} className="list-item">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div className="list-item-title">{s.name}</div>
                    <div className="list-item-sub">Roll {s.roll||'–'} • {s.present}/{s.total} days present {s.late>0?`• ${s.late} late`:''}</div>
                  </div>
                  <div style={{ fontWeight:900, fontSize:20, color }}>{pct}%</div>
                </div>
                <div className="progress-bar" style={{ marginTop:8 }}>
                  <div className="progress-fill" style={{ width:`${pct}%`, background:color }} />
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
