const LS_KEYS = {
  USERS: "noticehub_users",
  NOTICES: "noticehub_notices",
  SESSION: "noticehub_current_user"
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function setToast(id, msg, type = "ok") {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = "toast " + (type === "ok" ? "ok" : "bad");
  el.textContent = msg;
}

function getCurrentUser() {
  return load(LS_KEYS.SESSION, null);
}

function setCurrentUser(userObjOrNull) {
  if (!userObjOrNull) localStorage.removeItem(LS_KEYS.SESSION);
  else save(LS_KEYS.SESSION, userObjOrNull);
}

function seedIfEmpty() {
  // Create default accounts + sample notice (only once)
  const users = load(LS_KEYS.USERS, []);
  const notices = load(LS_KEYS.NOTICES, []);

  if (users.length === 0) {
    const teacher = {
      id: uid(),
      role: "teacher",
      name: "Demo Teacher",
      email: "teacher@demo.com",
      password: "123456"
    };
    const student = {
      id: uid(),
      role: "student",
      name: "Demo Student",
      email: "student@demo.com",
      password: "123456"
    };
    save(LS_KEYS.USERS, [teacher, student]);
  }

  if (notices.length === 0) {
    const u = load(LS_KEYS.USERS, []);
    const t = u.find(x => x.role === "teacher");
    const sample = {
      id: uid(),
      title: "Welcome to NoticeHub",
      body: "This is a sample published notice. Teacher can publish/unpublish.",
      authorId: t ? t.id : null,
      authorName: t ? t.name : "Teacher",
      published: true,
      createdAt: new Date().toISOString()
    };
    save(LS_KEYS.NOTICES, [sample]);
  }
}

// ===== Auth =====
function registerUser({ name, email, password, role }) {
  const users = load(LS_KEYS.USERS, []);
  const exists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
  if (exists) return { ok: false, msg: "Email already exists. Try login." };

  const user = { id: uid(), name, email, password, role };
  users.push(user);
  save(LS_KEYS.USERS, users);
  return { ok: true, msg: "Registration successful. Now login." };
}

function loginUser({ email, password }) {
  const users = load(LS_KEYS.USERS, []);
  const user = users.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );
  if (!user) return { ok: false, msg: "Wrong email or password." };

  setCurrentUser({ id: user.id, role: user.role, name: user.name, email: user.email });
  return { ok: true, msg: "Login successful." };
}

function logout() {
  setCurrentUser(null);
  location.href = "login.html";
}

function requireAuth() {
  const u = getCurrentUser();
  if (!u) location.href = "login.html";
  return u;
}

// ===== Account Management =====
function updateProfile({ name, email }) {
  const session = getCurrentUser();
  if (!session) return { ok: false, msg: "Not logged in." };

  const users = load(LS_KEYS.USERS, []);
  const idx = users.findIndex(u => u.id === session.id);
  if (idx === -1) return { ok: false, msg: "User not found." };

  const taken = users.some(
    u => u.id !== session.id && u.email.toLowerCase() === email.toLowerCase()
  );
  if (taken) return { ok: false, msg: "Email already taken by another user." };

  users[idx].name = name;
  users[idx].email = email;
  save(LS_KEYS.USERS, users);

  setCurrentUser({ ...session, name, email });
  return { ok: true, msg: "Profile updated." };
}

function changePassword({ oldPass, newPass }) {
  const session = getCurrentUser();
  if (!session) return { ok: false, msg: "Not logged in." };

  const users = load(LS_KEYS.USERS, []);
  const idx = users.findIndex(u => u.id === session.id);
  if (idx === -1) return { ok: false, msg: "User not found." };

  if (users[idx].password !== oldPass) return { ok: false, msg: "Old password is wrong." };

  users[idx].password = newPass;
  save(LS_KEYS.USERS, users);
  return { ok: true, msg: "Password changed." };
}

function deleteMyAccount() {
  const session = getCurrentUser();
  if (!session) return { ok: false, msg: "Not logged in." };

  let users = load(LS_KEYS.USERS, []);
  users = users.filter(u => u.id !== session.id);
  save(LS_KEYS.USERS, users);

  // Also delete notices authored by this teacher (optional)
  let notices = load(LS_KEYS.NOTICES, []);
  notices = notices.filter(n => n.authorId !== session.id);
  save(LS_KEYS.NOTICES, notices);

  setCurrentUser(null);
  return { ok: true, msg: "Account deleted." };
}

// ===== Notices =====
function addNotice({ title, body }) {
  const session = getCurrentUser();
  if (!session || session.role !== "teacher")
    return { ok: false, msg: "Only teacher can add notice." };

  const notices = load(LS_KEYS.NOTICES, []);
  const notice = {
    id: uid(),
    title: title.trim(),
    body: body.trim(),
    authorId: session.id,
    authorName: session.name,
    published: false,
    createdAt: new Date().toISOString()
  };
  notices.unshift(notice);
  save(LS_KEYS.NOTICES, notices);
  return { ok: true, msg: "Notice added (unpublished)." };
}

function deleteNotice(noticeId) {
  const session = getCurrentUser();
  if (!session || session.role !== "teacher")
    return { ok: false, msg: "Only teacher can delete notice." };

  let notices = load(LS_KEYS.NOTICES, []);
  const n = notices.find(x => x.id === noticeId);
  if (!n) return { ok: false, msg: "Notice not found." };

  notices = notices.filter(x => x.id !== noticeId);
  save(LS_KEYS.NOTICES, notices);
  return { ok: true, msg: "Notice deleted." };
}

function togglePublish(noticeId) {
  const session = getCurrentUser();
  if (!session || session.role !== "teacher")
    return { ok: false, msg: "Only teacher can publish/unpublish." };

  const notices = load(LS_KEYS.NOTICES, []);
  const idx = notices.findIndex(n => n.id === noticeId);
  if (idx === -1) return { ok: false, msg: "Notice not found." };

  notices[idx].published = !notices[idx].published;
  save(LS_KEYS.NOTICES, notices);
  return { ok: true, msg: notices[idx].published ? "Published." : "Unpublished." };
}

// ===== Favorites =====
function getFavoritesForUser(userId) {
  return load("noticehub_fav_" + userId, []);
}

function toggleFavorite(userId, noticeId) {
  const key = "noticehub_fav_" + userId;
  const fav = load(key, []);
  const exists = fav.includes(noticeId);
  const next = exists ? fav.filter(x => x !== noticeId) : [...fav, noticeId];
  save(key, next);
  return next;
}

// ===== Users list (Teacher) =====
function getUsers() {
  return load(LS_KEYS.USERS, []);
}

function deleteUserByTeacher(userId) {
  const session = getCurrentUser();
  if (!session || session.role !== "teacher")
    return { ok: false, msg: "Only teacher can delete users." };

  if (session.id === userId)
    return { ok: false, msg: "You can't delete yourself here. Use Delete My Account." };

  let users = load(LS_KEYS.USERS, []);
  const before = users.length;
  users = users.filter(u => u.id !== userId);
  save(LS_KEYS.USERS, users);

  if (users.length === before) return { ok: false, msg: "User not found." };
  return { ok: true, msg: "User deleted." };
}

// ===== Dashboard Helpers =====
function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
