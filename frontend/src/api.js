// src/api.js — PNU ASN complete API client
const BASE = process.env.REACT_APP_API_URL || 'https://pnuasnapp.onrender.com';
const SERVER = BASE.replace('/api', '');

const token = () => localStorage.getItem('pnu_token');

async function req(method, path, body, isFormData = false) {
  const headers = {};
  // IMPORTANT: never set Content-Type for FormData — browser sets it with boundary automatically
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (token()) headers['Authorization'] = `Bearer ${token()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000); // 60s for file uploads

  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      signal: controller.signal,
      ...(body ? { body: isFormData ? body : JSON.stringify(body) } : {}),
    });
    clearTimeout(timer);

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Server error (${res.status}). Make sure the backend is running on port 5000.`);
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      throw new Error('Request timed out. Make sure the backend server is running:\n cd backend && npm start');
    }
    if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError') || e.message.includes('ERR_CONNECTION_REFUSED')) {
      throw new Error('Cannot connect to server. Make sure the backend is running:\n cd backend && npm start');
    }
    throw e;
  }
}

// Resolve a file URL — works for both Cloudinary URLs and local disk paths
export function resolveFileUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${SERVER}${url.startsWith('/') ? '' : '/'}${url}`;
}

export const api = {
  // Auth
  register:          (b)   => req('POST', '/auth/register', b),
  login:             (b)   => req('POST', '/auth/login', b),
  forgotPassword:    (b)   => req('POST', '/auth/forgot-password', b),
  verifyOtp:         (b)   => req('POST', '/auth/verify-otp', b),
  resetPassword:     (b)   => req('POST', '/auth/reset-password', b),
  sendChangeOtp:     ()    => req('POST', '/auth/send-change-otp', {}),   // sends OTP to logged-in user's email
  changePasswordOtp: (b)   => req('PUT',  '/auth/change-password-otp', b), // verifies OTP then changes password
  changePassword:    (b)   => req('PUT',  '/auth/change-password', b),    // legacy (current password method)
  saveFcmToken:      (tok) => req('PUT',  '/auth/fcm-token', { token: tok }),

  // Student profile
  getMe:            ()        => req('GET', '/students/me'),
  updateMyProfile:  (b)       => req('PUT', '/students/me', b),   // works for teacher too
  getStudents:      ()        => req('GET', '/students'),
  getStudent:       (id)      => req('GET', `/students/${id}`),
  updateStudent:    (id, b)   => req('PUT', `/students/${id}`, b),
  uploadPhoto:      (id, fd)  => req('POST', `/students/${id}/photo`, fd, true),

  // Attendance
  getAttendance:      ()         => req('GET', '/attendance'),
  getClassAttendance: (p)        => req('GET', `/attendance/class${p ? `?${p}` : ''}`),
  saveAttendance:     (b)        => req('POST', '/attendance', b),
  getAttendanceReport:(id, p)    => req('GET', `/attendance/report/${id}${p ? `?${p}` : ''}`),

  // Timetable
  getTimetable:    ()   => req('GET', '/timetable'),
  addTimetableSlot:(b)  => req('POST', '/timetable', b),
  deleteTimetable: (id) => req('DELETE', `/timetable/${id}`),

  // Examination
  getExams:        ()   => req('GET', '/examination'),           // student — filtered by JWT class
  getClassExams:   ()   => req('GET', '/examination'),           // teacher — same endpoint, JWT class used server-side
  getResults:      ()   => req('GET', '/examination/results'),
  getClassResults: ()   => req('GET', '/examination/class-results'),
  addExam:         (b)  => req('POST', '/examination', b),
  addResult:       (b)  => req('POST', '/examination/results', b),

  // Leave
  getLeave:      ()          => req('GET', '/leave'),
  getClassLeave: ()          => req('GET', '/leave/class'),
  submitLeave:   (b)         => req('POST', '/leave', b),
  updateLeave:   (id, b)     => req('PUT', `/leave/${id}`, b),

  // Messages
  getMessages:  ()   => req('GET', '/messages'),
  postMessage:  (b)  => req('POST', '/messages', b),
  deleteMessage:(id) => req('DELETE', `/messages/${id}`),

  // Calendar
  getCalendar:      ()   => req('GET', '/calendar'),
  addCalendarEvent: (b)  => req('POST', '/calendar', b),
  deleteEvent:      (id) => req('DELETE', `/calendar/${id}`),

  // Fees
  getFees:        ()       => req('GET', '/fees'),
  getClassFees:   ()       => req('GET', '/fees/class'),
  getStudentFees: (id)     => req('GET', `/fees/student/${id}`),
  addFee:         (b)      => req('POST', '/fees', b),
  updateFee:      (id, b)  => req('PUT', `/fees/${id}`, b),

  // Work
  getWork:           (p) => req('GET', `/work${p ? `?${p}` : ''}`),
  createWork:        (fd)=> req('POST', '/work', fd, true),
  updateWork:        (id,b)=> req('PUT', `/work/${id}`, b),
  deleteWork:        (id)=> req('DELETE', `/work/${id}`),
  getSubmissions:    (id)=> req('GET', `/work/${id}/submissions`),
  reviewSubmission:  (wid,sid,b)=> req('PUT', `/work/${wid}/submission/${sid}`, b),
  submitWork:        (id)=> req('POST', `/work/${id}/submit`, {}),

  // Notifications
  getNotifications:  ()  => req('GET', '/notifications'),
  getUnreadCounts:   ()  => req('GET', '/notifications/unread-counts'),
  markRead:          (id)=> req('PUT', `/notifications/${id}/read`, {}),
  markAllRead:       ()  => req('PUT', '/notifications/read-all', {}),

  // Chat
  getChatContacts:   ()           => req('GET',    '/chat/contacts'),
  getChatMessages:   (uid)        => req('GET',    `/chat/${uid}`),
  sendChatMessage:   (uid, b)     => req('POST',   `/chat/${uid}`, b),
  pollChat:          (uid, after) => req('GET',    `/chat/${uid}/poll?after=${after}`),
  unsendMessage:     (uid, mid)   => req('DELETE', `/chat/${uid}/${mid}`),
  markChatRead:      (uid)        => req('PUT',    `/chat/${uid}/read`, {}),

  // Activity log + Search (teacher)
  getActivityLog:    ()    => req('GET', '/activity'),
  searchTeacher:     (q)   => req('GET', `/activity/search?q=${encodeURIComponent(q)}`),

  // Email verification
  verifyEmail:           (b) => req('POST', '/auth/verify-email', b),
  resendVerification:    (b) => req('POST', '/auth/resend-verification', b),
};
