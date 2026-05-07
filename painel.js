/**
 * painel.js — Servidor web do painel de pedidos
 */

const express = require('express');
const path = require('path');
const { login, verificarToken, logout, criarUsuario, gerarCodigo, redefinirSenha, listarUsuarios, atualizarSenha, getUsuarioAtual } = require('./auth');
const { conectarWhatsApp, desconectarWhatsApp, getStatusWhatsApp } = require('./bot');
const { listarPedidos, atualizarStatusPedido, getEstatisticas, getPedidoCompleto } = require('./storage');
const { notificarStatusPedido, notificarClienteStatus } = require('./telegram');

const app = express();
app.use(express.json());

let whatsappClient = null;

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!verificarToken(token)) {
    return res.status(401).json({ ok: false, erro: 'Unauthorized', redireccionar: '/login' });
  }
  next();
}

function setWhatsAppClient(client) {
  whatsappClient = client;
  console.log('✅ Cliente WhatsApp vinculado ao painel');
}

let ultimaNotificacaoQR = null;
let ultimoStatusWhatsApp = null;

function notificarQRCode(qr) {
  ultimaNotificacaoQR = qr;
}

function notificarStatusWhatsApp(status) {
  ultimoStatusWhatsApp = status;
}

module.exports = { iniciarPainel, app, setWhatsAppClient, notificarQRCode, notificarStatusWhatsApp };

app.use('/qrcodes', express.static(path.join(__dirname, 'public', 'qrcodes')));

app.post('/api/auth/login', (req, res) => {
  const { username, senha } = req.body;
  res.json(login(username, senha));
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  logout(token);
  res.json({ ok: true });
});

app.post('/api/auth/cadastrar', (req, res) => {
  const { username, senha, email } = req.body;
  if (!username || !senha) {
    return res.json({ ok: false, erro: 'Preencha usuário e senha' });
  }
  res.json(criarUsuario(username, senha, email || null));
});

app.post('/api/auth/esqueci-senha', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.json({ ok: false, erro: 'Informe o e-mail' });
  }
  res.json(gerarCodigo(email));
});

app.post('/api/auth/redefinir-senha', (req, res) => {
  const { email, codigo, novaSenha } = req.body;
  if (!email || !codigo || !novaSenha) {
    return res.json({ ok: false, erro: 'Preencha todos os campos' });
  }
  res.json(redefinirSenha(email, codigo, novaSenha));
});

app.get('/api/usuarios', requireAuth, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const usuarios = listarUsuarios(token);
  if (!usuarios) {
    return res.status(403).json({ ok: false, erro: 'Acesso negado' });
  }
  res.json({ ok: true, usuarios });
});

app.post('/api/auth/trocar-senha', requireAuth, (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!senhaAtual || !novaSenha) {
    return res.json({ ok: false, erro: 'Preencha todos os campos' });
  }

  if (novaSenha.length < 6) {
    return res.json({ ok: false, erro: 'Nova senha deve ter pelo menos 6 caracteres' });
  }

  const usuario = getUsuarioAtual(token);
  if (!usuario || !usuario.userId) {
    return res.json({ ok: false, erro: 'Sessão inválida' });
  }

  const resultado = atualizarSenha(usuario.userId, senhaAtual, novaSenha);
  res.json(resultado);
});

app.post('/api/whatsapp/connect', requireAuth, (req, res) => {
  const resultado = conectarWhatsApp();
  res.json(resultado);
});

app.post('/api/whatsapp/disconnect', requireAuth, (req, res) => {
  const resultado = desconectarWhatsApp();
  res.json(resultado);
});

app.get('/api/whatsapp/status', requireAuth, (req, res) => {
  const status = getStatusWhatsApp();
  res.json({ ok: true, ...status });
});

app.get('/api/whatsapp/qr', requireAuth, (req, res) => {
  const status = getStatusWhatsApp();
  res.json({ ok: true, qrCode: status.qrCode, status: status.status });
});

app.get('/api/pedidos', requireAuth, (req, res) => {
  const limite = parseInt(req.query.limite) || 50;
  res.json({ ok: true, pedidos: listarPedidos(limite) });
});

app.get('/api/stats', requireAuth, (req, res) => {
  res.json({ ok: true, stats: getEstatisticas() });
});

app.put('/api/pedidos/:id/status', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const statusValidos = ['novo', 'confirmado', 'em_preparo', 'saiu_entrega', 'entregue', 'cancelado'];
  
  if (!statusValidos.includes(status)) {
    return res.status(400).json({ ok: false, erro: 'Status inválido' });
  }

  atualizarStatusPedido(id, status);
  const pedido = getPedidoCompleto(id);

  try { if (pedido) await notificarStatusPedido(pedido, status); } catch (e) {}
  try {
    if (pedido && whatsappClient && ['em_preparo', 'saiu_entrega', 'entregue', 'cancelado'].includes(status)) {
      await notificarClienteStatus(whatsappClient, pedido.telefone, pedido, status);
    }
  } catch (e) {}

  res.json({ ok: true, mensagem: 'Status atualizado para: ' + status });
});

app.get('/login', (req, res) => {
  res.send(gerarHTMLLogin());
});

app.get('/cadastro', (req, res) => {
  res.send(gerarHTMLCadastro());
});

app.get('/recuperar', (req, res) => {
  res.send(gerarHTMLRecuperar());
});

app.get('/trocar-senha', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (verificarToken(token)) {
    res.send(gerarHTMLTrocarSenha());
  } else {
    res.redirect('/login');
  }
});

app.get('/', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (verificarToken(token)) {
    res.send(gerarHTMLPainel());
  } else {
    res.redirect('/login');
  }
});

function gerarHTMLCadastro() {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zé Delivery — Cadastro</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .box { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 40px; width: 100%; max-width: 380px; }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo h1 { font-size: 2rem; color: #e63946; }
    .logo p { color: #666; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; color: #888; font-size: 0.85rem; margin-bottom: 8px; }
    .form-group input { width: 100%; padding: 14px; background: #222; border: 1px solid #333; border-radius: 8px; color: #fff; font-size: 1rem; }
    .btn { width: 100%; padding: 14px; background: #e63946; border: none; border-radius: 8px; color: #fff; font-size: 1rem; cursor: pointer; }
    .erro { background: #3a1a1a; color: #ff6b6b; padding: 12px; border-radius: 8px; margin-bottom: 20px; display: none; }
    .erro.show { display: block; }
    .sucesso { background: #1a3a1a; color: #2dc653; padding: 12px; border-radius: 8px; margin-bottom: 20px; display: none; }
    .sucesso.show { display: block; }
    .link { color: #e63946; text-decoration: none; display: block; text-align: center; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="logo"><h1>🍔 Zé Delivery</h1><p>Criar nova conta</p></div>
    <div class="erro" id="erro"></div>
    <div class="sucesso" id="sucesso"></div>
    <form id="form-cadastro">
      <div class="form-group"><label>Usuário</label><input type="text" id="username" required></div>
      <div class="form-group"><label>E-mail (opcional)</label><input type="email" id="email"></div>
      <div class="form-group"><label>Senha</label><input type="password" id="senha" required></div>
      <div class="form-group"><label>Confirmar Senha</label><input type="password" id="confirmarSenha" required></div>
      <button type="submit" class="btn">Cadastrar</button>
    </form>
    <a href="/login" class="link">← Voltar ao login</a>
  </div>
  <script>
    document.getElementById('form-cadastro').addEventListener('submit', async (e) => {
      e.preventDefault();
      var username = document.getElementById('username').value;
      var email = document.getElementById('email').value;
      var senha = document.getElementById('senha').value;
      var confirmar = document.getElementById('confirmarSenha').value;
      if (senha !== confirmar) {
        document.getElementById('erro').textContent = 'As senhas não conferem';
        document.getElementById('erro').classList.add('show');
        return;
      }
      var res = await fetch('/api/auth/cadastrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, senha: senha, email: email })
      });
      var data = await res.json();
      if (data.ok) {
        document.getElementById('erro').classList.remove('show');
        document.getElementById('sucesso').textContent = 'Conta criada! Redirecionando...';
        document.getElementById('sucesso').classList.add('show');
        setTimeout(function() { window.location.href = '/login'; }, 1500);
      } else {
        document.getElementById('erro').textContent = data.erro;
        document.getElementById('erro').classList.add('show');
      }
    });
  </script>
</body>
</html>`;
  return html;
}

function gerarHTMLRecuperar() {
  var etapa = 1;
  var emailAtual = '';
  var html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zé Delivery — Recuperar Senha</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .box { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 40px; width: 100%; max-width: 380px; }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo h1 { font-size: 2rem; color: #e63946; }
    .logo p { color: #666; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; color: #888; font-size: 0.85rem; margin-bottom: 8px; }
    .form-group input { width: 100%; padding: 14px; background: #222; border: 1px solid #333; border-radius: 8px; color: #fff; font-size: 1rem; }
    .btn { width: 100%; padding: 14px; background: #e63946; border: none; border-radius: 8px; color: #fff; font-size: 1rem; cursor: pointer; }
    .erro { background: #3a1a1a; color: #ff6b6b; padding: 12px; border-radius: 8px; margin-bottom: 20px; display: none; }
    .erro.show { display: block; }
    .sucesso { background: #1a3a1a; color: #2dc653; padding: 12px; border-radius: 8px; margin-bottom: 20px; display: none; }
    .sucesso.show { display: block; }
    .link { color: #e63946; text-decoration: none; display: block; text-align: center; margin-top: 16px; }
    #etapa2 { display: none; }
  </style>
</head>
<body>
  <div class="box">
    <div class="logo"><h1>🔐 Zé Delivery</h1><p>Recuperar Senha</p></div>
    <div class="erro" id="erro"></div>
    <div class="sucesso" id="sucesso"></div>
    <div id="etapa1">
      <div class="form-group"><label>Informe seu e-mail</label><input type="email" id="email" required></div>
      <button class="btn" onclick="enviarCodigo()">Enviar Código</button>
    </div>
    <div id="etapa2">
      <div class="form-group"><label>Código recebido (veja no console)</label><input type="text" id="codigo" maxlength="6" required></div>
      <div class="form-group"><label>Nova Senha</label><input type="password" id="novaSenha" required></div>
      <div class="form-group"><label>Confirmar Nova Senha</label><input type="password" id="confirmarNovaSenha" required></div>
      <button class="btn" onclick="redefinirSenha()">Alterar Senha</button>
    </div>
    <a href="/login" class="link">← Voltar ao login</a>
  </div>
  <script>
    var emailAtual = '';
    async function enviarCodigo() {
      var email = document.getElementById('email').value;
      if (!email) return;
      var res = await fetch('/api/auth/esqueci-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      });
      var data = await res.json();
      if (data.ok) {
        emailAtual = email;
        document.getElementById('etapa1').style.display = 'none';
        document.getElementById('etapa2').style.display = 'block';
        document.getElementById('sucesso').textContent = 'Código enviado! Verifique o console do servidor (ou configure e-mail real).';
        document.getElementById('sucesso').classList.add('show');
      } else {
        document.getElementById('erro').textContent = data.erro;
        document.getElementById('erro').classList.add('show');
      }
    }
    async function redefinirSenha() {
      var codigo = document.getElementById('codigo').value;
      var novaSenha = document.getElementById('novaSenha').value;
      var confirmar = document.getElementById('confirmarNovaSenha').value;
      if (novaSenha !== confirmar) {
        document.getElementById('erro').textContent = 'As senhas não conferem';
        document.getElementById('erro').classList.add('show');
        return;
      }
      var res = await fetch('/api/auth/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAtual, codigo: codigo, novaSenha: novaSenha })
      });
      var data = await res.json();
      if (data.ok) {
        document.getElementById('erro').classList.remove('show');
        document.getElementById('sucesso').textContent = 'Senha alterada! Redirecionando...';
        document.getElementById('sucesso').classList.add('show');
        setTimeout(function() { window.location.href = '/login'; }, 1500);
      } else {
        document.getElementById('erro').textContent = data.erro;
        document.getElementById('erro').classList.add('show');
      }
    }
  </script>
</body>
</html>`;
  return html;
}

function gerarHTMLLogin() {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zé Delivery — Login</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .login-box { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 40px; width: 100%; max-width: 380px; }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo h1 { font-size: 2rem; color: #e63946; }
    .logo p { color: #666; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; color: #888; font-size: 0.85rem; margin-bottom: 8px; }
    .form-group input { width: 100%; padding: 14px; background: #222; border: 1px solid #333; border-radius: 8px; color: #fff; font-size: 1rem; }
    .btn { width: 100%; padding: 14px; background: #e63946; border: none; border-radius: 8px; color: #fff; font-size: 1rem; cursor: pointer; }
    .erro { background: #3a1a1a; color: #ff6b6b; padding: 12px; border-radius: 8px; margin-bottom: 20px; display: none; }
    .erro.show { display: block; }
    .links { margin-top: 20px; text-align: center; display: flex; justify-content: space-between; }
    .links a { color: #888; font-size: 0.9rem; text-decoration: none; }
    .links a:hover { color: #e63946; }
  </style>
</head>
<body>
  <div class="login-box">
    <div class="logo"><h1>🍔 Zé Delivery</h1><p>Painel Administrativo</p></div>
    <div class="erro" id="erro"></div>
    <form id="form-login">
      <div class="form-group"><label>Usuário</label><input type="text" id="username" required></div>
      <div class="form-group"><label>Senha</label><input type="password" id="senha" required></div>
      <button type="submit" class="btn">Entrar</button>
    </form>
    <div class="links">
      <a href="/cadastro">Criar conta</a>
      <a href="/recuperar">Esqueci a senha</a>
    </div>
  </div>
  <script>
    document.getElementById('form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: document.getElementById('username').value, senha: document.getElementById('senha').value })
      });
      const data = await res.json();
      if (data.ok) { localStorage.setItem('token', data.token); window.location.href = '/?token=' + data.token; }
      else { document.getElementById('erro').textContent = data.erro; document.getElementById('erro').classList.add('show'); }
    });
  </script>
</body>
</html>`;
  return html;
}

function gerarHTMLPainel() {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zé Delivery — Painel</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #fff; min-height: 100vh; }
    .header { background: linear-gradient(135deg, #e63946, #c1121f); padding: 20px 30px; display: flex; justify-content: space-between; }
    .badge-online { background: #2dc653; padding: 5px 14px; border-radius: 20px; font-size: 0.8rem; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 24px 30px; }
    .stat-card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 20px; text-align: center; }
    .stat-card .valor { font-size: 2rem; color: #e63946; }
    .stat-card .label { font-size: 0.78rem; color: #888; }
    .filtros { padding: 0 30px 16px; display: flex; gap: 8px; }
    .filtro-btn { padding: 6px 16px; border-radius: 20px; border: 1px solid #333; background: #1a1a1a; color: #aaa; cursor: pointer; }
    .filtro-btn.ativo { background: #e63946; color: #fff; }
    .container { padding: 0 30px 40px; }
    .table-wrap { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; }
    table { width: 100%; }
    th { background: #222; padding: 14px; text-align: left; font-size: 0.75rem; color: #666; }
    td { padding: 14px; border-bottom: 1px solid #222; }
    .pedido-id { color: #e63946; font-weight: 600; }
    .telefone { color: #aaa; }
    .total { color: #2dc653; font-weight: 700; }
    .status { padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; }
    .status-novo { background: #1a2a4a; color: #4da6ff; }
    .status-confirmado { background: #1a3a2a; color: #2dc653; }
    .status-em_preparo { background: #3a2a10; color: #ff9f0a; }
    .status-saiu_entrega { background: #2a1a3a; color: #bf5af2; }
    .status-entregue { background: #1a2a1a; color: #30d158; }
    .status-cancelado { background: #3a1a1a; color: #ff453a; }
    .status-select { background: #2a2a2a; border: 1px solid #333; color: #fff; padding: 5px; border-radius: 6px; }
    .btn-sair { background: #333; border: none; padding: 6px 12px; border-radius: 6px; color: #aaa; cursor: pointer; }
    .whatsapp-bar { background: #1a1a1a; border-bottom: 1px solid #2a2a2a; padding: 12px 30px; display: flex; align-items: center; justify-content: space-between; }
    .whatsapp-info { display: flex; align-items: center; gap: 12px; }
    .whatsapp-status { padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }
    .whatsapp-status.conectado { background: #1a3a2a; color: #2dc653; }
    .whatsapp-status.desconectado { background: #3a1a1a; color: #ff453a; }
    .whatsapp-status.aguardando_qr { background: #3a2a10; color: #ff9f0a; }
    .whatsapp-status.iniciando { background: #2a2a3a; color: #bf5af2; }
    .btn-whatsapp { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.9rem; font-weight: 600; }
    .btn-connect { background: #2dc653; color: #fff; }
    .btn-connect:hover { background: #25a844; }
    .btn-disconnect { background: #ff453a; color: #fff; }
    .btn-disconnect:hover { background: #d9362b; }
    .qr-box { background: #fff; padding: 16px; border-radius: 12px; display: inline-block; margin-top: 10px; }
    .qr-box img { max-width: 200px; }
    .whatsapp-section { margin-top: 10px; }
  </style>
</head>
<body>
<div class="header">
  <div><h1>🍔 Zé Delivery</h1><div style="font-size:0.85rem;opacity:0.85">Painel de Pedidos</div></div>
  <div style="display:flex;gap:12px;align-items:center"><button class="btn-sair" onclick="trocarSenha()">Trocar Senha</button><button class="btn-sair" onclick="logout()">Sair</button></div>
</div>
<div class="whatsapp-bar">
  <div class="whatsapp-info">
    <span style="color:#888;font-size:0.9rem">WhatsApp:</span>
    <span class="whatsapp-status desconectado" id="whatsapp-status">Desconectado</span>
    <div id="whatsapp-section"></div>
  </div>
  <div>
    <button class="btn-whatsapp btn-connect" id="btn-connect" onclick="conectarWhatsApp()" style="display:none">Conectar WhatsApp</button>
    <button class="btn-whatsapp btn-disconnect" id="btn-disconnect" onclick="desconectarWhatsApp()" style="display:none">Desconectar</button>
  </div>
</div>
<div class="stats">
  <div class="stat-card"><div class="valor" id="stat-hoje">—</div><div class="label">Pedidos Hoje</div></div>
  <div class="stat-card"><div class="valor" id="stat-fat-hoje">—</div><div class="label">Faturamento Hoje</div></div>
  <div class="stat-card"><div class="valor" id="stat-total">—</div><div class="label">Total</div></div>
  <div class="stat-card"><div class="valor" id="stat-ticket">—</div><div class="label">Ticket Médio</div></div>
</div>
<div class="filtros">
  <button class="filtro-btn ativo" onclick="filtrar('todos', this)">Todos</button>
  <button class="filtro-btn" onclick="filtrar('confirmado', this)">Confirmados</button>
  <button class="filtro-btn" onclick="filtrar('em_preparo', this)">Em Preparo</button>
  <button class="filtro-btn" onclick="filtrar('saiu_entrega', this)">🛵 Saiu p/ Entrega</button>
  <button class="filtro-btn" onclick="filtrar('entregue', this)">Entregues</button>
  <button class="filtro-btn" onclick="filtrar('cancelado', this)">Cancelados</button>
</div>
<div class="container">
  <div class="table-wrap">
    <table><thead><tr><th>Pedido</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Status</th></tr></thead>
      <tbody id="tabela-body"></tbody>
    </table>
  </div>
</div>
<script>
var todosPedidos = [];
var filtroAtivo = 'todos';

async function carregarStatusWhatsApp() {
  var token = verificarAuth();
  if (!token) return;
  try {
    var res = await fetch('/api/whatsapp/status', { headers: { 'Authorization': 'Bearer ' + token } });
    var data = await res.json();
    if (!data.ok) return;
    var statusEl = document.getElementById('whatsapp-status');
    var connectBtn = document.getElementById('btn-connect');
    var disconnectBtn = document.getElementById('btn-disconnect');
    var section = document.getElementById('whatsapp-section');
    statusEl.className = 'whatsapp-status ' + data.status;
    if (data.status === 'conectado') {
      statusEl.textContent = 'Conectado';
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = 'inline-block';
      section.innerHTML = '';
    } else if (data.status === 'desconectado') {
      statusEl.textContent = 'Desconectado';
      connectBtn.style.display = 'inline-block';
      disconnectBtn.style.display = 'none';
      section.innerHTML = '';
    } else if (data.status === 'aguardando_qr') {
      statusEl.textContent = 'Aguardando QR Code';
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = 'inline-block';
      if (data.qrCode) {
        section.innerHTML = '<div class="qr-box"><img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(data.qrCode) + '" /></div><div style="color:#888;font-size:0.75rem;margin-top:8px">Escaneie com o WhatsApp</div>';
      }
    } else if (data.status === 'iniciando' || data.status === 'autenticado') {
      statusEl.textContent = 'Iniciando...';
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = 'inline-block';
      section.innerHTML = '';
    } else {
      statusEl.textContent = data.status;
      connectBtn.style.display = 'inline-block';
      disconnectBtn.style.display = 'none';
      section.innerHTML = '';
    }
  } catch (e) {}
}

async function conectarWhatsApp() {
  var token = verificarAuth();
  if (!token) return;
  var btn = document.getElementById('btn-connect');
  btn.textContent = 'Conectando...';
  btn.disabled = true;
  try {
    var res = await fetch('/api/whatsapp/connect', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    var data = await res.json();
    if (data.ok) {
      carregarStatusWhatsApp();
    } else {
      alert(data.erro || 'Erro ao conectar');
    }
  } catch (e) {
    alert('Erro de conexão');
  }
  btn.textContent = 'Conectar WhatsApp';
  btn.disabled = false;
}

async function desconectarWhatsApp() {
  var token = verificarAuth();
  if (!token) return;
  var res = await fetch('/api/whatsapp/disconnect', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  carregarStatusWhatsApp();
}

function verificarAuth() {
  var token = localStorage.getItem('token') || new URLSearchParams(window.location.search).get('token');
  if (!token) { window.location.href = '/login'; return null; }
  return token;
}

async function carregarPedidos() {
  var token = verificarAuth();
  var res = await fetch('/api/pedidos?limite=100', { headers: { 'Authorization': 'Bearer ' + token } });
  var stat = await fetch('/api/stats', { headers: { 'Authorization': 'Bearer ' + token } });
  var data = await res.json();
  var s = await stat.json();
  if (!data.ok) { window.location.href = '/login'; return; }
  todosPedidos = data.pedidos;
  document.getElementById('stat-hoje').innerText = s.stats.pedidosHoje;
  document.getElementById('stat-fat-hoje').innerText = 'R$' + s.stats.faturamentoHoje;
  document.getElementById('stat-total').innerText = s.stats.totalPedidos;
  document.getElementById('stat-ticket').innerText = 'R$' + s.stats.ticketMedio;
  renderizarTabela(filtroAtivo);
}

function renderizarTabela(filtro) {
  var pedidos = filtro === 'todos' ? todosPedidos : todosPedidos.filter(function(p) { return p.status === filtro; });
  var html = '';
  for (var i = 0; i < pedidos.length; i++) {
    var p = pedidos[i];
    var itensHtml = '';
    for (var j = 0; j < p.itens.length; j++) { itensHtml += p.itens[j].quantidade + 'x ' + p.itens[j].nome + '<br>'; }
    html += '<tr><td><span class="pedido-id">#' + p.id.substring(0,8).toUpperCase() + '</span></td>';
    html += '<td>' + p.telefone.replace('@c.us','').replace(/(\\d{2})(\\d{2})(\\d{5})(\\d{4})/, '+$1 ($2) $3-$4') + '</td>';
    html += '<td>' + itensHtml + '</td>';
    html += '<td><span class="total">R$' + parseFloat(p.total).toFixed(2) + '</span></td>';
    html += '<td><span class="status status-' + p.status + '">' + p.status + '</span> ';
    html += '<select class="status-select" onchange="atualizarStatus(\\'' + p.id + '\\', this.value)"><option value="">Alterar</option><option value="em_preparo">Em Preparo</option><option value="saiu_entrega">Saiu para Entrega</option><option value="entregue">Entregue</option></select></td></tr>';
  }
  if (html === '') html = '<tr><td colspan="5" style="text-align:center;padding:40px;color:#666">Nenhum pedido</td></tr>';
  document.getElementById('tabela-body').innerHTML = html;
}

async function atualizarStatus(id, status) {
  if (!status) return;
  var token = verificarAuth();
  await fetch('/api/pedidos/' + id + '/status', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ status: status })
  });
  carregarPedidos();
}

function filtrar(status, btn) {
  filtroAtivo = status;
  var btns = document.querySelectorAll('.filtro-btn');
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('ativo');
  btn.classList.add('ativo');
  renderizarTabela(status);
}

function trocarSenha() {
  var token = localStorage.getItem('token');
  window.location.href = '/trocar-senha?token=' + token;
}

async function logout() {
  var token = localStorage.getItem('token');
  if (token) await fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
  localStorage.removeItem('token');
  window.location.href = '/login';
}

verificarAuth();
carregarPedidos();
carregarStatusWhatsApp();
setInterval(carregarPedidos, 30000);
setInterval(carregarStatusWhatsApp, 5000);
</script>
</body>
</html>`;
  return html;
}

function gerarHTMLTrocarSenha() {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zé Delivery — Trocar Senha</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .box { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 40px; width: 100%; max-width: 380px; }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo h1 { font-size: 1.8rem; color: #e63946; }
    .logo p { color: #666; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; color: #888; font-size: 0.85rem; margin-bottom: 8px; }
    .form-group input { width: 100%; padding: 14px; background: #222; border: 1px solid #333; border-radius: 8px; color: #fff; font-size: 1rem; }
    .btn { width: 100%; padding: 14px; background: #e63946; border: none; border-radius: 8px; color: #fff; font-size: 1rem; cursor: pointer; margin-top: 10px; }
    .btn:hover { background: #c1121f; }
    .erro { background: #3a1a1a; color: #ff6b6b; padding: 12px; border-radius: 8px; margin-bottom: 20px; display: none; }
    .erro.show { display: block; }
    .sucesso { background: #1a3a1a; color: #2dc653; padding: 12px; border-radius: 8px; margin-bottom: 20px; display: none; }
    .sucesso.show { display: block; }
    .link { color: #e63946; text-decoration: none; display: block; text-align: center; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="logo"><h1>🔐 Trocar Senha</h1><p>Zé Delivery</p></div>
    <div class="erro" id="erro"></div>
    <div class="sucesso" id="sucesso"></div>
    <form id="form-trocar">
      <div class="form-group"><label>Senha Atual</label><input type="password" id="senhaAtual" required></div>
      <div class="form-group"><label>Nova Senha</label><input type="password" id="novaSenha" required minlength="6"></div>
      <div class="form-group"><label>Confirmar Nova Senha</label><input type="password" id="confirmarSenha" required></div>
      <button type="submit" class="btn">Alterar Senha</button>
    </form>
    <a href="/" class="link">← Voltar ao Painel</a>
  </div>
  <script>
    function getToken() {
      return localStorage.getItem('token') || new URLSearchParams(window.location.search).get('token');
    }

    document.getElementById('form-trocar').addEventListener('submit', async (e) => {
      e.preventDefault();
      var senhaAtual = document.getElementById('senhaAtual').value;
      var novaSenha = document.getElementById('novaSenha').value;
      var confirmar = document.getElementById('confirmarSenha').value;

      if (novaSenha !== confirmar) {
        document.getElementById('erro').textContent = 'As senhas não conferem';
        document.getElementById('erro').classList.add('show');
        return;
      }

      var res = await fetch('/api/auth/trocar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
        body: JSON.stringify({ senhaAtual: senhaAtual, novaSenha: novaSenha })
      });
      var data = await res.json();
      if (data.ok) {
        document.getElementById('erro').classList.remove('show');
        document.getElementById('sucesso').textContent = 'Senha alterada com sucesso!';
        document.getElementById('sucesso').classList.add('show');
        document.getElementById('form-trocar').reset();
        setTimeout(function() { window.location.href = '/'; }, 1500);
      } else {
        document.getElementById('erro').textContent = data.erro;
        document.getElementById('erro').classList.add('show');
        document.getElementById('sucesso').classList.remove('show');
      }
    });
  </script>
</body>
</html>`;
  return html;
}

function iniciarPainel() {
  const PORTA = process.env.PORT || 3000;
  app.listen(PORTA, function() {
    console.log('\n🌐 Painel disponível em: http://localhost:' + PORTA);
    console.log('   Faça login para acessar!\n');
  });
}