// src/pages/teacher/TeacherDashboard.jsx
import { useEffect, useState } from 'react';
import { api } from '../../api';

export default function TeacherDashboard({ user, onNavigate, badges }) {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getStudents().catch(()=>({ students:[] })),
      api.getClassLeave().catch(()=>({ requests:[] })),
      api.getClassFees().catch(()=>({ summary:{} })),
    ]).then(([s, l, f]) => {
      setStats({
        students: s.students?.length || 0,
        pendingLeave: (l.requests||[]).filter(r=>r.status==='pending').length,
        totalFees: f.summary?.totalCollected || 0,
        pendingFees: f.summary?.totalPending || 0,
      });
    }).finally(()=>setLoading(false));
  }, []);

  const modules = [
    { label:'Students',   icon:'🎓', color:'#EFF6FF', accent:'#2563EB', page:'t-students'   },
    { label:'Attendance', icon:'📊', color:'#F0FDF4', accent:'#16A34A', page:'t-attendance'  },
    { label:'Work',       icon:'📚', color:'#F0FDFA', accent:'#0891B2', page:'t-work', type:'work' },
    { label:'Exams',      icon:'📋', color:'#FEFCE8', accent:'#D97706', page:'t-exams'       },
    { label:'Results',    icon:'🏆', color:'#F5F3FF', accent:'#7C3AED', page:'t-results'     },
    { label:'Fees',       icon:'💳', color:'#FDF4FF', accent:'#9333EA', page:'t-fees'        },
    { label:'Leave',      icon:'📝', color:'#FFF7ED', accent:'#F97316', page:'t-leave', type:'leave' },
    { label:'Notices',    icon:'✉️',  color:'#FFF1F2', accent:'#E11D48', page:'t-messages'    },
    { label:'Timetable',  icon:'🕐', color:'#F0FDFA', accent:'#0891B2', page:'t-timetable'   },
    { label:'Calendar',   icon:'📅', color:'#F0FDF4', accent:'#16A34A', page:'t-calendar'    },
    { label:'Settings',   icon:'⚙️', color:'#F3F4F6', accent:'#6B7280', page:'settings'      },
    { label:'Profile',    icon:'👤', color:'#EFF6FF', accent:'#2563EB', page:'profile'       },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <img src="/logo.png" alt="Logo" style={{ width:42, height:42, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--border)', flexShrink:0 }} />
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)', letterSpacing:'0.08em' }}>TEACHER PORTAL</div>
            <div className="page-title">Dashboard</div>
          </div>
        </div>
        <div style={{ position:'relative' }}>
          <button onClick={()=>onNavigate('notifications')} style={{ width:40,height:40,borderRadius:'50%',background:'var(--card)',border:'1px solid var(--border)',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center' }}>🔔</button>
          {(badges?.total||0)>0&&<span className="notif-badge">{badges.total>9?'9+':badges.total}</span>}
        </div>
      </div>

      {/* Welcome */}
      <div className="welcome-card" style={{ background:'linear-gradient(135deg,#1E3A8A,#7C3AED)', marginBottom:16 }}>
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ fontSize:13, opacity:0.75, fontWeight:600 }}>Welcome,</div>
          <div style={{ fontSize:22, fontWeight:800, marginTop:2 }}>{user?.name?.split(' ')[0]}!</div>
          <div style={{ fontSize:12, opacity:0.65, marginTop:6 }}>
            Class Teacher {user?.class ? `· Class ${user.class}${user.section||''}` : ''}
          </div>
        </div>
        <div style={{ fontSize:40, position:'relative', zIndex:1 }}>👩‍🏫</div>
      </div>

      {/* Stats */}
      {!loading && stats && (
        <div className="stats-grid" style={{ marginBottom:4 }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background:'#EFF6FF', color:'#2563EB' }}>🎓</div>
            <div><div className="stat-value" style={{ color:'#2563EB' }}>{stats.students}</div><div className="stat-label">Students</div></div>
          </div>
          <div className="stat-card" onClick={()=>onNavigate('t-leave')} style={{ cursor:'pointer' }}>
            <div className="stat-icon" style={{ background:'#FFF7ED', color:'#F97316' }}>📝</div>
            <div><div className="stat-value" style={{ color:'#F97316' }}>{stats.pendingLeave}</div><div className="stat-label">Leave Pending</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background:'#F0FDF4', color:'#16A34A' }}>💰</div>
            <div><div className="stat-value" style={{ color:'#16A34A', fontSize:15 }}>₹{(stats.totalFees/1000).toFixed(1)}k</div><div className="stat-label">Collected</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background:'#FEF2F2', color:'#DC2626' }}>⏳</div>
            <div><div className="stat-value" style={{ color:'#DC2626', fontSize:15 }}>₹{(stats.pendingFees/1000).toFixed(1)}k</div><div className="stat-label">Pending Fees</div></div>
          </div>
        </div>
      )}

      {/* Modules */}
      <div className="section-header">Manage</div>
      <div className="module-grid">
        {modules.map(m => (
          <button key={m.page} className="module-btn" onClick={()=>onNavigate(m.page)}>
            <div className="module-icon" style={{ background:m.color, color:m.accent }}>
              {m.icon}
              {m.type && (badges?.[m.type]||0)>0 && (
                <span className="notif-badge" style={{ fontSize:9, minWidth:15, height:15 }}>
                  {badges[m.type]>9?'9+':badges[m.type]}
                </span>
              )}
            </div>
            <span className="module-label">{m.label}</span>
          </button>
        ))}
      </div>

      {/* Pending leave alert */}
      {stats?.pendingLeave > 0 && (
        <div onClick={()=>onNavigate('t-leave')} style={{ marginTop:20, background:'#fef9c3', borderRadius:14, padding:'14px 16px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', border:'1px solid #fde68a' }}>
          <div><div style={{ fontWeight:800, color:'#a16207', fontSize:14 }}>⚠️ {stats.pendingLeave} Pending Leave Request{stats.pendingLeave>1?'s':''}</div><div style={{ fontSize:12, color:'#92400e', marginTop:2 }}>Tap to review</div></div>
          <div style={{ fontSize:20, color:'#a16207' }}>→</div>
        </div>
      )}
    </div>
  );
}
