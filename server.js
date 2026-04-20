const express = require('express')
const cors = require('cors')
const axios = require('axios')
const https = require('https');
const path = require('path');

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.get('/', (req, res) => {
  res.send('Server running')
})

// TikTok 用户信息接口（原版完整保留）
app.get('/user/:username', async (req, res) => {
  const username = req.params.username
  try {
    const { data } = await axios.get(`https://www.tiktok.com/@${username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    })

    const avatar = (data.match(/"avatarThumbURL":"(.*?)"/)?.[1] || '').replace(/\\u002F/g,'/')
    const followers = data.match(/"followerCount":(\d+)/)?.[1] || 0
    const following = data.match(/"followingCount":(\d+)/)?.[1] || 0
    const videos = data.match(/"videoCount":(\d+)/)?.[1] || 0

    res.json({
      success: true,
      avatar,
      followers: Number(followers),
      following: Number(following),
      videos: Number(videos)
    })
  } catch (e) {
    res.json({ success: false })
  }
})

// ======================
// 浏览器锁定存储
// ======================
const userDB = {}

// 登录接口（带浏览器锁定）
app.post('/api/login', (req, res) => {
  const { username, password, fingerprint } = req.body

  if (!username || !password || !fingerprint) {
    return res.json({ ok: false, msg: '参数错误' })
  }

  // 首次登录：绑定浏览器
  if (!userDB[username]) {
    const token = 'tk_' + Math.random().toString(36).substr(2, 10)
    userDB[username] = {
      password: password,
      token: token,
      browser: fingerprint
    }
    return res.json({ ok: true, token })
  }

  const user = userDB[username]

  // 密码错误
  if (user.password !== password) {
    return res.json({ ok: false, msg: '密码错误' })
  }

  // 浏览器不匹配
  if (user.browser && user.browser !== fingerprint) {
    return res.json({ ok: false, msg: '只能在首次登录的浏览器使用' })
  }

  res.json({ ok: true, token: user.token })
})

// 登录校验
app.post('/api/check', (req, res) => {
  const { username, token } = req.body
  if (!username || !token || !userDB[username]) {
    return res.json({ ok: false })
  }
  res.json({ ok: userDB[username].token === token })
})

// ======================
// 管理端：解锁浏览器
// ======================
app.post('/api/admin/unlock', (req, res) => {
  const { username } = req.body
  if (!username || !userDB[username]) {
    return res.json({ ok: false, msg: '用户不存在' })
  }
  userDB[username].browser = null
  res.json({ ok: true, msg: '解锁成功，可换浏览器登录' })
})

// ======================
// 保活逻辑（完整保留）
// ======================
const urls = [
  "https://iiiiiilllllliiiiiiillllllllllllllllliiii.onrender.com",
  "https://wallet-project-30bq.onrender.com/",
  "https://wwwwwwwwwwwvvvvvvwwwwwwvvvvvwwwwvvww.onrender.com/"
];

process.on('uncaughtException', (err) => {
  console.log('保活错误:', err.message);
});

setInterval(() => {
  console.log("[保活] 心跳中...");
  urls.forEach(url => {
    https.get(url, (res) => {
      console.log("[保活] " + url + " " + res.statusCode);
    }).on('error', (err) => {
      console.log("[保活失败] " + url);
    });
  });
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log('Running on', PORT))
