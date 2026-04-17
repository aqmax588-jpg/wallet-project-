const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const DB_FILE = path.join(__dirname, 'db.json');

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
}

function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}
function now() {
  return new Date().toISOString();
}

function genToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ------------------------------
// 登录 → 新token覆盖旧token（A被顶）
// ------------------------------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();

  const user = db.find(u => u.username === username);
  if (!user) return res.json({ ok: false, msg: '账号不存在' });

  if (user.password !== password) {
    return res.json({ ok: false, msg: '密码错误' });
  }

  if (!user.enabled) {
    return res.json({ ok: false, msg: '账号已禁用' });
  }

  const nowTs = Date.now();
  if (user.expireAt) {
    const expTs = new Date(user.expireAt).getTime();
    if (nowTs > expTs) {
      return res.json({ ok: false, msg: '账号已过期' });
    }
  }

  // 新登录生成新token，旧token直接作废
  user.token = genToken();
  user.lastActive = Date.now();

  writeDB(db);
  res.json({ ok: true, token: user.token });
});

// ------------------------------
// 校验：只有最新token有效，旧token一用就死
// ------------------------------
app.post('/api/check', (req, res) => {
  const { username, token } = req.body;
  const db = readDB();
  const user = db.find(u => u.username === username);

  if (!user || !user.enabled || !user.token || user.token !== token) {
    return res.json({ ok: false });
  }

  if (user.expireAt && Date.now() > new Date(user.expireAt).getTime()) {
    return res.json({ ok: false });
  }

  user.lastActive = Date.now();
  writeDB(db);
  res.json({ ok: true });
});

// ------------------------------
// 管理员
// ------------------------------
app.post('/api/admin/login', (req, res) => {
  const { user, pwd } = req.body;
  if (user === 'admin' && pwd === 'admin123') {
    res.json({ ok: true });
  } else {
    res.json({ ok: false });
  }
});

app.get('/api/admin/list', (req, res) => {
  const db = readDB();
  const nowTime = Date.now();
  const offlineMs = 10 * 60 * 1000;

  const result = db.map(u => {
    const isOnline = !!u.lastActive && (nowTime - u.lastActive < offlineMs);
    return { ...u, online: isOnline };
  });

  res.json(result);
});

app.post('/api/admin/delete', (req, res) => {
  const { username } = req.body;
  let db = readDB();
  db = db.filter(x => x.username !== username);
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/admin/toggle', (req, res) => {
  const { username, enabled } = req.body;
  const db = readDB();
  const u = db.find(x => x.username === username);
  if (u) {
    u.enabled = enabled;
  }
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/admin/batch', (req, res) => {
  const { lines, days } = req.body;
  const db = readDB();
  const arr = lines.split(/\n/).map(x => x.trim()).filter(Boolean);

  let success = 0;
  let exist = 0;

  for (const line of arr) {
    const [user, pwd] = line.split(/\s+/).filter(Boolean);
    if (!user || !pwd) continue;
    if (db.some(x => x.username === user)) { exist++; continue; }

    const nowTime = now();
    const expire = days > 0
      ? new Date(Date.now() + days * 86400000).toISOString()
      : null;

    db.push({
      username: user, password: pwd, enabled: true,
      createdAt: nowTime, expireAt: expire, token: null, lastActive: null
    });
    success++;
  }

  writeDB(db);
  res.json({ ok: true, success, exist });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
