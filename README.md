# 🎓 PNU ASN — School Management System

A complete mobile-first school management app with separate Teacher and Student portals.

---

## 📁 Project Structure

```
pnu-asn/
├── backend/          ← Node.js + Express + SQLite API
│   ├── routes/       ← auth, students, attendance, work, fees, leave, etc.
│   ├── middleware/   ← JWT auth middleware
│   ├── utils/        ← Cloudinary upload, Firebase notify, Nodemailer OTP
│   ├── db.js         ← SQLite schema (auto-creates all tables)
│   └── server.js     ← Entry point
│
└── frontend/         ← React 18 mobile-first app
    ├── src/
    │   ├── pages/student/   ← Dashboard, Attendance, Work, Fees, Results, Leave...
    │   ├── pages/teacher/   ← Dashboard, Students, Attendance, Work, Fees, Exams...
    │   ├── hooks/useTheme.js
    │   ├── api.js           ← Complete API client
    │   └── index.css        ← Design system (dark/light mode)
    └── public/index.html    ← Splash screen + PWA meta
```

---

## 🚀 Setup

### 1. Backend

```bash
cd backend
cp .env.example .env        # fill in your keys
npm install
npm run dev                  # starts on http://localhost:5000
```

**Required .env values:**
| Key | Where to get it |
|-----|----------------|
| `JWT_SECRET` | Any random string |
| `CLOUDINARY_CLOUD_NAME` | cloudinary.com → Dashboard |
| `CLOUDINARY_API_KEY` | cloudinary.com → Dashboard |
| `CLOUDINARY_API_SECRET` | cloudinary.com → Dashboard |
| `SMTP_USER` | Gmail address |
| `SMTP_PASS` | Gmail App Password (enable 2FA first) |

**Firebase (optional — for push notifications):**
1. Go to console.firebase.google.com
2. Create project → Project Settings → Service Accounts → Generate new private key
3. Save as `backend/firebase-service-account.json`
4. Set `FIREBASE_ENABLED=true` in `.env`

### 2. Frontend

```bash
cd frontend
npm install
npm start                    # starts on http://localhost:3000
```

---

## ✨ Features

### Student Portal
- 📊 Attendance with monthly calendar view
- 📚 Work tab — view homework & assignments, download files, submit
- 💳 Fees — view fee records & payment status
- 🏆 Results — marks, grades, progress bars
- 📋 Leave — apply for leave, track status
- ✉️ Messages — school notices
- 📅 Calendar — events, holidays, exam dates
- 🕐 Timetable — weekly class schedule
- 🔔 Notifications with badge counts

### Teacher Portal
- 🎓 Student profiles — expandable cards with full details, photo upload
- 📊 Attendance — bulk mark with Present/Absent/Late + leave reason dropdown
- 📚 Work — create homework/assignments, upload up to 10 files (100MB each), auto-expiry
- 💳 Fee Management — add records, record payments, class overview
- 📋 Leave — approve/reject with remarks
- 📋 Exams — schedule exams, post results with auto-grade calculation
- ✉️ Notices — post announcements with priority
- 📅 Calendar — add school events
- ⚙️ Settings — dark/light mode, notification preferences

### System Features
- 🌙 Dark / Light mode
- 🔔 In-app notification badges on nav tabs
- 📱 Mobile-first, PWA-ready splash screen
- 🔐 JWT auth with OTP-based password reset (Nodemailer)
- ☁️ Cloudinary file storage (images, videos, PDFs, docs)
- 🔥 Firebase FCM push notifications (optional)
- ⏰ Auto-expiry cron: homework files deleted after 2 weeks, assignments after due date

---

## 🔑 First-time Setup

1. Start backend, visit `http://localhost:5000/api/health` — should return `{ status: "PNU ASN API running ✅" }`
2. Open frontend at `http://localhost:3000`
3. Register a **teacher** account first
4. In the DB (or via teacher dashboard), assign the teacher a `class` (e.g. `10A`)
5. Register student accounts with the same `class`
6. Teacher can now see and manage their students

---

## 📦 Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js, Express, SQLite (sqlite3) |
| Auth | JWT (jsonwebtoken), bcryptjs |
| File Storage | Cloudinary + multer-storage-cloudinary |
| Email / OTP | Nodemailer (Gmail SMTP) |
| Push Notifications | Firebase Admin SDK (FCM) |
| Cron | node-cron |
| Frontend | React 18 |
| Styling | Custom CSS (no Tailwind) — design tokens, dark/light mode |
| Fonts | Plus Jakarta Sans, DM Mono (Google Fonts) |
