// src/pages/teacher/TeacherStudentsPage.jsx
import { useEffect, useState, useRef, useCallback } from 'react';
import { api, resolveFileUrl } from '../../api';

const REMARKS = ['Good', 'Need Improvement', 'Bad'];

// ── IMAGE EDITOR (crop + mirror) ─────────────────────────────────
function ImageEditor({ file, onSave, onCancel }) {
  const canvasRef  = useRef();
  const [img, setImg]       = useState(null);
  const [mirrored, setMirrored] = useState(false);
  const [crop, setCrop]     = useState({ x:0, y:0, size:100 }); // percent
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [saving, setSaving] = useState(false);

  // Load image from file
  useEffect(() => {
    const reader = new FileReader();
    reader.onload = e => {
      const image = new Image();
      image.onload = () => setImg(image);
      image.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }, [file]);

  // Draw to canvas whenever state changes
  useEffect(() => {
    if (!img || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    const size   = 300;
    canvas.width  = size;
    canvas.height = size;

    // Compute crop region in image pixels
    const cropPx = (crop.size / 100) * Math.min(img.width, img.height);
    const srcX   = (crop.x / 100) * img.width;
    const srcY   = (crop.y / 100) * img.height;

    ctx.clearRect(0, 0, size, size);

    if (mirrored) {
      ctx.save();
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(img, srcX, srcY, cropPx, cropPx, 0, 0, size, size);

    if (mirrored) ctx.restore();

  }, [img, crop, mirrored]);

  function onMouseDown(e) {
    setDragging(true);
    const rect = canvasRef.current.getBoundingClientRect();
    setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top, cropX: crop.x, cropY: crop.y });
  }
  function onMouseMove(e) {
    if (!dragging || !dragStart || !img) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = ((e.clientX - rect.left) - dragStart.x) / rect.width  * 100;
    const dy = ((e.clientY - rect.top)  - dragStart.y) / rect.height * 100;
    setCrop(c => ({
      ...c,
      x: Math.max(0, Math.min(100 - c.size, dragStart.cropX - dx * (img.width / Math.min(img.width, img.height)))),
      y: Math.max(0, Math.min(100 - c.size, dragStart.cropY - dy * (img.height / Math.min(img.width, img.height)))),
    }));
  }
  function onMouseUp() { setDragging(false); }

  // Touch support
  function onTouchStart(e) { onMouseDown(e.touches[0]); }
  function onTouchMove(e)  { e.preventDefault(); onMouseMove(e.touches[0]); }

  async function handleSave() {
    setSaving(true);
    canvasRef.current.toBlob(async (blob) => {
      const outFile = new File([blob], 'photo.png', { type: 'image/png' });
      await onSave(outFile);
      setSaving(false);
    }, 'image/png', 0.92);
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:999, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'var(--card)', borderRadius:20, padding:20, width:'100%', maxWidth:360 }}>
        <div style={{ fontWeight:800, fontSize:16, marginBottom:14, textAlign:'center' }}>Edit Photo</div>

        {/* Canvas */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
          {!img ? (
            <div style={{ width:300, height:300, borderRadius:'50%', background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)', fontSize:14 }}>Loading...</div>
          ) : (
            <canvas
              ref={canvasRef}
              style={{
  borderRadius: 16,
  cursor: 'move',
  border: '3px solid var(--accent)',
  touchAction: 'none'
}}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onMouseUp}
            />
          )}
        </div>

        {/* Zoom slider */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', marginBottom:6 }}>ZOOM</div>
          <input type="range" min={10} max={100} value={crop.size}
            onChange={e => setCrop(c => ({ ...c, size: parseInt(e.target.value) }))}
            style={{ width:'100%', accentColor:'var(--accent)' }} />
        </div>

        {/* Mirror toggle */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, padding:'10px 14px', background:'var(--bg2)', borderRadius:10 }}>
          <div style={{ fontWeight:700, fontSize:14 }}>🔄 Mirror (Flip Horizontal)</div>
          <label className="toggle">
            <input type="checkbox" checked={mirrored} onChange={e => setMirrored(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>

        <div style={{ fontSize:12, color:'var(--muted)', marginBottom:14, textAlign:'center' }}>
          Drag the photo to reposition • Use zoom to adjust
        </div>

        {/* Buttons */}
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !img} style={{ flex:1 }}>
            {saving ? 'Saving...' : '✅ Save Photo'}
          </button>
          <button className="btn btn-ghost" onClick={onCancel} style={{ flex:1 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────
export default function TeacherStudentsPage({ onNavigate }) {
  const [students,  setStudents]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState(null);
  const [detail,    setDetail]    = useState({});
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState({});
  const [msg,       setMsg]       = useState('');
  const [uploading, setUploading] = useState(null);
  const [editorFile, setEditorFile] = useState(null);  // file pending crop/mirror
  const [editorStudentId, setEditorStudentId] = useState(null);
  const fileRef = useRef();

  const load = () => api.getStudents()
    .then(d => setStudents(d.students || []))
    .catch(() => {})
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  async function expand(s) {
    if (expanded === s.id) { setExpanded(null); return; }
    setExpanded(s.id);
    if (!detail[s.id]) {
      const d = await api.getStudent(s.id).catch(() => null);
      if (d) setDetail(prev => ({ ...prev, [s.id]: d }));
    }
  }

  async function saveEdit(id) {
    try {
      await api.updateStudent(id, form);
      setMsg('✅ Student updated!');
      setEditing(null);
      load();
      const d = await api.getStudent(id).catch(() => null);
      if (d) setDetail(prev => ({ ...prev, [id]: d }));
    } catch (e) { setMsg('Error: ' + e.message); }
    setTimeout(() => setMsg(''), 3000);
  }

  // Step 1: file picked → open editor
  function handleFileChosen(id, file) {
    setEditorStudentId(id);
    setEditorFile(file);
  }

  // Step 2: editor saved → upload cropped canvas blob
  async function handleEditorSave(croppedFile) {
    const id = editorStudentId;
    setEditorFile(null);
    setEditorStudentId(null);
    setUploading(id);
    const fd = new FormData();
    fd.append('photo', croppedFile, 'photo.png');
    try {
      const r = await api.uploadPhoto(id, fd);
      setMsg('✅ Photo updated!');
      const photoUrl = resolveFileUrl(r.photo_url);
      setStudents(prev => prev.map(s => s.id === id ? { ...s, photo_url: photoUrl } : s));
    } catch (e) { setMsg('Error: ' + e.message); }
    setUploading(null);
    setTimeout(() => setMsg(''), 3000);
  }

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /></div></div>;

  return (
    <div className="page">
      {/* Image editor overlay */}
      {editorFile && (
        <ImageEditor
          file={editorFile}
          onSave={handleEditorSave}
          onCancel={() => { setEditorFile(null); setEditorStudentId(null); }}
        />
      )}

      <div className="page-header">
        <div>
          <div className="page-title">Students</div>
          <div className="page-subtitle">{students.length} student{students.length !== 1 ? 's' : ''} in your class</div>
        </div>
      </div>

      {msg && <div className={`alert ${msg.startsWith('Error') ? 'alert-error' : 'alert-success'}`}>{msg}</div>}

      {students.length === 0 && (
        <div className="empty">
          <div className="empty-icon">🎓</div>
          <div className="empty-title">No students yet</div>
          <div className="empty-sub">Students appear once assigned to your class</div>
        </div>
      )}

      {students.map(s => {
        const d       = detail[s.id];
        const isExp   = expanded === s.id;
        const isEd    = editing  === s.id;
        const pct     = d ? (d.attendance.total > 0 ? Math.round((d.attendance.present / d.attendance.total) * 100) : 0) : 0;
        const attColor = pct >= 75 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';

        return (
          <div key={s.id} className="card" style={{ marginBottom: 10 }}>

            {/* ── Header row ── */}
            <div className="expandable-header" onClick={() => expand(s)}>
              <div style={{ display:'flex', gap:12, alignItems:'center', flex:1 }}>
                {/* Avatar */}
                <div style={{ position:'relative', flexShrink:0 }}>
                  {s.photo_url
                    ? <img src={resolveFileUrl(s.photo_url)} alt="" style={{ width:52, height:52, borderRadius:'50%', objectFit:'cover' }} />
                    : <div style={{ width:52, height:52, borderRadius:'50%', background:'linear-gradient(135deg,#2563EB,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:20 }}>{s.name?.charAt(0)}</div>}
                  {uploading === s.id && (
                    <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <div className="spinner" style={{ width:20, height:20, borderWidth:2, borderColor:'rgba(255,255,255,0.3)', borderTopColor:'#fff' }} />
                    </div>
                  )}
                </div>
                <div>
                  <div className="list-item-title">{s.name}</div>
                  <div className="list-item-sub">{s.student_id || 'No ID'} • Roll {s.roll_number || '–'}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>Class {s.class || '–'}{s.section || ''}</div>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                <span className={`badge ${s.remarks === 'Good' ? 'badge-green' : s.remarks === 'Bad' ? 'badge-red' : 'badge-yellow'}`}>{s.remarks || 'Good'}</span>
                <span className="expand-icon">{isExp ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* ── Expanded body ── */}
            <div className={`expandable-body ${isExp ? 'open' : ''}`}>
              <div className="divider" />

              {!d && <div className="loading" style={{ padding:'16px 0' }}><div className="spinner" /></div>}

              {d && !isEd && (
                <>
                  {/* Action buttons */}
                  <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      setEditing(s.id);
                      setForm({
                        class: s.class, section: s.section, roll_number: s.roll_number,
                        grade: s.grade, student_id: s.student_id,
                        father_name: d.student.father_name, mother_name: d.student.mother_name,
                        parent_phone: d.student.parent_phone, emergency_contact: d.student.emergency_contact,
                        remarks: s.remarks, academic_year: d.student.academic_year,
                      });
                    }}>✏️ Edit</button>

                    {/* Photo button — triggers file input → editor */}
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      fileRef.current.dataset.id = s.id;
                      fileRef.current.click();
                    }}>📷 Change Photo</button>
                  </div>

                  {/* Attendance */}
                  <SectionCard title="📊 Attendance">
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:10 }}>
                      {[['Days', d.attendance.total, 'var(--text)'], ['Present', d.attendance.present, 'var(--green)'], ['Absent', d.attendance.absent, 'var(--red)']].map(([l,v,c]) => (
                        <div key={l} style={{ textAlign:'center', padding:'10px 6px', background:'var(--bg2)', borderRadius:10 }}>
                          <div style={{ fontWeight:900, fontSize:18, color:c }}>{v}</div>
                          <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'var(--text2)' }}>Attendance %</span>
                      <span style={{ fontWeight:900, fontSize:16, color:attColor }}>{pct}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width:`${pct}%`, background:attColor }} />
                    </div>
                  </SectionCard>

                  {/* Fees */}
                  <SectionCard title="💳 Fee Details">
                    <Row label="Total"   value={`₹${(d.fees?.total || 0).toLocaleString()}`} />
                    <Row label="Paid"    value={`₹${(d.fees?.paid  || 0).toLocaleString()}`} color="var(--green)" />
                    <Row label="Pending" value={`₹${((d.fees?.total || 0) - (d.fees?.paid || 0)).toLocaleString()}`} color="var(--red)" />
                    {d.fees?.last_pay && <Row label="Last Payment" value={d.fees.last_pay} />}
                  </SectionCard>

                  {/* Results */}
                  {d.results?.length > 0 && (
                    <SectionCard title="🏆 Academic Performance">
                      {d.results.slice(0, 5).map((r, i) => {
                        const pct2 = Math.round(r.marks / r.total_marks * 100);
                        return (
                          <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:8, borderBottom:'1px solid var(--border)', marginBottom:8 }}>
                            <div>
                              <div style={{ fontWeight:700, fontSize:13 }}>{r.subject}</div>
                              <div style={{ fontSize:11, color:'var(--muted)' }}>{r.exam_type} • {r.exam_date}</div>
                            </div>
                            <div style={{ textAlign:'right' }}>
                              <span style={{ fontWeight:900, fontSize:15, color: pct2>=75?'var(--green)':pct2>=50?'var(--yellow)':'var(--red)' }}>{r.marks}/{r.total_marks}</span>
                              <br />
                              <span className="badge badge-blue" style={{ fontSize:10 }}>{r.grade}</span>
                            </div>
                          </div>
                        );
                      })}
                    </SectionCard>
                  )}

                  {/* Parent Info */}
                  <SectionCard title="👨‍👩‍👧 Parent Information">
                    <Row label="Father"    value={d.student.father_name      || '–'} />
                    <Row label="Mother"    value={d.student.mother_name      || '–'} />
                    <Row label="Phone"     value={d.student.parent_phone     || '–'} />
                    <Row label="Emergency" value={d.student.emergency_contact|| '–'} />
                  </SectionCard>

                  {/* Leave history */}
                  {d.leave?.length > 0 && (
                    <SectionCard title="📋 Leave History">
                      {d.leave.slice(0, 4).map(l => (
                        <div key={l.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:8, paddingBottom:8, borderBottom:'1px solid var(--border)' }}>
                          <div>
                            <div style={{ fontSize:13, fontWeight:600 }}>{l.reason}</div>
                            <div style={{ fontSize:11, color:'var(--muted)' }}>{l.from_date} → {l.to_date}</div>
                          </div>
                          <span className={`badge ${l.status === 'approved' ? 'badge-green' : l.status === 'rejected' ? 'badge-red' : 'badge-yellow'}`}>{l.status}</span>
                        </div>
                      ))}
                    </SectionCard>
                  )}
                </>
              )}

              {/* ── Edit form ── */}
              {isEd && (
                <div>
                  <div style={{ fontWeight:800, fontSize:14, marginBottom:14 }}>Edit Student</div>
                  {[
                    ['Class',            'class'],
                    ['Section',          'section'],
                    ['Roll No',          'roll_number'],
                    ['Student ID',       'student_id'],
                    ['Grade',            'grade'],
                    ['Academic Year',    'academic_year'],
                    ['Father Name',      'father_name'],
                    ['Mother Name',      'mother_name'],
                    ['Parent Phone',     'parent_phone'],
                    ['Emergency Contact','emergency_contact'],
                  ].map(([label, key]) => (
                    <div key={key} className="input-wrap">
                      <label>{label}</label>
                      <input value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                    </div>
                  ))}
                  <div className="input-wrap">
                    <label>Remarks</label>
                    <select value={form.remarks || 'Good'} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}>
                      {REMARKS.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="btn btn-primary" style={{ flex:1 }} onClick={() => saveEdit(s.id)}>Save</button>
                    <button className="btn btn-ghost"   style={{ flex:1 }} onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display:'none' }}
        onChange={e => {
          const id   = parseInt(fileRef.current.dataset.id);
          const file = e.target.files[0];
          if (file) handleFileChosen(id, file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div style={{ background:'var(--bg2)', borderRadius:12, padding:14, marginBottom:10 }}>
      <div style={{ fontWeight:800, fontSize:13, marginBottom:10, color:'var(--text2)' }}>{title}</div>
      {children}
    </div>
  );
}
function Row({ label, value, color }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', paddingBottom:7, marginBottom:7, borderBottom:'1px solid var(--border)' }}>
      <span style={{ fontSize:12, fontWeight:600, color:'var(--muted)' }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:700, color: color || 'var(--text)' }}>{value}</span>
    </div>
  );
}
