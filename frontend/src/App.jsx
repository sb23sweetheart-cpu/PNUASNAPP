// src/App.jsx — PNU ASN complete app
import { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';
import { api } from './api';
import { useTheme } from './hooks/useTheme';

// Auth
import LoginPage from './pages/LoginPage';

// Student pages
import Dashboard    from './pages/student/Dashboard';
import AttendancePage from './pages/student/AttendancePage';
import WorkPage     from './pages/student/WorkPage';
import FeesPage     from './pages/student/FeesPage';
import { ResultsPage, LeavePage, MessagesPage, CalendarPage, TimetablePage, NotificationsPage, ProfilePage } from './pages/student/StudentPages';

// Teacher pages
import TeacherDashboard  from './pages/teacher/TeacherDashboard';
import TeacherStudents   from './pages/teacher/TeacherStudentsPage';
import TeacherAttendance from './pages/teacher/TeacherAttendancePage';
import TeacherWork       from './pages/teacher/TeacherWorkPage';
import TeacherFees       from './pages/teacher/TeacherFeesPage';
import { TeacherLeavePage, TeacherExamsPage, TeacherResultsPage, TeacherMessagesPage, TeacherCalendarPage, TeacherTimetablePage, SettingsPage, TeacherProfilePage, SearchPage, ActivityLogPage } from './pages/teacher/TeacherPages';

// Shared pages
import ChatPage from './pages/ChatPage';

// ── NAV CONFIGS ───────────────────────────────────────────────────
const STUDENT_NAV = [
  { id:'home',     icon:'🏠', label:'Home'  },
  { id:'work',     icon:'📚', label:'Work', type:'work' },
  { id:'chat',     icon:'💬', label:'Chat', type:'message' },
  { id:'fees',     icon:'💳', label:'Fees', type:'fees' },
  { id:'profile',  icon:'👤', label:'Me'   },
];

const TEACHER_NAV = [
  { id:'home',         icon:'🏠', label:'Home'       },
  { id:'t-attendance', icon:'📊', label:'Attendance' },
  { id:'t-work',       icon:'📚', label:'Work', type:'work' },
  { id:'t-chat',       icon:'💬', label:'Chat', type:'message' },
  { id:'t-search',     icon:'🔍', label:'Search'     },
  { id:'profile',      icon:'👤', label:'Me'         },
];

export default function App() {
  const { theme, toggleTheme } = useTheme();

  const savedUser = (() => { try { return JSON.parse(localStorage.getItem('pnu_user')); } catch { return null; } })();
  const [user, setUser]         = useState(savedUser);
  const [page, setPage]         = useState('home');
  const [badges, setBadges]     = useState({ total:0 });
  const [inChatWindow, setInChatWindow] = useState(false);

  // Poll notification badges every 60s
  const loadBadges = useCallback(() => {
    if (!localStorage.getItem('pnu_token')) return;
    api.getUnreadCounts().then(d => setBadges(d.counts ? { ...d.counts, total: d.total } : { total:0 })).catch(()=>{});
  }, []);

  useEffect(() => {
    if (!user) return;
    loadBadges();
    const interval = setInterval(loadBadges, 60000);
    return () => clearInterval(interval);
  }, [user, loadBadges]);

  // SSE real-time notification stream
  const sseRef = useRef(null);
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('pnu_token');
    if (!token) return;
    const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    const url  = `${BASE}/sse?token=${encodeURIComponent(token)}`;
    const es   = new EventSource(url);
    sseRef.current = es;
    es.onmessage = (e) => {
      try {
        // Any incoming SSE event means a new notification — refresh badge
        loadBadges();
      } catch {}
    };
    es.onerror = () => { es.close(); }; // auto-reconnect handled by browser
    return () => { es.close(); };
  }, [user, loadBadges]);

  function handleLogin(u) {
    setUser(u);
    setPage('home');
  }

  function handleLogout() {
    localStorage.removeItem('pnu_token');
    localStorage.removeItem('pnu_user');
    setUser(null);
    setBadges({ total:0 });
  }

  function navigate(p) {
    setPage(p);
    setInChatWindow(false);
    if (p === 'notifications') loadBadges();
  }

  if (!user) return <LoginPage onLogin={handleLogin} />;

  const isTeacher = user.role === 'teacher';
  const NAV = isTeacher ? TEACHER_NAV : STUDENT_NAV;

  // ── STUDENT ROUTING ──────────────────────────────────────────────
  const renderStudent = () => {
    switch (page) {
      case 'home':          return <Dashboard user={user} onNavigate={navigate} badges={badges} />;
      case 'attendance':    return <AttendancePage />;
      case 'timetable':     return <TimetablePage />;
      case 'messages':      return <MessagesPage />;
      case 'chat':          return <ChatPage user={user} onChatWindowChange={setInChatWindow} />;
      case 'results':       return <ResultsPage />;
      case 'leave':         return <LeavePage />;
      case 'calendar':      return <CalendarPage />;
      case 'work':          return <WorkPage />;
      case 'fees':          return <FeesPage />;
      case 'notifications': return <NotificationsPage />;
      case 'profile':       return <ProfilePage user={user} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />;
      case 'settings':      return <SettingsPage theme={theme} toggleTheme={toggleTheme} onLogout={handleLogout} />;
      default:              return <Dashboard user={user} onNavigate={navigate} badges={badges} />;
    }
  };

  // ── TEACHER ROUTING ──────────────────────────────────────────────
  const renderTeacher = () => {
    switch (page) {
      case 'home':          return <TeacherDashboard user={user} onNavigate={navigate} badges={badges} />;
      case 't-students':    return <TeacherStudents onNavigate={navigate} />;
      case 't-attendance':  return <TeacherAttendance />;
      case 't-work':        return <TeacherWork />;
      case 't-fees':        return <TeacherFees />;
      case 't-leave':       return <TeacherLeavePage />;
      case 't-exams':       return <TeacherExamsPage />;
      case 't-results':     return <TeacherResultsPage />;
      case 't-messages':    return <TeacherMessagesPage />;
      case 't-chat':        return <ChatPage user={user} onChatWindowChange={setInChatWindow} />;
      case 't-search':      return <SearchPage onNavigate={setPage} />;
      case 't-activity':    return <ActivityLogPage />;
      case 't-calendar':    return <TeacherCalendarPage />;
      case 't-timetable':   return <TeacherTimetablePage />;
      case 'notifications': return <NotificationsPage />;
      case 'settings':      return <SettingsPage theme={theme} toggleTheme={toggleTheme} onLogout={handleLogout} />;
      case 'profile':       return <TeacherProfilePage user={user} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} onUserUpdate={u => { setUser(u); localStorage.setItem('pnu_user', JSON.stringify(u)); }} onNavigate={setPage} />;
      default:              return <TeacherDashboard user={user} onNavigate={navigate} badges={badges} />;
    }
  };

  // Which nav item is "active"?
  const activeNav    = NAV.find(n => n.id === page)?.id || 'home';
  const activeIndex  = NAV.findIndex(n => n.id === page);
  const safeIndex    = activeIndex < 0 ? 0 : activeIndex;

  // Hide bottom nav only when inside an open chat window — not on the contacts list
  const hiddenNav = (page === 'chat' || page === 't-chat') && inChatWindow;

  const isHome = page === 'home';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* key=page forces unmount→remount triggering liquidIn animation */}
      <div
        key={page}
        style={{
          flex: 1,
          overflowY: isHome ? 'auto' : 'visible',
          overflowX: 'hidden',
          animation: 'liquidIn 0.38s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        {isTeacher ? renderTeacher() : renderStudent()}
      </div>

      {/* ── Pill Dock ── */}
      {!hiddenNav && (
        <BottomNav
          nav={NAV}
          activeNav={activeNav}
          safeIndex={safeIndex}
          badges={badges}
          onNavigate={navigate}
        />
      )}
    </div>
  );
}

// ── BOTTOM NAV (separate component so the pill-measuring effect has
//    a clean lifecycle tied to its own mount/update, not the whole App) ──
function BottomNav({ nav, activeNav, safeIndex, badges, onNavigate }) {
  const navRef = useRef(null);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    function measurePill() {
      const container = navRef.current;
      if (!container) return;
      const items = container.querySelectorAll('.nav-item');
      const activeEl = items[safeIndex];
      if (!activeEl) return;
      const containerRect = container.getBoundingClientRect();
      const itemRect = activeEl.getBoundingClientRect();
      setPillStyle({
        left: itemRect.left - containerRect.left,
        width: itemRect.width,
      });
    }

    // Measure now, and again after the font/emoji has definitely painted
    // (fonts loading async can shift widths slightly on first render).
    measurePill();
    const raf = requestAnimationFrame(measurePill);

    window.addEventListener('resize', measurePill);
    return () => {
      window.removeEventListener('resize', measurePill);
      cancelAnimationFrame(raf);
    };
  }, [safeIndex, nav]);

  return (
    <nav
      className="bottom-nav"
      ref={navRef}
      style={{
        bottom: `max(18px, calc(env(safe-area-inset-bottom) + 8px))`,
        position: 'fixed',
      }}
    >
      {/* Sliding pill indicator — measured from real rendered widths,
          so it stays correct no matter how narrow the screen is */}
      <div
        style={{
          position: 'absolute',
          top: 6,
          bottom: 6,
          width: pillStyle.width,
          left: pillStyle.left,
          borderRadius: 999,
          background: 'rgba(var(--accent-rgb), 0.13)',
          border: '1px solid rgba(var(--accent-rgb), 0.28)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.65) inset, 0 2px 8px rgba(var(--accent-rgb),0.18)',
          transition: 'left 0.38s cubic-bezier(0.34,1.4,0.64,1), width 0.38s cubic-bezier(0.34,1.4,0.64,1)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {nav.map(n => (
        <button
          key={n.id}
          className={`nav-item ${activeNav === n.id ? 'active' : ''}`}
          onClick={() => onNavigate(n.id)}
          style={{ position: 'relative', zIndex: 1 }}
        >
          <div className="nav-icon-wrap">
            {n.icon}
            {n.type && (badges[n.type] || 0) > 0 && (
              <span className="notif-badge">
                {badges[n.type] > 9 ? '9+' : badges[n.type]}
              </span>
            )}
          </div>
          <span className="nav-label">{n.label}</span>
        </button>
      ))}
    </nav>
  );
}