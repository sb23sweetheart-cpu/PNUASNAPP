// src/pages/teacher/TeacherFeesPage.jsx
import { useEffect, useState } from 'react';
import { api } from '../../api';

const FEE_TYPES = ['Tuition Fee','Exam Fee','Library Fee','Sports Fee','Lab Fee','Transport Fee','Hostel Fee','Miscellaneous'];
const STATUS_BADGE = { paid:'badge-green', partial:'badge-yellow', pending:'badge-red' };

export default function TeacherFeesPage() {
  const [tab,      setTab]      = useState('overview');
  const [classData,setClassData]= useState(null);
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null); // selected student id for adding fee
  const [studentFees, setStudentFees] = useState(null);
  const [feesLoading, setFeesLoading] = useState(false);
  const [form,     setForm]     = useState({ student_id:'', fee_type:'Tuition Fee', total_amount:'', paid_amount:'', due_date:'', academic_year:'2024-25', notes:'' });
  const [editFee,  setEditFee]  = useState(null);
  const [editForm, setEditForm] = useState({});
  const [msg,      setMsg]      = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadClass = () => api.getClassFees().then(setClassData).catch(()=>{}).finally(()=>setLoading(false));
  const loadStudents = () => api.getStudents().then(d=>setStudents(d.students||[])).catch(()=>{});

  useEffect(() => { loadClass(); loadStudents(); }, []);

  async function loadStudentFees(id) {
    setFeesLoading(true);
    const d = await api.getStudentFees(id).catch(()=>null);
    setStudentFees(d);
    setFeesLoading(false);
  }

  async function addFee() {
    if (!form.student_id || !form.total_amount) { setMsg('Student and total amount are required.'); return; }
    setSubmitting(true); setMsg('');
    try {
      await api.addFee({ ...form, total_amount: parseFloat(form.total_amount), paid_amount: parseFloat(form.paid_amount||0) });
      setMsg('✅ Fee record added!');
      setForm({ student_id:'', fee_type:'Tuition Fee', total_amount:'', paid_amount:'', due_date:'', academic_year:'2024-25', notes:'' });
      loadClass();
      if (selected) loadStudentFees(selected);
    } catch(e) { setMsg('Error: '+e.message); }
    setSubmitting(false);
    setTimeout(()=>setMsg(''),3000);
  }

  async function updateFee(id) {
    setSubmitting(true);
    try {
      await api.updateFee(id, { paid_amount: parseFloat(editForm.paid_amount), notes: editForm.notes, last_payment_date: editForm.last_payment_date });
      setMsg('✅ Payment recorded!');
      setEditFee(null);
      loadClass();
      if (selected) loadStudentFees(selected);
    } catch(e) { setMsg('Error: '+e.message); }
    setSubmitting(false);
    setTimeout(()=>setMsg(''),3000);
  }

  const set  = (k,v) => setForm(f=>({...f,[k]:v}));
  const setE = (k,v) => setEditForm(f=>({...f,[k]:v}));

  if (loading) return <div className="page"><div className="loading"><div className="spinner"/></div></div>;

  const summary = classData?.summary || {};

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">Fee Management</div><div className="page-subtitle">Track & manage student fees</div></div>
      </div>

      {msg && <div className={`alert ${msg.startsWith('Error')?'alert-error':'alert-success'}`}>{msg}</div>}

      {/* Summary cards */}
      <div className="stats-grid" style={{ gridTemplateColumns:'repeat(3,1fr)', marginBottom:14 }}>
        {[
          { label:'Collected', value:`₹${(summary.totalCollected||0).toLocaleString()}`, color:'var(--green)', bg:'#F0FDF4' },
          { label:'Pending',   value:`₹${(summary.totalPending||0).toLocaleString()}`,   color:'var(--red)',   bg:'#FEF2F2' },
          { label:'Unpaid',    value:`${summary.unpaidCount||0} students`,               color:'var(--yellow)',bg:'#FFFBEB' },
        ].map(s=>(
          <div key={s.label} style={{ background:s.bg, borderRadius:12, padding:'12px 10px', textAlign:'center', border:`1px solid var(--border)` }}>
            <div style={{ fontWeight:900, fontSize:15, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600, marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="tab-bar">
        <button className={`tab-btn ${tab==='overview'?'active':''}`} onClick={()=>setTab('overview')}>Overview</button>
        <button className={`tab-btn ${tab==='student'?'active':''}`}  onClick={()=>setTab('student')}>Student</button>
        <button className={`tab-btn ${tab==='add'?'active':''}`}      onClick={()=>setTab('add')}>+ Add Fee</button>
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <>
          {(classData?.students||[]).length === 0 && <div className="empty"><div className="empty-icon">💳</div><div className="empty-title">No fee data yet</div></div>}
          {(classData?.students||[]).map(s => {
            const paidPct = s.total > 0 ? Math.round((s.paid/s.total)*100) : 0;
            const color   = paidPct >= 100 ? 'var(--green)' : paidPct > 0 ? 'var(--yellow)' : 'var(--red)';
            return (
              <div key={s.id} className="list-item" onClick={()=>{ setSelected(s.id); loadStudentFees(s.id); setTab('student'); }} style={{ cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div className="list-item-title">{s.name}</div>
                    <div className="list-item-sub">Roll {s.roll_number||'–'} • Paid ₹{(s.paid||0).toLocaleString()} / ₹{(s.total||0).toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontWeight:900, fontSize:16, color }}>{paidPct}%</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>→</div>
                  </div>
                </div>
                <div className="progress-bar" style={{ marginTop:8 }}>
                  <div className="progress-fill" style={{ width:`${paidPct}%`, background:color }} />
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ── STUDENT FEES ── */}
      {tab === 'student' && (
        <>
          <div className="input-wrap">
            <label>Select Student</label>
            <select value={selected||''} onChange={e=>{ setSelected(e.target.value); if(e.target.value) loadStudentFees(e.target.value); }}>
              <option value="">Select student...</option>
              {students.map(s=><option key={s.id} value={s.id}>{s.name} (Roll {s.roll_number||'–'})</option>)}
            </select>
          </div>

          {feesLoading && <div className="loading"><div className="spinner"/></div>}

          {!feesLoading && studentFees && (
            <>
              {/* Fee summary for student */}
              <div style={{ background:'linear-gradient(135deg,#4C1D95,#7C3AED)', borderRadius:14, padding:'16px 18px', color:'#fff', marginBottom:14, display:'flex', justifyContent:'space-between' }}>
                <div><div style={{ fontSize:11, opacity:0.7 }}>TOTAL</div><div style={{ fontWeight:900, fontSize:20 }}>₹{(studentFees.summary.total||0).toLocaleString()}</div></div>
                <div><div style={{ fontSize:11, opacity:0.7 }}>PAID</div><div style={{ fontWeight:900, fontSize:20, color:'#86efac' }}>₹{(studentFees.summary.paid||0).toLocaleString()}</div></div>
                <div><div style={{ fontSize:11, opacity:0.7 }}>PENDING</div><div style={{ fontWeight:900, fontSize:20, color:'#fca5a5' }}>₹{(studentFees.summary.pending||0).toLocaleString()}</div></div>
              </div>

              {(studentFees.fees||[]).length===0 && <div className="empty"><div className="empty-icon">💳</div><div className="empty-title">No fee records</div></div>}
              {(studentFees.fees||[]).map(f=>(
                <div key={f.id} className="card" style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <div><div style={{ fontWeight:700, fontSize:14 }}>{f.fee_type}</div><div style={{ fontSize:12, color:'var(--muted)' }}>Due: {f.due_date||'N/A'} • {f.academic_year}</div></div>
                    <span className={`badge ${STATUS_BADGE[f.payment_status]||'badge-gray'}`}>{f.payment_status}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:10 }}>
                    <span>Total: <strong>₹{f.total_amount?.toLocaleString()}</strong></span>
                    <span>Paid: <strong style={{ color:'var(--green)' }}>₹{f.paid_amount?.toLocaleString()}</strong></span>
                    <span>Due: <strong style={{ color:'var(--red)' }}>₹{(f.total_amount-f.paid_amount)?.toLocaleString()}</strong></span>
                  </div>
                  {f.notes && <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10 }}>📝 {f.notes}</div>}

                  {/* Edit payment */}
                  {editFee===f.id ? (
                    <div style={{ marginTop:8 }}>
                      <div className="input-wrap"><label>Paid Amount</label><input type="number" value={editForm.paid_amount||''} onChange={e=>setE('paid_amount',e.target.value)} /></div>
                      <div className="input-wrap"><label>Payment Date</label><input type="date" value={editForm.last_payment_date||''} onChange={e=>setE('last_payment_date',e.target.value)} /></div>
                      <div className="input-wrap"><label>Notes</label><input value={editForm.notes||''} onChange={e=>setE('notes',e.target.value)} /></div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button className="btn btn-green btn-sm" style={{ flex:1 }} onClick={()=>updateFee(f.id)} disabled={submitting}>Save Payment</button>
                        <button className="btn btn-ghost btn-sm" onClick={()=>setEditFee(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={()=>{ setEditFee(f.id); setEditForm({ paid_amount:f.paid_amount, notes:f.notes||'', last_payment_date:f.last_payment_date||'' }); }}>
                      💰 Record Payment
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* ── ADD FEE ── */}
      {tab === 'add' && (
        <div className="card">
          <div style={{ fontWeight:800, fontSize:16, marginBottom:16 }}>Add Fee Record</div>
          <div className="input-wrap">
            <label>Student *</label>
            <select value={form.student_id} onChange={e=>set('student_id',e.target.value)}>
              <option value="">Select student...</option>
              {students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="input-wrap">
            <label>Fee Type *</label>
            <select value={form.fee_type} onChange={e=>set('fee_type',e.target.value)}>
              {FEE_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div className="input-wrap"><label>Total Amount *</label><input type="number" placeholder="e.g. 5000" value={form.total_amount} onChange={e=>set('total_amount',e.target.value)} /></div>
            <div className="input-wrap"><label>Paid Amount</label><input type="number" placeholder="0" value={form.paid_amount} onChange={e=>set('paid_amount',e.target.value)} /></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div className="input-wrap"><label>Due Date</label><input type="date" value={form.due_date} onChange={e=>set('due_date',e.target.value)} /></div>
            <div className="input-wrap"><label>Academic Year</label><input placeholder="2024-25" value={form.academic_year} onChange={e=>set('academic_year',e.target.value)} /></div>
          </div>
          <div className="input-wrap"><label>Notes</label><input placeholder="Optional notes..." value={form.notes} onChange={e=>set('notes',e.target.value)} /></div>
          <button className="btn btn-primary" onClick={addFee} disabled={submitting}>{submitting?'Adding...':'Add Fee Record'}</button>
        </div>
      )}
    </div>
  );
}
