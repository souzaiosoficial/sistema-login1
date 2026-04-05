# Souzaiosoficial — Sistema de Acesso Controlado

## Como instalar e rodar

### Requisitos
- Node.js 18 ou superior instalado na VPS/servidor

### Passo a Passo

1. **Faça upload desta pasta para seu servidor**

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Inicie o servidor:**
   ```bash
   npm start
   ```
   O servidor roda na porta **3000** por padrão.

4. **Acesse:**
   - Página do cliente: `http://seudominio.com:3000/`
   - Painel admin:      `http://seudominio.com:3000/admin.html`

---

## Credenciais padrão do Admin

| Usuário | Senha     |
|---------|-----------|
| admin   | admin123  |

> ⚠️ **Altere a senha do admin imediatamente após o primeiro login!**
> Para trocar, edite no `server.js` a função de alteração de senha, ou adicione a rota `/api/admin/senha` no futuro.

---

## Como funciona

- Você cria usuários no painel admin com usuário + senha
- O cliente acessa a página principal e faz login
- Após login bem-sucedido, aparece o botão de download
- **Ao clicar no botão**, o acesso é marcado como "Utilizado"
- O cliente **não consegue mais logar** após usar
- Você pode **resetar** o acesso do cliente no painel admin para liberar novamente

---

## Rodar com domínio próprio (recomendado)

Use **Nginx** como proxy reverso:

```nginx
server {
    listen 80;
    server_name seudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Para rodar em background permanentemente:
```bash
npm install -g pm2
pm2 start server.js --name souzaios
pm2 save
pm2 startup
```

---

## Estrutura de arquivos

```
souzaios/
├── server.js          ← Backend Node.js (API + servidor)
├── package.json       ← Dependências
├── usuarios.db        ← Banco de dados SQLite (criado automaticamente)
└── public/
    ├── index.html     ← Página de login do cliente
    └── admin.html     ← Painel administrativo
```
