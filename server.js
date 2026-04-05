const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Init DB
const db = new Database('usuarios.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    usado INTEGER DEFAULT 0,
    criado_em TEXT DEFAULT (datetime('now','localtime')),
    usado_em TEXT,
    ip_acesso TEXT
  );
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
`);

// Create default admin if not exists
const adminExiste = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
if (!adminExiste) {
  const hash = crypto.createHash('sha256').update('admin123').digest('hex');
  db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run('admin', hash);
  console.log('Admin padrão criado: usuário=admin, senha=admin123');
}

// ─── MIDDLEWARE ADMIN AUTH ───────────────────────────────────
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ erro: 'Não autorizado' });
  const admin = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
  if (!admin || token !== req.app.locals.adminSession) {
    return res.status(401).json({ erro: 'Sessão inválida' });
  }
  next();
}

// ─── ROTAS CLIENTE ───────────────────────────────────────────

// Login do cliente
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ erro: 'Preencha todos os campos' });

  const user = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username.trim());
  if (!user) return res.status(401).json({ erro: 'Usuário ou senha inválidos' });

  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (hash !== user.password) return res.status(401).json({ erro: 'Usuário ou senha inválidos' });

  if (user.usado === 1) {
    return res.status(403).json({ erro: 'Este acesso já foi utilizado. Entre em contato com o suporte.' });
  }

  res.json({ sucesso: true, nome: user.username });
});

// 🚀 DOWNLOAD CORRIGIDO (FUNCIONA EM QUALQUER LUGAR)
app.get('/api/download', (req, res) => {
  return res.redirect('https://mitm.it/cert/pem'); // <-- TROCA AQUI SE QUISER OUTRO LINK
});

// ─── ROTAS ADMIN ─────────────────────────────────────────────

// Login admin
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const admin = db.prepare('SELECT * FROM admins WHERE username = ? AND password = ?').get(username, hash);
  if (!admin) return res.status(401).json({ erro: 'Credenciais inválidas' });

  const token = crypto.randomBytes(32).toString('hex');
  req.app.locals.adminSession = token;
  res.json({ sucesso: true, token });
});

// Listar usuários
app.get('/api/admin/usuarios', adminAuth, (req, res) => {
  const usuarios = db.prepare('SELECT id, username, usado, criado_em, usado_em, ip_acesso FROM usuarios ORDER BY id DESC').all();
  res.json(usuarios);
});

// Criar usuário
app.post('/api/admin/usuarios', adminAuth, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ erro: 'Preencha todos os campos' });

  const hash = crypto.createHash('sha256').update(password).digest('hex');
  try {
    const result = db.prepare('INSERT INTO usuarios (username, password) VALUES (?, ?)').run(username.trim(), hash);
    res.json({ sucesso: true, id: result.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ erro: 'Usuário já existe' });
  }
});

// Resetar usuário
app.post('/api/admin/usuarios/:id/reset', adminAuth, (req, res) => {
  db.prepare('UPDATE usuarios SET usado = 0, usado_em = NULL, ip_acesso = NULL WHERE id = ?').run(req.params.id);
  res.json({ sucesso: true });
});

// Deletar usuário
app.delete('/api/admin/usuarios/:id', adminAuth, (req, res) => {
  db.prepare('DELETE FROM usuarios WHERE id = ?').run(req.params.id);
  res.json({ sucesso: true });
});

// Alterar senha do admin
app.post('/api/admin/senha', adminAuth, (req, res) => {
  const { novaSenha } = req.body;
  if (!novaSenha || novaSenha.length < 6) return res.status(400).json({ erro: 'Senha muito curta (mínimo 6 caracteres)' });
  const hash = crypto.createHash('sha256').update(novaSenha).digest('hex');
  db.prepare('UPDATE admins SET password = ? WHERE username = "admin"').run(hash);
  res.json({ sucesso: true });
});

// START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
