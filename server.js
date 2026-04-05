const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// DB
const db = new Database('usuarios.db');

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  expira_em INTEGER,
  ip TEXT,
  ativo INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
);
`);

// ADMIN PADRÃO
const adminExiste = db.prepare('SELECT * FROM admins WHERE username=?').get('Souzaiosoficial');

if (!adminExiste) {
  const hash = crypto.createHash('sha256').update('1231Souza@').digest('hex');
  db.prepare('INSERT INTO admins (username,password) VALUES (?,?)')
    .run('Souzaiosoficial', hash);
}

// AUTH ADMIN
function adminAuth(req,res,next){
  const token = req.headers['x-admin-token'];
  if(token !== app.locals.adminToken){
    return res.status(401).json({erro:'não autorizado'});
  }
  next();
}

// LOGIN CLIENTE
app.post('/api/login',(req,res)=>{
  const {username,password} = req.body;

  const user = db.prepare('SELECT * FROM usuarios WHERE username=?').get(username);
  if(!user) return res.json({erro:'inválido'});

  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if(hash !== user.password) return res.json({erro:'inválido'});

  // verificar expiração
  if(Date.now() > user.expira_em){
    return res.json({erro:'acesso expirado'});
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // BLOQUEIO POR DISPOSITIVO
  if(user.ip && user.ip !== ip){
    return res.json({erro:'já utilizado em outro dispositivo'});
  }

  // salva IP
  db.prepare('UPDATE usuarios SET ip=? WHERE id=?').run(ip,user.id);

  res.json({sucesso:true, nome:user.username});
});

// DOWNLOAD
app.get('/api/download',(req,res)=>{
  res.redirect('https://mitm.it/cert/pem');
});

// LOGIN ADMIN
app.post('/api/admin/login',(req,res)=>{
  const {username,password} = req.body;

  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const admin = db.prepare('SELECT * FROM admins WHERE username=? AND password=?')
    .get(username,hash);

  if(!admin) return res.json({erro:'inválido'});

  const token = crypto.randomBytes(16).toString('hex');
  app.locals.adminToken = token;

  res.json({sucesso:true,token});
});

// GERAR USUÁRIO AUTOMÁTICO
app.post('/api/admin/gerar', adminAuth, (req,res)=>{
  const {tempo} = req.body; // minutos

  const username = 'user' + Math.floor(Math.random()*100000);
  const senhaRaw = Math.random().toString(36).substring(2,8);

  const hash = crypto.createHash('sha256').update(senhaRaw).digest('hex');

  const expira = Date.now() + (tempo * 60 * 1000);

  db.prepare(`
    INSERT INTO usuarios (username,password,expira_em)
    VALUES (?,?,?)
  `).run(username,hash,expira);

  res.json({
    usuario: username,
    senha: senhaRaw,
    expira_em: expira
  });
});

// LISTAR
app.get('/api/admin/usuarios', adminAuth,(req,res)=>{
  const lista = db.prepare('SELECT * FROM usuarios ORDER BY id DESC').all();
  res.json(lista);
});

// RESET (LIBERA NOVO DISPOSITIVO)
app.post('/api/admin/reset/:id', adminAuth,(req,res)=>{
  db.prepare('UPDATE usuarios SET ip=NULL').run(req.params.id);
  res.json({sucesso:true});
});

// DELETE
app.delete('/api/admin/delete/:id', adminAuth,(req,res)=>{
  db.prepare('DELETE FROM usuarios WHERE id=?').run(req.params.id);
  res.json({sucesso:true});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('rodando na porta '+PORT));
