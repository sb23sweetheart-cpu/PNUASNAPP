// src/pages/LoginPage.jsx
import { useState } from 'react';
import { api } from '../api';

export default function LoginPage({ onLogin }) {
  const [mode, setMode]     = useState('login'); // login | register | forgot | otp | reset | verify
  const [form, setForm]     = useState({ name:'', email:'', password:'', role:'student', class:'', section:'' });
  const [otp, setOtp]       = useState('');
  const [newPass, setNewPass] = useState('');
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleLogin() {
    setError(''); setLoading(true);
    try {
      const data = await api.login({ email: form.email, password: form.password });
      localStorage.setItem('pnu_token', data.token);
      let freshUser = data.user;
      try {
        const profile = await api.getMe();
        if (profile?.profile) {
          freshUser = { ...data.user, class: profile.profile.class, section: profile.profile.section, grade: profile.profile.grade, photo_url: profile.profile.photo_url };
        }
      } catch {}
      localStorage.setItem('pnu_user', JSON.stringify(freshUser));
      onLogin(freshUser);
    } catch (e) {
      // Backend signals email not verified
      if (e.message?.includes('verify your email')) {
        setMode('verify');
        setSuccess('Please verify your email. Enter the code we sent you.');
      } else { setError(e.message); }
    }
    setLoading(false);
  }

  async function handleRegister() {
    setError(''); setLoading(true);
    try {
      await api.register(form);
      setSuccess('Account created! Check your email for a verification code.');
      setMode('verify');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function handleVerifyEmail() {
    setError(''); setLoading(true);
    try {
      await api.verifyEmail({ email: form.email, otp });
      setSuccess('Email verified! You can now log in.');
      setOtp('');
      setMode('login');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function handleResendVerification() {
    setError(''); setLoading(true);
    try {
      await api.resendVerification({ email: form.email });
      setSuccess('New verification code sent!');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function handleForgot() {
    setError(''); setLoading(true);
    try {
      await api.forgotPassword({ email: form.email });
      setSuccess('OTP sent to your email!');
      setMode('otp');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function handleVerifyOtp() {
    setError(''); setLoading(true);
    try {
      await api.verifyOtp({ email: form.email, otp });
      setMode('reset');
      setSuccess('');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function handleReset() {
    setError(''); setLoading(true);
    try {
      await api.resetPassword({ email: form.email, otp, new_password: newPass });
      setSuccess('Password reset! Please log in.');
      setMode('login');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  const titles = { login:'Welcome Back', register:'Create Account', forgot:'Forgot Password', otp:'Enter OTP', reset:'Set New Password', verify:'Verify Email' };

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#080C1A 0%,#0F1B3D 45%,#1A3A6E 100%)', display:'flex', flexDirection:'column', padding:'0 0 32px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-80, right:-60, width:260, height:260, borderRadius:'50%', background:'radial-gradient(circle,rgba(201,153,42,0.18) 0%,transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:200, left:-80, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(59,130,246,0.12) 0%,transparent 70%)', pointerEvents:'none' }} />
      {/* Hero */}
      <div style={{ padding:'60px 28px 32px', color:'#fff' }}>
        <div style={{ marginBottom:16 }}>
          <img
            src="/logo.png"
            alt="PNU ASN Logo"
            style={{ width:100, height:100, borderRadius:'50%', objectFit:'cover', border:'2px solid rgba(201,153,42,0.5)', boxShadow:'0 0 32px rgba(201,153,42,0.35), 0 0 0 6px rgba(201,153,42,0.10)' }}
          />
        </div>
        <div style={{ fontFamily:'Sora,sans-serif', fontSize:26, fontWeight:800, letterSpacing:'-0.5px' }}>PNU ASN</div>
        <div style={{ fontSize:12, opacity:0.55, marginTop:4, lineHeight:1.5 }}>P.N.U.A.S.N. Mat. Hr. Sec. School · Madurai</div>
      </div>

      {/* Card */}
      <div style={{ flex:1, background:'var(--card)', backdropFilter:'blur(60px)', WebkitBackdropFilter:'blur(60px)', borderRadius:'28px 28px 0 0', padding:'28px 24px', marginTop:'auto', borderTop:'1px solid var(--border)', boxShadow:'0 -8px 32px rgba(0,0,0,0.18)' }}>
        {/* Mode tabs (only for login/register) */}
        {(mode === 'login' || mode === 'register') && (
          <div className="tab-bar" style={{ marginBottom:24 }}>
            <button className={`tab-btn ${mode==='login'?'active':''}`} onClick={()=>{ setMode('login'); setError(''); }}>Log In</button>
            <button className={`tab-btn ${mode==='register'?'active':''}`} onClick={()=>{ setMode('register'); setError(''); }}>Register</button>
          </div>
        )}

        {/* Back button for sub-modes */}
        {['forgot','otp','reset','verify'].includes(mode) && (
          <button onClick={()=>{ setMode('login'); setError(''); setSuccess(''); }}
            style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', color:'var(--accent)', fontWeight:700, fontSize:13, marginBottom:20, padding:0 }}>
            ← Back to Login
          </button>
        )}

        <div style={{ fontWeight:800, fontSize:20, marginBottom:6 }}>{titles[mode]}</div>
        <div style={{ fontSize:13, color:'var(--muted)', marginBottom:22 }}>
          {mode==='login' && 'Sign in to your PNU ASN account'}
          {mode==='register' && 'Join PNU ASN today'}
          {mode==='forgot' && 'Enter your email to receive OTP'}
          {mode==='otp' && `OTP sent to ${form.email}`}
          {mode==='verify' && `Verification code sent to ${form.email}`}
          {mode==='reset' && 'Create a new strong password'}
        </div>

        {error   && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* LOGIN */}
        {mode === 'login' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="input-wrap"><label>Email</label><input type="email" placeholder="your@email.com" value={form.email} onChange={e=>set('email',e.target.value)} /></div>
            <div className="input-wrap"><label>Password</label><input type="password" placeholder="••••••••" value={form.password} onChange={e=>set('password',e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} /></div>
            <button onClick={()=>{ setMode('forgot'); setError(''); }} style={{ background:'none', border:'none', color:'var(--accent)', fontWeight:700, fontSize:13, cursor:'pointer', textAlign:'right', padding:'0 2px' }}>Forgot Password?</button>
            <button className="btn btn-primary" onClick={handleLogin} disabled={loading}>{loading?<><span className="spinner" style={{width:18,height:18,borderWidth:2}} />Signing in...</>:'Sign In →'}</button>
          </div>
        )}

        {/* REGISTER */}
        {mode === 'register' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="input-wrap"><label>Full Name</label><input placeholder="e.g. Ahmad Khan" value={form.name} onChange={e=>set('name',e.target.value)} /></div>
            <div className="input-wrap"><label>Email</label><input type="email" placeholder="your@email.com" value={form.email} onChange={e=>set('email',e.target.value)} /></div>
            <div className="input-wrap"><label>Password</label><input type="password" placeholder="••••••••" value={form.password} onChange={e=>set('password',e.target.value)} /></div>
            <div className="input-wrap">
              <label>I am a</label>
              <select value={form.role} onChange={e=>set('role',e.target.value)}>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
            </div>
            {form.role === 'student' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div className="input-wrap"><label>Class</label><input placeholder="e.g. 10" value={form.class} onChange={e=>set('class',e.target.value)} /></div>
                <div className="input-wrap">
                  <label>Section</label>
                  <input
                    placeholder="e.g. A"
                    value={form.section}
                    maxLength={3}
                    onChange={e => set('section', e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                  />
                </div>
              </div>
            )}
            <button className="btn btn-primary" onClick={handleRegister} disabled={loading}>{loading?'Creating...':'Create Account'}</button>
          </div>
        )}

        {/* FORGOT */}
        {mode === 'forgot' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="input-wrap"><label>Email Address</label><input type="email" placeholder="your@email.com" value={form.email} onChange={e=>set('email',e.target.value)} /></div>
            <button className="btn btn-primary" onClick={handleForgot} disabled={loading}>{loading?'Sending OTP...':'Send OTP →'}</button>
          </div>
        )}

        {/* OTP */}
        {mode === 'otp' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="input-wrap">
              <label>6-Digit OTP</label>
              <input placeholder="000000" value={otp} onChange={e=>setOtp(e.target.value)} maxLength={6}
                style={{ fontSize:24, letterSpacing:8, textAlign:'center', fontFamily:'DM Mono,monospace' }} />
            </div>
            <button className="btn btn-primary" onClick={handleVerifyOtp} disabled={loading}>{loading?'Verifying...':'Verify OTP →'}</button>
            <button onClick={handleForgot} style={{ background:'none', border:'none', color:'var(--accent)', fontWeight:700, fontSize:13, cursor:'pointer' }}>Resend OTP</button>
          </div>
        )}

        {/* RESET */}
        {mode === 'reset' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="input-wrap"><label>New Password</label><input type="password" placeholder="Create strong password" value={newPass} onChange={e=>setNewPass(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={handleReset} disabled={loading}>{loading?'Resetting...':'Reset Password →'}</button>
          </div>
        )}

        {/* Email verification */}
        {mode === 'verify' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ background:'rgba(var(--accent-rgb),0.08)', border:'1.5px solid rgba(var(--accent-rgb),0.2)', borderRadius:12, padding:'14px 16px', fontSize:13, color:'var(--text2)', fontWeight:600 }}>
              📧 We sent a 6-digit code to <strong>{form.email}</strong>. Check your inbox and spam folder.
            </div>
            <div className="input-wrap">
              <label>Verification Code</label>
              <input placeholder="Enter 6-digit code" value={otp} onChange={e=>setOtp(e.target.value)} maxLength={6} style={{ textAlign:'center', fontSize:22, fontWeight:800, letterSpacing:10 }} />
            </div>
            <button className="btn btn-primary" onClick={handleVerifyEmail} disabled={loading}>{loading?'Verifying...':'Verify Email ✓'}</button>
            <button onClick={handleResendVerification} disabled={loading} style={{ background:'none', border:'none', color:'var(--accent)', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              Resend Code
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
