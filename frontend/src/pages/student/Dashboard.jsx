// src/pages/student/Dashboard.jsx
import { useEffect, useState } from 'react';
import { api } from '../../api';

export default function Dashboard({ user, onNavigate, badges }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMe().then(d => setStats(d.quickStats)).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const modules = [
    { label:'Attendance', icon:'📊', color:'#EFF6FF', accent:'#2563EB', page:'attendance' },
    { label:'Timetable',  icon:'🕐', color:'#F5F3FF', accent:'#7C3AED', page:'timetable'  },
    { label:'Messages',   icon:'✉️',  color:'#FFF1F2', accent:'#E11D48', page:'messages', type:'message'  },
    { label:'Calendar',   icon:'📅', color:'#F0FDF4', accent:'#16A34A', page:'calendar'  },
    { label:'Leave',      icon:'📋', color:'#FFF7ED', accent:'#F97316', page:'leave', type:'leave'    },
    { label:'Results',    icon:'🏆', color:'#FEFCE8', accent:'#D97706', page:'results', type:'result'  },
    { label:'Work',       icon:'📚', color:'#F0FDFA', accent:'#0891B2', page:'work', type:'work'    },
    { label:'Fees',       icon:'💳', color:'#FDF4FF', accent:'#9333EA', page:'fees', type:'fees'    },
  ];

  const statCards = [
    { icon:'📊', label:'Attendance', value: stats?.attendance||'–', bg:'#EFF6FF', color:'#2563EB' },
    { icon:'📚', label:'Pending Work', value: stats?.pendingWork||0, bg:'#F0FDFA', color:'#0891B2' },
    { icon:'💳', label:'Fees Due', value: stats?.paidFees != null ? `₹${(stats.totalFees - stats.paidFees).toLocaleString()}` : '–', bg:'#FDF4FF', color:'#9333EA' },
    { icon:'📝', label:'Pending Leave', value: stats?.pendingLeave||0, bg:'#FFF7ED', color:'#F97316' },
  ];

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <img src="/logo.png" alt="Logo" style={{ width:42, height:42, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--border)', flexShrink:0 }} />
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)', letterSpacing:'0.08em' }}>PNU ASN</div>
            <div className="page-title">Dashboard</div>
          </div>
        </div>
        <div style={{ position:'relative' }}>
          <button onClick={()=>onNavigate('notifications')} style={{ width:40,height:40,borderRadius:'50%',background:'var(--card)',border:'1px solid var(--border)',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center' }}>🔔</button>
          {(badges?.total||0) > 0 && <span className="notif-badge">{badges.total > 9 ? '9+' : badges.total}</span>}
        </div>
      </div>

      {/* Welcome Card */}
      {/* Welcome Card */}
<div
  className="welcome-card"
  style={{
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 180,
    borderRadius: 28,
    background: 'linear-gradient(135deg,#2563eb,#38bdf8)',
    padding: 24,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
  }}
>
  {/* RIGHT SIDE PROFILE IMAGE */}
 <img
  src={user.photo_url}
  alt=""
  style={{
    position: 'absolute',
    right: 0,
    top: 0,
    width: '52%',
    height: '100%',
    objectFit: 'cover',
    opacity: 2.9,

    WebkitMaskImage:
      'linear-gradient(to left, black 72%, transparent 100%)',

    maskImage:
      'linear-gradient(to left, black 72%, transparent 100%)',
  }}
/>
  {/* TEXT CONTENT */}
  <div
    style={{
      position: 'relative',
      zIndex: 2,
      maxWidth: '55%',
    }}
  >
    <div
      style={{
        fontSize: 15,
        opacity: 0.85,
        fontWeight: 600,
      }}
    >
      Good {getGreeting()},
    </div>

    <div
      style={{
        fontSize: 34,
        fontWeight: 800,
        marginTop: 4,
        lineHeight: 1.1,
      }}
    >
      {user?.name?.split(' ')[0]}!
    </div>

    <div
      style={{
        fontSize: 15,
        opacity: 0.85,
        marginTop: 12,
      }}
    >
      {user?.class
        ? `Class ${user.class}${user.section || ''}`
        : 'Welcome to PNU ASN'}
    </div>
  </div>
</div>

      {/* Quick Stats */}
      <div className="section-header">Quick Stats</div>
      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <div className="stats-grid" style={{ marginBottom:4 }}>
          {statCards.map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-icon" style={{ background:s.bg, color:s.color }}>{s.icon}</div>
              <div>
                <div className="stat-value" style={{ color:s.color, fontSize:18 }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modules */}
      <div className="section-header">Modules</div>
      <div className="module-grid">
        {modules.map(m => (
          <button key={m.page} className="module-btn" onClick={()=>onNavigate(m.page)}>
            <div className="module-icon" style={{ background:m.color, color:m.accent }}>
              {m.icon}
              {m.type && (badges?.[m.type]||0) > 0 && (
                <span className="notif-badge" style={{ fontSize:9, minWidth:15, height:15 }}>
                  {badges[m.type] > 9 ? '9+' : badges[m.type]}
                </span>
              )}
            </div>
            <span className="module-label">{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}
