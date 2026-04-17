const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. 数据库初始化（关键！）
const db = new sqlite3.Database('./users.db', (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('✅ Database connected');
  }
});

// 2. 创建用户表（关键！）
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  expire TEXT NOT NULL,
  banned INTEGER DEFAULT 0
)`, (err) => {
  if (err) {
    console.error('Create table error:', err.message);
  } else {
    console.log('✅ Users table ready');
  }
});

// 3. 插入默认账号（关键！）
db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, row) => {
  if (!row) {
    console.log('Inserting default admin user...');
    db.run(`INSERT INTO users (username,password,expire,banned) VALUES ('admin','admin888','2027-12-31',0)`);
    db.run(`INSERT INTO users (username,password,expire,banned) VALUES ('test','test123','2027-12-31',0)`);
    console.log('✅ Default users created');
  }
});

// 登录接口
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (!user) return res.json({ ok: false, msg: 'User not found' });
    if (user.banned) return res.json({ ok: false, msg: 'Account disabled' });
    const now = new Date();
    const exp = new Date(user.expire);
    if (now > exp) return res.json({ ok: false, msg: 'Account expired' });
    if (user.password !== password) return res.json({ ok: false, msg: 'Wrong password' });
    res.json({ ok: true });
  });
});

// 管理员接口
app.get('/api/admin/users', (req, res) => {
  db.all('SELECT * FROM users', (err, rows) => res.json(rows));
});

app.post('/api/admin/update', (req, res) => {
  const { id, username, password, expire } = req.body;
  db.run('UPDATE users SET username=?, password=?, expire=? WHERE id=?',
    [username, password, expire, id], () => res.json({ ok: true }));
});

app.post('/api/admin/toggle', (req, res) => {
  const { id } = req.body;
  db.get('SELECT banned FROM users WHERE id=?', [id], (err, row) => {
    db.run('UPDATE users SET banned=? WHERE id=?', [!row.banned, id], () => res.json({ ok: true }));
  });
});

app.post('/api/admin/delete', (req, res) => {
  const { id } = req.body;
  db.run('DELETE FROM users WHERE id=?', [id], () => res.json({ ok: true }));
});

app.post('/api/admin/add', (req, res) => {
  const { username, password, expire } = req.body;
  db.run('INSERT INTO users (username,password,expire) VALUES (?,?,?)',
    [username, password, expire], () => res.json({ ok: true }));
});

// 静态页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
