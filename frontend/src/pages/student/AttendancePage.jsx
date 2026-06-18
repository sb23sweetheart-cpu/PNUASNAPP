// src/pages/student/AttendancePage.jsx
import { useEffect, useState } from 'react';
import { api } from '../../api';

const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function AttendancePage() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState('summary');
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(); return { month: d.getMonth()+1, year: d.getFullYear() };
  });

  useEffect(() => { api.getAttendance().then(setData).catch(()=>{}).finally(()=>setLoading(false)); }, []);

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /></div></div>;

  const pct = parseInt(data?.percentage) || 0;
  const color = pct >= 75 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';

  // Build calendar map
  const recordMap = {};
  data?.records?.forEach(r => { recordMap[r.date] = r; });

  const calDays = buildCalendar(viewMonth.year, viewMonth.month);

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">Attendance</div><div className="page-subtitle">Your attendance overview</div></div>
      </div>

      {/* Big percentage circle */}
      <div className="card" style={{ textAlign:'center', padding:28, marginBottom:12 }}>
        <div style={{ width:120, height:120, borderRadius:'50%', background:`conic-gradient(${color} ${pct*3.6}deg, var(--border) 0deg)`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', position:'relative' }}>
          <div style={{ width:94, height:94, borderRadius:'50%', background:'var(--card)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div>
              <div style={{ fontSize:24, fontWeight:900, color }}>{pct}%</div>
              <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600 }}>Attendance</div>
            </div>
          </div>
        </div>
        <div className="stats-grid" style={{ gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
          {[
            { label:'Present', value:data?.present||0, color:'var(--green)', bg:'#dcfce7' },
            { label:'Absent',  value:data?.absent||0,  color:'var(--red)',   bg:'#fee2e2' },
            { label:'Late',    value:data?.late||0,    color:'var(--yellow)',bg:'#fef9c3' },
          ].map(s => (
            <div key={s.label} style={{ background:s.bg, borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
              <div style={{ fontWeight:900, fontSize:20, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:11, fontWeight:600, color:s.color, opacity:0.8 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab-btn ${tab==='summary'?'active':''}`} onClick={()=>setTab('summary')}>Calendar</button>
        <button className={`tab-btn ${tab==='history'?'active':''}`} onClick={()=>setTab('history')}>History</button>
      </div>

      {/* Calendar */}
      {tab === 'summary' && (
        <div className="card">
          {/* Month nav */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <button onClick={()=>setViewMonth(m => prevMonth(m))} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--text2)', padding:'4px 8px' }}>‹</button>
            <div style={{ fontWeight:800, fontSize:15 }}>{MONTHS[viewMonth.month-1]} {viewMonth.year}</div>
            <button onClick={()=>setViewMonth(m => nextMonth(m))} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--text2)', padding:'4px 8px' }}>›</button>
          </div>
          {/* Day headers */}
          <div className="cal-grid">
            {DAYS.map(d => <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'var(--muted)', paddingBottom:4 }}>{d}</div>)}
          </div>
          <div className="cal-grid">
            {calDays.map((d, i) => {
              if (!d) return <div key={i} />;
              const dateStr = `${viewMonth.year}-${String(viewMonth.month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
              const rec = recordMap[dateStr];
              const today = new Date();
              const isToday = today.getFullYear()===viewMonth.year && today.getMonth()+1===viewMonth.month && today.getDate()===d;
              let bg = 'transparent', color2 = 'var(--text)';
              if (rec) {
                if (rec.status === 'present') { bg = '#dcfce7'; color2 = '#15803d'; }
                else { bg = '#fee2e2'; color2 = '#dc2626'; }
                if (rec.is_late) { bg = '#fef9c3'; color2 = '#a16207'; }
              }
              return (
                <div key={i} className={`cal-day ${isToday?'today':''}`}
                  style={{ background: isToday ? 'var(--accent)' : bg, color: isToday ? '#fff' : color2, fontSize:13 }}>
                  {d}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div style={{ display:'flex', gap:14, justifyContent:'center', marginTop:14, flexWrap:'wrap' }}>
            {[['#dcfce7','#15803d','Present'],['#fee2e2','#dc2626','Absent'],['#fef9c3','#a16207','Late']].map(([bg,c,l]) => (
              <div key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'var(--muted)' }}>
                <div style={{ width:12,height:12,borderRadius:4,background:bg }} />{l}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {tab === 'history' && (
        <>
          {(!data?.records?.length) && <div className="empty"><div className="empty-icon">📋</div><div className="empty-title">No records yet</div></div>}
          {data?.records?.map(r => (
            <div key={r.id} className="list-item" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div className="list-item-title">{r.date}</div>
                {r.is_late && <div style={{ fontSize:11, color:'var(--yellow)', fontWeight:700 }}>⏰ Late</div>}
                {r.leave_reason && <div className="list-item-sub">Reason: {r.leave_reason}</div>}
              </div>
              <span className={`badge ${r.status==='present'?'badge-green':'badge-red'}`}>{r.status}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function buildCalendar(year, month) {
  const first = new Date(year, month-1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const cells = Array(first).fill(null);
  for (let i = 1; i <= days; i++) cells.push(i);
  return cells;
}
function prevMonth({ month, year }) { return month === 1 ? { month:12, year:year-1 } : { month:month-1, year }; }
function nextMonth({ month, year }) { return month === 12 ? { month:1, year:year+1 } : { month:month+1, year }; }
