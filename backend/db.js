// db.js — PNU ASN complete database schema
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'pnu_asn.db'), (err) => {
  if (err) console.error('DB error:', err);
  else console.log('✅ PNU ASN Database connected');
});

db.run('PRAGMA foreign_keys = ON');
db.run('PRAGMA journal_mode = WAL');

// Promise helpers
db.exec2 = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err);
    else resolve({ lastID: this.lastID, changes: this.changes });
  });
});
db.get2 = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
});
db.all2 = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
});

db.serialize(() => {
  // ── USERS ──────────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password      TEXT NOT NULL,
    role          TEXT DEFAULT 'student',
    student_id    TEXT,
    class         TEXT,
    section       TEXT,
    roll_number   TEXT,
    academic_year TEXT DEFAULT '2024-25',
    grade         TEXT DEFAULT 'A+',
    photo_url     TEXT,
    photo_public_id TEXT,
    fcm_token     TEXT,
    father_name   TEXT,
    mother_name   TEXT,
    parent_phone  TEXT,
    emergency_contact TEXT,
    remarks       TEXT DEFAULT 'Good',
    is_active     INTEGER DEFAULT 1,
    email_verified INTEGER DEFAULT 0,
    created_at    TEXT DEFAULT (datetime('now'))
  )`);

  // ── OTP ────────────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS otp_codes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT NOT NULL,
    code       TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used       INTEGER DEFAULT 0,
    purpose    TEXT DEFAULT 'reset',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // ── CHAT MESSAGES ───────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id   INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    body        TEXT NOT NULL,
    is_read     INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (sender_id)   REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
  )`);

  // ── ACTIVITY LOG ────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS activity_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id   INTEGER NOT NULL,
    action     TEXT NOT NULL,
    entity     TEXT,
    entity_id  INTEGER,
    detail     TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (actor_id) REFERENCES users(id)
  )`);

  // ── ATTENDANCE ─────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id   INTEGER NOT NULL,
    date         TEXT NOT NULL,
    status       TEXT DEFAULT 'present',
    is_late      INTEGER DEFAULT 0,
    leave_reason TEXT,
    marked_by    INTEGER,
    created_at   TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (marked_by)  REFERENCES users(id),
    UNIQUE(student_id, date)
  )`);

  // ── TIMETABLE ──────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS timetable (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    class      TEXT NOT NULL,
    section    TEXT,
    day        TEXT NOT NULL,
    subject    TEXT NOT NULL,
    time_start TEXT NOT NULL,
    time_end   TEXT NOT NULL,
    teacher_id INTEGER,
    FOREIGN KEY (teacher_id) REFERENCES users(id)
  )`);

  // ── EXAMINATIONS ───────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS examinations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    class      TEXT NOT NULL,
    section    TEXT,
    subject    TEXT NOT NULL,
    exam_date  TEXT NOT NULL,
    exam_type  TEXT DEFAULT 'unit',
    total_marks INTEGER DEFAULT 100,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`);

  // ── EXAM RESULTS ───────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS exam_results (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id  INTEGER NOT NULL,
    exam_id     INTEGER NOT NULL,
    marks       REAL,
    total_marks INTEGER DEFAULT 100,
    grade       TEXT,
    remarks     TEXT,
    entered_by  INTEGER,
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (exam_id)    REFERENCES examinations(id),
    FOREIGN KEY (entered_by) REFERENCES users(id),
    UNIQUE(student_id, exam_id)
  )`);

  // ── LEAVE REQUESTS ─────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS leave_requests (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id   INTEGER NOT NULL,
    reason       TEXT NOT NULL,
    leave_type   TEXT DEFAULT 'casual',
    from_date    TEXT NOT NULL,
    to_date      TEXT NOT NULL,
    status       TEXT DEFAULT 'pending',
    teacher_remark TEXT,
    reviewed_by  INTEGER,
    reviewed_at  TEXT,
    created_at   TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (student_id)  REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
  )`);

  // ── MESSAGES / NOTICES ─────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id  INTEGER NOT NULL,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    target     TEXT DEFAULT 'all',
    priority   TEXT DEFAULT 'normal',
    is_read_by TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (sender_id) REFERENCES users(id)
  )`);

  // ── CALENDAR EVENTS ────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS calendar_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT,
    event_date  TEXT NOT NULL,
    end_date    TEXT,
    event_type  TEXT DEFAULT 'general',
    class       TEXT,
    created_by  INTEGER,
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`);

  // ── FEES ───────────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS fees (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id       INTEGER NOT NULL,
    fee_type         TEXT NOT NULL,
    total_amount     REAL NOT NULL,
    paid_amount      REAL DEFAULT 0,
    due_date         TEXT,
    last_payment_date TEXT,
    payment_status   TEXT DEFAULT 'pending',
    academic_year    TEXT DEFAULT '2024-25',
    notes            TEXT,
    created_at       TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES users(id)
  )`);

  // ── WORK (HOMEWORK / ASSIGNMENTS) ──────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS work (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id   INTEGER NOT NULL,
    work_type    TEXT NOT NULL,
    title        TEXT NOT NULL,
    subject      TEXT NOT NULL,
    description  TEXT,
    instructions TEXT,
    class        TEXT NOT NULL,
    section      TEXT,
    due_date     TEXT NOT NULL,
    is_important INTEGER DEFAULT 0,
    status       TEXT DEFAULT 'active',
    expires_at   TEXT,
    created_at   TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (teacher_id) REFERENCES users(id)
  )`);

  // ── WORK ATTACHMENTS ───────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS work_attachments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    work_id     INTEGER NOT NULL,
    file_name   TEXT NOT NULL,
    file_url    TEXT NOT NULL,
    public_id   TEXT,
    file_type   TEXT,
    file_size   INTEGER,
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (work_id) REFERENCES work(id) ON DELETE CASCADE
  )`);

  // ── WORK SUBMISSIONS ───────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS work_submissions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    work_id     INTEGER NOT NULL,
    student_id  INTEGER NOT NULL,
    status      TEXT DEFAULT 'pending',
    remark      TEXT,
    submitted_at TEXT,
    reviewed_at  TEXT,
    reviewed_by  INTEGER,
    FOREIGN KEY (work_id)     REFERENCES work(id),
    FOREIGN KEY (student_id)  REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id),
    UNIQUE(work_id, student_id)
  )`);

  // ── NOTIFICATIONS ──────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    type       TEXT DEFAULT 'general',
    is_read    INTEGER DEFAULT 0,
    ref_id     INTEGER,
    ref_type   TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  console.log('✅ PNU ASN Tables ready');

  // ── MIGRATIONS (safe to run on existing DBs) ───────────────────
  // Add columns that may be missing from older databases
  const migrations = [
    "ALTER TABLE otp_codes ADD COLUMN purpose TEXT DEFAULT 'reset'",
    "ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0",
    "UPDATE otp_codes SET purpose='reset' WHERE purpose IS NULL",
    // Mark existing users as verified so they aren't locked out
    "UPDATE users SET email_verified=1 WHERE email_verified IS NULL OR email_verified=0",
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id   INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      body        TEXT NOT NULL,
      is_read     INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sender_id)   REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS activity_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id   INTEGER NOT NULL,
      action     TEXT NOT NULL,
      entity     TEXT,
      entity_id  INTEGER,
      detail     TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (actor_id) REFERENCES users(id)
    )`,
  ];

  for (const sql of migrations) {
    db.run(sql, [], (err) => {
      // Ignore "duplicate column" errors — means migration already ran
      if (err && !err.message.includes('duplicate column') && !err.message.includes('already exists')) {
        console.warn('Migration warning:', err.message);
      }
    });
  }
});

module.exports = db;
