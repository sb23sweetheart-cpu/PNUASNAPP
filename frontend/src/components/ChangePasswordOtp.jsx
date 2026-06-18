// src/components/ChangePasswordOtp.jsx
// Reusable 3-step OTP password change — works for both teacher and student
import { useState } from 'react';
import { api } from '../api';

// step: 'idle' | 'sending' | 'otp' | 'newpw' | 'done'

export default function ChangePasswordOtp({ onClose }) {
  const [step,       setStep]      = useState('idle');
  const [maskedEmail,setMasked]    = useState('');
  const [otp,        setOtp]       = useState('');
  const [newPw,      setNewPw]     = useState('');
  const [confirmPw,  setConfirmPw] = useState('');
  const [showPw,     setShowPw]    = useState(false);
  const [loading,    setLoading]   = useState(false);
  const [error,      setError]     = useState('');

  // Step 1 — request OTP
  async function requestOtp() {
    setLoading(true); setError('');
    try {
      const r = await api.sendChangeOtp();
      setMasked(r.maskedEmail || 'your email');
      setStep('otp');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  // Step 2 — verify OTP (just check length, actual verify on submit)
  function confirmOtp() {
    if (otp.length !== 6) { setError('Enter the 6-digit OTP.'); return; }
    setError('');
    setStep('newpw');
  }

  // Step 3 — submit new password
  async function submitPassword() {
    if (!newPw || newPw.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw)         { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    try {
      await api.changePasswordOtp({ otp, new_password: newPw });
      setStep('done');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:998,
      display:'flex', alignItems:'flex-end', justifyContent:'center',
    }}>
    <div style={{
        background:'var(--card)', borderRadius:'24px 24px 0 0',
        padding:'28px 28px calc(28px + env(safe-area-inset-bottom))', 
        paddingBottom: 100,
        width:'100%', maxWidth:430,
        animation:'fadeUp 0.25s ease',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontWeight:800, fontSize:18 }}>🔐 Change Password</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'var(--muted)', lineHeight:1 }}>×</button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom:14 }}>{error}</div>}

        {/* ── STEP: idle — explain what will happen ── */}
        {step === 'idle' && (
          <>
            <div style={{ background:'var(--bg2)', borderRadius:12, padding:14, marginBottom:20 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>How it works</div>
              <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>
                1. We'll send a <strong>6-digit OTP</strong> to your registered email address.<br />
                2. Enter the OTP to verify it's you.<br />
                3. Set your new password.
              </div>
            </div>
            <button className="btn btn-primary" onClick={requestOtp} disabled={loading}>
              {loading
                ? <><span className="spinner" style={{ width:16, height:16, borderWidth:2 }} /> Sending OTP...</>
                : '📧 Send OTP to My Email'}
            </button>
          </>
        )}

        {/* ── STEP: sending ── */}
        {step === 'sending' && (
          <div className="loading"><div className="spinner" /></div>
        )}

        {/* ── STEP: otp — enter the code ── */}
        {step === 'otp' && (
          <>
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <div style={{ fontSize:40, marginBottom:10 }}>📬</div>
              <div style={{ fontWeight:700, fontSize:15 }}>OTP Sent!</div>
              <div style={{ fontSize:13, color:'var(--muted)', marginTop:4 }}>
                We sent a 6-digit code to<br />
                <strong style={{ color:'var(--text)' }}>{maskedEmail}</strong>
              </div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>Expires in 10 minutes</div>
            </div>

            <div className="input-wrap">
              <label>Enter OTP</label>
              <input
                type="number"
                placeholder="000000"
                value={otp}
                maxLength={6}
                onChange={e => setOtp(e.target.value.slice(0, 6))}
                style={{ fontSize:28, letterSpacing:10, textAlign:'center', fontFamily:'DM Mono,monospace', fontWeight:700 }}
              />
            </div>

            <button className="btn btn-primary" onClick={confirmOtp} style={{ marginBottom:10 }}>
              Verify OTP →
            </button>
            <button onClick={requestOtp} disabled={loading} style={{ background:'none', border:'none', color:'var(--accent)', fontWeight:700, fontSize:13, cursor:'pointer', width:'100%', padding:'8px 0' }}>
              {loading ? 'Resending...' : '🔄 Resend OTP'}
            </button>
          </>
        )}

        {/* ── STEP: newpw — set new password ── */}
        {step === 'newpw' && (
          <>
            <div style={{ background:'#dcfce7', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#15803d', fontWeight:600 }}>
              ✅ OTP verified! Now set your new password.
            </div>

            <div className="input-wrap">
              <label>New Password</label>
              <div style={{ position:'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Minimum 6 characters"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  style={{ paddingRight:44 }}
                />
                <button
                  onClick={() => setShowPw(p => !p)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--muted)' }}>
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="input-wrap">
              <label>Confirm New Password</label>
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Repeat your password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitPassword()}
              />
            </div>

            {/* Password strength indicator */}
            {newPw && (
              <div style={{ marginBottom:14 }}>
                <div style={{ display:'flex', gap:4, marginBottom:4 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ flex:1, height:4, borderRadius:4, background: pwStrength(newPw) >= i ? strengthColor(pwStrength(newPw)) : 'var(--border)', transition:'background 0.3s' }} />
                  ))}
                </div>
                <div style={{ fontSize:11, color: strengthColor(pwStrength(newPw)), fontWeight:700 }}>
                  {['', 'Weak', 'Fair', 'Good', 'Strong'][pwStrength(newPw)]}
                </div>
              </div>
            )}

            <button className="btn btn-primary" onClick={submitPassword} disabled={loading}>
              {loading
                ? <><span className="spinner" style={{ width:16, height:16, borderWidth:2 }} /> Saving...</>
                : '🔐 Change Password'}
            </button>
          </>
        )}

        {/* ── STEP: done ── */}
        {step === 'done' && (
          <div style={{ textAlign:'center', padding:'10px 0 20px' }}>
            <div style={{ fontSize:56, marginBottom:14 }}>🎉</div>
            <div style={{ fontWeight:800, fontSize:18, marginBottom:8 }}>Password Changed!</div>
            <div style={{ fontSize:13, color:'var(--muted)', marginBottom:24 }}>
              Your password has been updated successfully. Use your new password next time you log in.
            </div>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

function pwStrength(pw) {
  let score = 0;
  if (pw.length >= 6)                    score++;
  if (pw.length >= 10)                   score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw))          score++;
  return score;
}
function strengthColor(score) {
  return ['', '#dc2626', '#f97316', '#16a34a', '#2563eb'][score] || '#dc2626';
}
