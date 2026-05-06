/**
 * orders.js — Gestão de pedidos (v2 — persistência SQLite)
 *
 * - Pedidos ATIVOS são salvos no SQLite (sobrevive a reinicializações)
 * - Ao confirmar, são movidos para pedidos confirmados
 */

const { v4: uuidv4 }             = require('uuid');
const { salvarPedido, salvarPedidoAtivo,
        carregarPedidosAtivos,
        removerPedidoAtivo }     = require('./storage');

// Pedidos ativos em memória (chave = telefone)
const pedidosAtivos = {};

// Carrega pedidos ativos do banco ao iniciar
function inicializarPedidos() {
  const pedidos = carregarPedidosAtivos();
  for (const p of pedidos) {
    pedidosAtivos[p.telefone] = {
      id:        p.id,
      telefone:  p.telefone,
      itens:     p.itens || [],
      total:     p.total,
      status:    p.status,
      criadoEm:  p.criado_em
    };
  }
  console.log(`📥 Carregados ${pedidos.length} pedidos ativos do banco`);
}
inicializarPedidos();

/**
 * Cria um novo pedido para o cliente
 */
function criarPedido(telefone) {
  const pedido = {
    id:        uuidv4(),
    telefone:  telefone,
    itens:     [],
    total:     0,
    status:    'novo',
    criadoEm:  new Date().toISOString()
  };
  pedidosAtivos[telefone] = pedido;
  salvarPedidoAtivo(pedido);
  console.log(`🛒 Novo pedido | ${telefone} | ID: ${pedido.id}`);
  return pedido;
}

/**
 * Adiciona um item ao pedido ativo
 * Se o item já existir, incrementa a quantidade
 */
function adicionarItem(telefone, item, quantidade) {
  const pedido = pedidosAtivos[telefone];
  if (!pedido) throw new Error(`Pedido ativo não encontrado: ${telefone}`);

  const existente = pedido.itens.find(i => i.id === item.id);
  if (existente) {
    existente.quantidade += quantidade;
  } else {
    pedido.itens.push({
      id:         item.id,
      nome:       item.nome,
      preco:      item.preco,
      quantidade: quantidade
    });
  }

  pedido.total = calcularTotal(pedido.itens);
  salvarPedidoAtivo(pedido);
  console.log(`➕ ${quantidade}x ${item.nome} | Total: R$${pedido.total.toFixed(2)}`);
  return pedido;
}

/**
 * Confirma o pedido: salva no SQLite como confirmado e remove dos ativos
 */
function confirmarPedido(telefone) {
  const pedido = pedidosAtivos[telefone];
  if (!pedido) throw new Error(`Pedido ativo não encontrado: ${telefone}`);
  if (pedido.itens.length === 0) throw new Error('Pedido sem itens');

  pedido.status        = 'confirmado';
  pedido.confirmadoEm  = new Date().toISOString();

  salvarPedido(pedido);
  removerPedidoAtivo(pedido.id);
  delete pedidosAtivos[telefone];

  console.log(`✅ Pedido confirmado | ID: ${pedido.id} | R$${pedido.total.toFixed(2)}`);
  return pedido;
}

/**
 * Retorna o pedido ativo (não confirmado) de um cliente
 */
function getPedidoAtivo(telefone) {
  return pedidosAtivos[telefone] || null;
}

/**
 * Cancela e remove um pedido ativo
 */
function cancelarPedido(telefone) {
  const pedido = pedidosAtivos[telefone];
  if (pedido) {
    removerPedidoAtivo(pedido.id);
    delete pedidosAtivos[telefone];
    console.log(`❌ Pedido cancelado | ${telefone}`);
  }
}

function calcularTotal(itens) {
  return itens.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
}

module.exports = { criarPedido, adicionarItem, confirmarPedido, getPedidoAtivo, cancelarPedido };
