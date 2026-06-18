// src/pages/student/FeesPage.jsx
import { useEffect, useState } from 'react';
import { api } from '../../api';

const STATUS_BADGE = { paid:'badge-green', partial:'badge-yellow', pending:'badge-red' };

export default function FeesPage() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.getFees().then(setData).catch(()=>{}).finally(()=>setLoading(false)); }, []);

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /></div></div>;

  const { fees = [], summary = {} } = data || {};
  const paidPct = summary.total > 0 ? Math.round((summary.paid / summary.total) * 100) : 0;

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">Fees</div><div className="page-subtitle">Fee records & payment status</div></div>
      </div>

      {/* Summary card */}
      <div className="welcome-card" style={{ background:'linear-gradient(135deg, #4C1D95 0%, #7C3AED 60%, #A855F7 100%)', marginBottom:16 }}>
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ fontSize:13, opacity:0.75, fontWeight:600 }}>Total Fees</div>
          <div style={{ fontSize:28, fontWeight:900, marginTop:2 }}>₹{(summary.total||0).toLocaleString()}</div>
          <div style={{ marginTop:10, display:'flex', gap:16 }}>
            <div><div style={{ fontSize:11, opacity:0.65 }}>PAID</div><div style={{ fontWeight:800, color:'#86efac' }}>₹{(summary.paid||0).toLocaleString()}</div></div>
            <div><div style={{ fontSize:11, opacity:0.65 }}>PENDING</div><div style={{ fontWeight:800, color:'#fca5a5' }}>₹{(summary.pending||0).toLocaleString()}</div></div>
          </div>
        </div>
        <div style={{ position:'relative', zIndex:1, textAlign:'center' }}>
          <div style={{ fontSize:32, fontWeight:900 }}>{paidPct}%</div>
          <div style={{ fontSize:11, opacity:0.65 }}>Paid</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
          <span style={{ fontSize:13, fontWeight:700, color:'var(--text2)' }}>Payment Progress</span>
          <span style={{ fontSize:13, fontWeight:700, color:'var(--purple)' }}>{paidPct}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width:`${paidPct}%`, background:'linear-gradient(90deg,#7C3AED,#A855F7)' }} />
        </div>
      </div>

      {/* Fee records */}
      <div className="section-header">Fee Details</div>
      {fees.length === 0 && <div className="empty"><div className="empty-icon">💳</div><div className="empty-title">No fee records</div></div>}
      {fees.map(f => (
        <div key={f.id} className="list-item">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div className="list-item-title">{f.fee_type}</div>
              <div className="list-item-sub">Due: {f.due_date || 'N/A'} • AY: {f.academic_year}</div>
              {f.last_payment_date && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>Last paid: {f.last_payment_date}</div>}
            </div>
            <span className={`badge ${STATUS_BADGE[f.payment_status]||'badge-gray'}`}>{f.payment_status}</span>
          </div>
          <div className="divider" />
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
            <span style={{ color:'var(--muted)', fontWeight:600 }}>Total: <strong style={{ color:'var(--text)' }}>₹{f.total_amount?.toLocaleString()}</strong></span>
            <span style={{ color:'var(--muted)', fontWeight:600 }}>Paid: <strong style={{ color:'var(--green)' }}>₹{f.paid_amount?.toLocaleString()}</strong></span>
            <span style={{ color:'var(--muted)', fontWeight:600 }}>Due: <strong style={{ color:'var(--red)' }}>₹{(f.total_amount-f.paid_amount)?.toLocaleString()}</strong></span>
          </div>
          {f.notes && <div style={{ fontSize:12, color:'var(--muted)', marginTop:8 }}>📝 {f.notes}</div>}
        </div>
      ))}
    </div>
  );
}
