/**
 * painel.js — Servidor web do painel de pedidos
 *
 * Expõe:
 *   GET /           → Painel HTML com pedidos em tempo real
 *   GET /api/pedidos → JSON com os pedidos recentes
 *   GET /api/stats   → JSON com estatísticas
 *   PUT /api/pedidos/:id/status → Atualiza status de um pedido
 *   GET /qrcodes/*  → Serve imagens de QR Code Pix
 *
 * Acesse em: http://localhost:3000
 */

const express  = require('express');
const path     = require('path');
const {
  listarPedidos,
  atualizarStatusPedido,
  getEstatisticas,
  getPedidoCompleto
} = require('./storage');
const { notificarStatusPedido, notificarClienteStatus } = require('./telegram');

const app = express();
app.use(express.json());

// Variável global para armazenar o cliente WhatsApp
let whatsappClient = null;

/**
 * Define o cliente WhatsApp para enviar notificações
 * Chamado por bot.js
 */
function setWhatsAppClient(client) {
  whatsappClient = client;
  console.log('✅ Cliente WhatsApp vinculado ao painel');
}

// Serve arquivos estáticos (QR Codes)
app.use('/qrcodes', express.static(path.join(__dirname, 'public', 'qrcodes')));

// ──────────────────────────────────────────────
// API — Dados em JSON
// ──────────────────────────────────────────────

// Lista pedidos recentes
app.get('/api/pedidos', (req, res) => {
  const limite = parseInt(req.query.limite) || 50;
  const pedidos = listarPedidos(limite);
  res.json({ ok: true, pedidos });
});

// Estatísticas do negócio
app.get('/api/stats', (req, res) => {
  const stats = getEstatisticas();
  res.json({ ok: true, stats });
});

// Atualiza status de um pedido
app.put('/api/pedidos/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const statusValidos = ['novo', 'confirmado', 'em_preparo', 'saiu_entrega', 'entregue', 'cancelado'];
  if (!statusValidos.includes(status)) {
    return res.status(400).json({ ok: false, erro: 'Status inválido' });
  }

  atualizarStatusPedido(id, status);

  // Obtém o pedido completo
  const pedido = getPedidoCompleto(id);

  // Notifica a cozinha via Telegram
  try {
    if (pedido) await notificarStatusPedido(pedido, status);
  } catch (e) {}

  // Notifica o cliente via WhatsApp (se cliente estiver conectado)
  try {
    if (pedido && whatsappClient && ['em_preparo', 'saiu_entrega', 'entregue', 'cancelado'].includes(status)) {
      await notificarClienteStatus(whatsappClient, pedido.telefone, pedido, status);
    }
  } catch (e) {
    console.error('⚠️  Erro ao notificar cliente:', e.message);
  }

  res.json({ ok: true, mensagem: `Status atualizado para: ${status}` });
});

// ──────────────────────────────────────────────
// Painel HTML
// ──────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send(gerarHTMLPainel());
});

/**
 * Gera o HTML completo do painel
 * Dashboard responsivo com atualização automática
 */
function gerarHTMLPainel() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🍔 Zé Delivery — Painel de Pedidos</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f0f0f;
      color: #fff;
      min-height: 100vh;
    }

    /* ── Header ── */
    .header {
      background: linear-gradient(135deg, #e63946, #c1121f);
      padding: 20px 30px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 20px rgba(230,57,70,0.4);
    }
    .header h1 { font-size: 1.6rem; font-weight: 700; }
    .header .subtitle { font-size: 0.85rem; opacity: 0.85; margin-top: 2px; }
    .badge-online {
      background: #2dc653;
      color: #fff;
      padding: 5px 14px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.6; }
    }

    /* ── Stats Cards ── */
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      padding: 24px 30px;
    }
    .stat-card {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    .stat-card .valor {
      font-size: 2rem;
      font-weight: 700;
      color: #e63946;
    }
    .stat-card .label {
      font-size: 0.78rem;
      color: #888;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* ── Filtros ── */
    .filtros {
      padding: 0 30px 16px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .filtro-btn {
      padding: 6px 16px;
      border-radius: 20px;
      border: 1px solid #333;
      background: #1a1a1a;
      color: #aaa;
      font-size: 0.82rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .filtro-btn:hover, .filtro-btn.ativo {
      background: #e63946;
      border-color: #e63946;
      color: #fff;
    }

    /* ── Tabela de Pedidos ── */
    .container { padding: 0 30px 40px; }

    .table-wrap {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 12px;
      overflow: hidden;
    }

    table { width: 100%; border-collapse: collapse; }

    th {
      background: #222;
      padding: 14px 16px;
      text-align: left;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #666;
      border-bottom: 1px solid #2a2a2a;
    }

    td {
      padding: 14px 16px;
      font-size: 0.88rem;
      border-bottom: 1px solid #222;
      vertical-align: top;
    }

    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #202020; }

    .pedido-id {
      font-family: monospace;
      font-size: 0.82rem;
      color: #e63946;
      font-weight: 600;
    }

    .telefone { color: #aaa; font-size: 0.82rem; }

    .itens-lista { font-size: 0.82rem; color: #bbb; line-height: 1.7; }
    .itens-lista strong { color: #fff; }

    .total {
      font-weight: 700;
      color: #2dc653;
      font-size: 1rem;
    }

    .horario { color: #555; font-size: 0.78rem; }

    /* Status badges */
    .status {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .status-novo        { background: #1a2a4a; color: #4da6ff; }
    .status-confirmado  { background: #1a3a2a; color: #2dc653; }
    .status-em_preparo  { background: #3a2a10; color: #ff9f0a; }
    .status-saiu_entrega{ background: #2a1a3a; color: #bf5af2; }
    .status-entregue    { background: #1a2a1a; color: #30d158; }
    .status-cancelado   { background: #3a1a1a; color: #ff453a; }

    /* Select de status */
    .status-select {
      background: #2a2a2a;
      border: 1px solid #333;
      color: #fff;
      padding: 5px 8px;
      border-radius: 6px;
      font-size: 0.8rem;
      cursor: pointer;
      margin-top: 6px;
    }
    .status-select:focus { outline: none; border-color: #e63946; }

    /* Empty state */
    .empty {
      text-align: center;
      padding: 60px 20px;
      color: #444;
    }
    .empty .icon { font-size: 3rem; margin-bottom: 12px; }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 30px; right: 30px;
      background: #2dc653;
      color: #fff;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 600;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.3s;
      z-index: 999;
    }
    .toast.show { transform: translateY(0); opacity: 1; }

    /* Atualização automática */
    .auto-refresh { color: #555; font-size: 0.78rem; text-align: right; padding: 8px 30px 0; }
  </style>
</head>
<body>

<div class="header">
  <div>
    <h1>🍔 Zé Delivery</h1>
    <div class="subtitle">Painel de Pedidos em Tempo Real</div>
  </div>
  <div class="badge-online">● ONLINE</div>
</div>

<!-- Cards de estatísticas -->
<div class="stats" id="stats">
  <div class="stat-card">
    <div class="valor" id="stat-hoje">—</div>
    <div class="label">Pedidos Hoje</div>
  </div>
  <div class="stat-card">
    <div class="valor" id="stat-fat-hoje">—</div>
    <div class="label">Faturamento Hoje</div>
  </div>
  <div class="stat-card">
    <div class="valor" id="stat-total">—</div>
    <div class="label">Total de Pedidos</div>
  </div>
  <div class="stat-card">
    <div class="valor" id="stat-ticket">—</div>
    <div class="label">Ticket Médio</div>
  </div>
</div>

<!-- Filtros -->
<div class="filtros">
  <button class="filtro-btn ativo" onclick="filtrar('todos', this)">Todos</button>
  <button class="filtro-btn" onclick="filtrar('confirmado', this)">✅ Confirmados</button>
  <button class="filtro-btn" onclick="filtrar('em_preparo', this)">🔥 Em Preparo</button>
  <button class="filtro-btn" onclick="filtrar('saiu_entrega', this)">🛵 Em Entrega</button>
  <button class="filtro-btn" onclick="filtrar('entregue', this)">📦 Entregues</button>
  <button class="filtro-btn" onclick="filtrar('cancelado', this)">❌ Cancelados</button>
</div>

<p class="auto-refresh">🔄 Atualização automática a cada 30s &nbsp;|&nbsp; <span id="ultima-atualizacao">—</span></p>

<!-- Tabela de pedidos -->
<div class="container">
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Pedido</th>
          <th>Cliente</th>
          <th>Itens</th>
          <th>Total</th>
          <th>Horário</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody id="tabela-body">
        <tr><td colspan="6" class="empty">
          <div class="icon">⏳</div>
          Carregando pedidos...
        </td></tr>
      </tbody>
    </table>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
  let todosPedidos = [];
  let filtroAtivo = 'todos';

  // ── Carrega pedidos ──────────────────────────
  async function carregarPedidos() {
    try {
      const [resPedidos, resStats] = await Promise.all([
        fetch('/api/pedidos?limite=100'),
        fetch('/api/stats')
      ]);
      const { pedidos } = await resPedidos.json();
      const { stats }   = await resStats.json();

      todosPedidos = pedidos;
      renderizarStats(stats);
      renderizarTabela(filtroAtivo);

      document.getElementById('ultima-atualizacao').textContent =
        'Última atualização: ' + new Date().toLocaleTimeString('pt-BR');

    } catch (e) {
      console.error('Erro ao carregar pedidos:', e);
    }
  }

  // ── Renderiza estatísticas ───────────────────
  function renderizarStats(stats) {
    document.getElementById('stat-hoje').textContent    = stats.pedidosHoje;
    document.getElementById('stat-fat-hoje').textContent = 'R$' + stats.faturamentoHoje;
    document.getElementById('stat-total').textContent   = stats.totalPedidos;
    document.getElementById('stat-ticket').textContent  = 'R$' + stats.ticketMedio;
  }

  // ── Renderiza tabela ─────────────────────────
  function renderizarTabela(filtro) {
    const tbody = document.getElementById('tabela-body');
    const pedidos = filtro === 'todos'
      ? todosPedidos
      : todosPedidos.filter(p => p.status === filtro);

    if (pedidos.length === 0) {
      tbody.innerHTML = \`<tr><td colspan="6" class="empty">
        <div class="icon">🍔</div>
        Nenhum pedido encontrado
      </td></tr>\`;
      return;
    }

    tbody.innerHTML = pedidos.map(pedido => {
      const itensHtml = pedido.itens
        .map(i => \`<strong>\${i.quantidade}x</strong> \${i.nome}\`)
        .join('<br>');

      const horario = pedido.criado_em
        ? new Date(pedido.criado_em).toLocaleString('pt-BR')
        : '—';

      const statusBadge = \`<span class="status status-\${pedido.status}">\${labelStatus(pedido.status)}</span>\`;

      const selectStatus = \`
        <select class="status-select" onchange="atualizarStatus('\${pedido.id}', this.value)">
          <option value="">↕ Mudar status</option>
          <option value="em_preparo">🔥 Em Preparo</option>
          <option value="saiu_entrega">🛵 Saiu p/ Entrega</option>
          <option value="entregue">✅ Entregue</option>
          <option value="cancelado">❌ Cancelado</option>
        </select>\`;

      return \`<tr>
        <td><span class="pedido-id">#\${pedido.id.substring(0,8).toUpperCase()}</span></td>
        <td><span class="telefone">\${formatarTelefone(pedido.telefone)}</span></td>
        <td><div class="itens-lista">\${itensHtml}</div></td>
        <td><span class="total">R$\${parseFloat(pedido.total).toFixed(2)}</span></td>
        <td><span class="horario">\${horario}</span></td>
        <td>\${statusBadge}\${selectStatus}</td>
      </tr>\`;
    }).join('');
  }

  // ── Atualiza status de um pedido ────────────
  async function atualizarStatus(id, status) {
    if (!status) return;
    try {
      const res = await fetch(\`/api/pedidos/\${id}/status\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        const statusLabels = {
          em_preparo: '🔥 Em Preparo',
          saiu_entrega: '🛵 Saiu p/ Entrega',
          entregue: '✅ Entregue',
          cancelado: '❌ Cancelado'
        };
        mostrarToast(\`✅ Status atualizado para: \${statusLabels[status]}\`);
        mostrarToast('📱 Cliente foi notificado via WhatsApp!');
        carregarPedidos();
      }
    } catch (e) {
      mostrarToast('❌ Erro ao atualizar status');
    }
  }

  // ── Filtro ───────────────────────────────────
  function filtrar(status, btn) {
    filtroAtivo = status;
    document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    renderizarTabela(status);
  }

  // ── Helpers ──────────────────────────────────
  function labelStatus(s) {
    const labels = {
      novo: '🔵 Novo', confirmado: '✅ Confirmado',
      em_preparo: '🔥 Em Preparo', saiu_entrega: '🛵 Em Entrega',
      entregue: '📦 Entregue', cancelado: '❌ Cancelado'
    };
    return labels[s] || s;
  }

  function formatarTelefone(t) {
    return t.replace('@c.us','').replace(/(\\d{2})(\\d{2})(\\d{5})(\\d{4})/, '+$1 ($2) $3-$4');
  }

  function mostrarToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3000);
  }

  // ── Inicia e agenda atualização automática ───
  carregarPedidos();
  setInterval(carregarPedidos, 30000); // Atualiza a cada 30s
</script>
</body>
</html>`;
}

/**
 * Inicia o servidor do painel
 */
function iniciarPainel() {
  const PORTA = process.env.PORT || 3000;

  app.listen(PORTA, () => {
    console.log(`\n🌐 Painel de pedidos disponível em: http://localhost:${PORTA}`);
    console.log('   Abra no navegador para ver os pedidos em tempo real!\n');
  });
}

module.exports = { iniciarPainel, app, setWhatsAppClient };
