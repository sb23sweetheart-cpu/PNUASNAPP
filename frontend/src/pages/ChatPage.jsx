// src/pages/ChatPage.jsx
import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../api';

function timeAgo(ts) {
  if (!ts) return '';
  const d = new Date(ts), now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

function SeenTick({ msg, myId }) {
  if (Number(msg.sender_id) !== myId) return null;
  if (msg.optimistic) return <span style={{ fontSize:10, opacity:0.5 }}>⏳</span>;
  if (msg.is_deleted)  return null;
  return (
    <span style={{ fontSize:11, marginLeft:3 }}>
      {msg.is_read
        ? <span style={{ color:'#60d3f5', fontWeight:700 }} title="Seen">✓✓</span>
        : <span style={{ opacity:0.5 }}        title="Sent">✓✓</span>}
    </span>
  );
}

function ReplyPreview({ replyBody, replySender, onCancel }) {
  return (
    <div style={{
      margin:'0 12px 6px', padding:'8px 12px',
      background:'var(--bg2)', borderLeft:'3px solid var(--accent)',
      borderRadius:'0 10px 10px 0', display:'flex', justifyContent:'space-between', alignItems:'flex-start',
    }}>
      <div>
        <div style={{ fontSize:11, fontWeight:800, color:'var(--accent)', marginBottom:2 }}>
          Replying to {replySender}
        </div>
        <div style={{ fontSize:12, color:'var(--muted)', overflow:'hidden', whiteSpace:'nowrap',
          textOverflow:'ellipsis', maxWidth:260 }}>
          {replyBody}
        </div>
      </div>
      {onCancel && (
        <button onClick={onCancel} style={{ background:'none', border:'none',
          cursor:'pointer', color:'var(--muted)', fontSize:18, padding:'0 0 0 8px', lineHeight:1 }}>
          ×
        </button>
      )}
    </div>
  );
}

export default function ChatPage({ user, onChatWindowChange }) {
  const [contacts, setContacts]   = useState([]);
  const [active, setActive]       = useState(null);
  const [msgs, setMsgs]           = useState([]);
  const [text, setText]           = useState('');
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState(false);
  const [sendError, setSendError] = useState('');
  const [replyTo, setReplyTo]     = useState(null);  // { id, body, sender_name }
  const [menu, setMenu]           = useState(null);  // { msgId, mine, x, y }

  const lastId    = useRef(0);
  const bottomRef = useRef(null);
  const pollTimer = useRef(null);
  const inputRef  = useRef(null);
  const myId      = Number(user.id);

  // ── Contacts ──
  useEffect(() => {
    api.getChatContacts()
      .then(d => setContacts(d.contacts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Load messages ──
  useEffect(() => {
    if (!active) return;
    setMsgs([]); setSendError(''); setReplyTo(null);
    lastId.current = 0;
    api.getChatMessages(active.id).then(d => {
      const m = d.messages || [];
      setMsgs(m);
      if (m.length) lastId.current = m[m.length - 1].id;
    }).catch(() => {});
    api.markChatRead(active.id).catch(() => {});
  }, [active]);

  // ── Poll every 3s ──
  useEffect(() => {
    if (!active) return;
    clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      try {
        const d = await api.pollChat(active.id, lastId.current);
        if (d.messages?.length) {
          setMsgs(prev => {
            const existingIds = new Set(prev.filter(m => !m.optimistic).map(m => m.id));
            const fresh = d.messages.filter(m => !existingIds.has(m.id));
            // Update is_read on existing messages sent by me that the other person has now seen
            const updated = prev.map(m => {
              const serverVersion = d.messages.find(dm => dm.id === m.id);
              return serverVersion ? { ...m, is_read: serverVersion.is_read } : m;
            });
            return [...updated.filter(m => !m.optimistic), ...fresh];
          });
          lastId.current = d.messages[d.messages.length - 1].id;
        }
      } catch {}
    }, 3000);
    return () => clearInterval(pollTimer.current);
  }, [active]);

  // ── Auto-scroll ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  // ── Close context menu on outside tap ──
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);

  // ── Send ──
  async function send() {
    if (!text.trim() || !active || sending) return;
    setSending(true); setSendError('');
    const body = text.trim();
    const replyToId = replyTo?.id || null;
    setText(''); setReplyTo(null);

    const tmpId = `tmp-${Date.now()}`;
    setMsgs(prev => [...prev, {
      id: tmpId, optimistic: true,
      sender_id: myId, receiver_id: active.id,
      body, created_at: new Date().toISOString(),
      sender_name: user.name, is_read: 0, is_deleted: 0,
      reply_to_id: replyToId,
      reply_body: replyTo?.body || null,
      reply_sender_name: replyTo?.sender_name || null,
    }]);

    try {
      const res = await api.sendChatMessage(active.id, { body, reply_to_id: replyToId });
      setMsgs(prev => prev.map(m => m.id === tmpId ? { ...res, optimistic: false } : m));
      lastId.current = res.id;
      api.getChatContacts().then(d => setContacts(d.contacts || [])).catch(() => {});
    } catch (e) {
      setMsgs(prev => prev.filter(m => m.id !== tmpId));
      setText(body); setReplyTo(replyTo);
      setSendError(e.message || 'Failed to send. Try again.');
    }
    setSending(false);
  }

  // ── Unsend ──
  async function unsend(msgId) {
    setMenu(null);
    setMsgs(prev => prev.map(m => m.id === msgId ? { ...m, is_deleted: 1, body: '' } : m));
    try {
      await api.unsendMessage(active.id, msgId);
    } catch {
      // Revert on failure — refetch
      api.getChatMessages(active.id).then(d => setMsgs(d.messages || []));
    }
  }

  // ── Reply ──
  function startReply(msg) {
    setMenu(null);
    setReplyTo({ id: msg.id, body: msg.body, sender_name: msg.sender_name });
    inputRef.current?.focus();
  }

  // ── Long-press / right-click menu ──
  function showMenu(e, msg) {
    e.preventDefault();
    const mine = Number(msg.sender_id) === myId;
    setMenu({ msgId: msg.id, msg, mine });
  }

  function openChat(contact) {
    setActive(contact);
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, unread: 0 } : c));
    onChatWindowChange?.(true);
  }

  if (loading) return <div className="page"><div className="loading"><div className="spinner"/></div></div>;

  // ── Contacts list ──
  if (!active) return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">Messages</div>
        <div className="page-subtitle">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</div></div>
      </div>
      {contacts.length === 0 && (
        <div className="empty">
          <div className="empty-icon">💬</div>
          <div className="empty-title">No contacts yet</div>
          <div className="empty-sub">{user.role === 'student' ? 'Your teacher will appear here once you are assigned to a class' : 'Your students will appear here once assigned to your class'}</div>
        </div>
      )}
      {contacts.map(c => (
        <div key={c.id} onClick={() => openChat(c)} className="list-item"
          style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
          <div style={{ width:46, height:46, borderRadius:'50%', flexShrink:0, position:'relative',
            background:'linear-gradient(135deg,var(--accent),var(--navy2))',
            display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:16 }}>
            {c.photo_url ? <img src={c.photo_url} alt="" style={{ width:46, height:46, borderRadius:'50%', objectFit:'cover' }} /> : c.name[0].toUpperCase()}
            {c.unread > 0 && <span style={{ position:'absolute', top:-3, right:-3, background:'var(--red)', color:'#fff', fontSize:9, fontWeight:800, borderRadius:99, padding:'1px 5px', border:'2px solid var(--card)' }}>{c.unread}</span>}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>{c.name}</div>
            <div style={{ fontSize:12, color:'var(--muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontStyle: c.last_message === 'Message unsent' ? 'italic' : 'normal' }}>
              {c.last_message || 'No messages yet'}
            </div>
          </div>
          <div style={{ fontSize:10, color:'var(--muted)', flexShrink:0 }}>{timeAgo(c.last_at)}</div>
        </div>
      ))}
    </div>
  );

  // ── Chat window ──
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100dvh', maxWidth:430, margin:'0 auto', background:'var(--bg)' }}>

      {/* Header */}
      <div style={{ padding:'52px 16px 14px', background:'var(--card)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <button onClick={() => { setActive(null); onChatWindowChange?.(false); }}
          style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'var(--text2)', padding:'4px 10px 4px 0', lineHeight:1 }}>←</button>
        <div style={{ width:38, height:38, borderRadius:'50%', flexShrink:0,
          background:'linear-gradient(135deg,var(--accent),var(--navy2))',
          display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800 }}>
          {active.photo_url ? <img src={active.photo_url} alt="" style={{ width:38, height:38, borderRadius:'50%', objectFit:'cover' }} /> : active.name[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight:800, fontSize:15 }}>{active.name}</div>
          <div style={{ fontSize:11, color:'var(--muted)' }}>{active.role}{active.class ? ` · Class ${active.class}` : ''}</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 10px', display:'flex', flexDirection:'column', gap:4 }}
        onClick={() => setMenu(null)}>
        {msgs.length === 0 && <div style={{ textAlign:'center', color:'var(--muted)', fontSize:13, marginTop:48 }}>No messages yet. Say hello! 👋</div>}

        {msgs.map(m => {
          const mine    = Number(m.sender_id) === myId;
          const deleted = m.is_deleted;
          return (
            <div key={m.id} style={{ display:'flex', flexDirection:'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              {/* Reply quote */}
              {m.reply_body && !deleted && (
                <div style={{
                  maxWidth:'72%', margin: mine ? '0 4px 2px 0' : '0 0 2px 4px',
                  padding:'5px 10px', borderRadius:10,
                  background:'var(--bg2)', borderLeft:`3px solid ${mine ? 'rgba(255,255,255,0.4)' : 'var(--accent)'}`,
                }}>
                  <div style={{ fontSize:10, fontWeight:800, color: mine ? 'rgba(255,255,255,0.7)' : 'var(--accent)', marginBottom:1 }}>
                    {m.reply_sender_name}
                  </div>
                  <div style={{ fontSize:11, color:'var(--muted)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', maxWidth:220 }}>
                    {m.reply_body}
                  </div>
                </div>
              )}

              {/* Bubble */}
              <div
                onContextMenu={e => showMenu(e, m)}
                onPointerDown={e => {
                  if (e.pointerType === 'touch') {
                    const t = setTimeout(() => showMenu(e, m), 500);
                    e.currentTarget._lt = t;
                  }
                }}
                onPointerUp={e => clearTimeout(e.currentTarget._lt)}
                onPointerCancel={e => clearTimeout(e.currentTarget._lt)}
                style={{
                  maxWidth:'76%', padding: deleted ? '8px 14px' : '10px 14px',
                  borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: deleted ? 'var(--bg2)' : mine
                    ? 'linear-gradient(135deg,var(--accent),var(--accent2))'
                    : 'var(--card)',
                  color: deleted ? 'var(--muted)' : mine ? '#fff' : 'var(--text)',
                  border: mine ? 'none' : '1px solid var(--border)',
                  boxShadow: deleted ? 'none' : 'var(--shadow-sm)',
                  opacity: m.optimistic ? 0.65 : 1,
                  cursor: 'pointer', userSelect: 'none',
                  fontStyle: deleted ? 'italic' : 'normal',
                }}>
                {deleted
                  ? <span style={{ fontSize:13 }}>🚫 Message unsent</span>
                  : <div style={{ fontSize:14, lineHeight:1.55, wordBreak:'break-word' }}>{m.body}</div>
                }
                {!deleted && (
                  <div style={{ fontSize:10, opacity:0.55, marginTop:3, display:'flex', justifyContent:'flex-end', alignItems:'center', gap:3 }}>
                    {timeAgo(m.created_at)}
                    <SeenTick msg={m} myId={myId} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Context menu */}
      {menu && (
        <div onPointerDown={e => e.stopPropagation()}
          style={{
            position:'fixed', bottom: 80, left:'50%', transform:'translateX(-50%)',
            background:'var(--card)', borderRadius:16, boxShadow:'var(--shadow-lg)',
            border:'1px solid var(--border)', overflow:'hidden', zIndex:200, minWidth:180,
          }}>
          {!menu.msg.is_deleted && (
            <button onClick={() => startReply(menu.msg)}
              style={{ width:'100%', padding:'14px 20px', background:'none', border:'none',
                borderBottom:'1px solid var(--border)', cursor:'pointer',
                fontFamily:'inherit', fontSize:14, fontWeight:600, color:'var(--text)',
                display:'flex', alignItems:'center', gap:10, textAlign:'left' }}>
              ↩️ Reply
            </button>
          )}
          {menu.mine && !menu.msg.is_deleted && (
            <button onClick={() => unsend(menu.msgId)}
              style={{ width:'100%', padding:'14px 20px', background:'none', border:'none',
                cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600,
                color:'var(--red)', display:'flex', alignItems:'center', gap:10, textAlign:'left' }}>
              🚫 Unsend
            </button>
          )}
          <button onClick={() => setMenu(null)}
            style={{ width:'100%', padding:'12px 20px', background:'none', border:'none',
              cursor:'pointer', fontFamily:'inherit', fontSize:13, color:'var(--muted)', textAlign:'center' }}>
            Cancel
          </button>
        </div>
      )}

      {/* Send error */}
      {sendError && (
        <div style={{ padding:'6px 16px', background:'rgba(212,43,43,0.1)', color:'var(--red)', fontSize:12, fontWeight:600, textAlign:'center' }}>
          ⚠️ {sendError}
        </div>
      )}

      {/* Reply preview strip */}
      {replyTo && <ReplyPreview replyBody={replyTo.body} replySender={replyTo.sender_name} onCancel={() => setReplyTo(null)} />}

      {/* Input bar */}
      <div style={{ padding:'10px 12px', paddingBottom:'max(10px, env(safe-area-inset-bottom))',
        background:'var(--card)', borderTop:'1px solid var(--border)',
        display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
        <input
          ref={inputRef}
          value={text}
          onChange={e => { setText(e.target.value); setSendError(''); }}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={replyTo ? `Reply to ${replyTo.sender_name}…` : 'Type a message…'}
          style={{ flex:1, padding:'11px 16px', borderRadius:24,
            border:'1.5px solid var(--border)', background:'var(--bg2)',
            fontSize:14, outline:'none', fontFamily:'inherit' }}
        />
        <button onClick={send} disabled={!text.trim() || sending}
          style={{
            width:44, height:44, borderRadius:'50%', border:'none',
            cursor: text.trim() ? 'pointer' : 'default', flexShrink:0,
            background: text.trim() ? 'linear-gradient(135deg,var(--accent),var(--accent2))' : 'var(--border)',
            color: text.trim() ? '#fff' : 'var(--muted)', fontSize:18,
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all 0.2s', boxShadow: text.trim() ? 'var(--shadow-gold)' : 'none',
          }}>↑</button>
      </div>
    </div>
  );
}
