/**
 * painel.js — Servidor web do painel de pedidos
 */

const express = require('express');
const path = require('path');
const { login, verificarToken, logout } = require('./auth');
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

app.get('/', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (verificarToken(token)) {
    res.send(gerarHTMLPainel());
  } else {
    res.redirect('/login');
  }
});

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
  </style>
</head>
<body>
<div class="header">
  <div><h1>🍔 Zé Delivery</h1><div style="font-size:0.85rem;opacity:0.85">Painel de Pedidos</div></div>
  <div style="display:flex;gap:12px;align-items:center"><div class="badge-online">● ONLINE</div><button class="btn-sair" onclick="logout()">Sair</button></div>
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
  <button class="filtro-btn" onclick="filtrar('entregue', this)">Entregues</button>
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
    html += '<select class="status-select" onchange="atualizarStatus(\\'' + p.id + '\\', this.value)"><option value="">Alterar</option><option value="em_preparo">Em Preparo</option><option value="entregue">Entregue</option></select></td></tr>';
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

async function logout() {
  var token = localStorage.getItem('token');
  if (token) await fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
  localStorage.removeItem('token');
  window.location.href = '/login';
}

verificarAuth();
carregarPedidos();
setInterval(carregarPedidos, 30000);
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

module.exports = { iniciarPainel, app, setWhatsAppClient };