/**
 * storage.js — Armazenamento com SQLite
 *
 * Usa better-sqlite3 (síncrono, zero configuração, um arquivo local).
 * O banco é criado automaticamente em "burger_bot.db" na pasta do projeto.
 *
 * Tabelas:
 *   pedidos  — registro de cada pedido
 *   itens    — itens de cada pedido (relacionado por pedido_id)
 */

const Database = require('better-sqlite3');
const path = require('path');

// Caminho do arquivo do banco de dados
const DB_PATH = path.join(__dirname, 'burger_bot.db');

// Abre (ou cria) o banco de dados
const db = new Database(DB_PATH);

// ──────────────────────────────────────────────
// Otimizações de performance do SQLite
// ──────────────────────────────────────────────
db.pragma('journal_mode = WAL');   // Escrita mais rápida
db.pragma('foreign_keys = ON');    // Integridade referencial

// ──────────────────────────────────────────────
// Criação das tabelas (só roda se não existirem)
// ──────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS pedidos (
    id           TEXT    PRIMARY KEY,
    telefone     TEXT    NOT NULL,
    total        REAL    NOT NULL DEFAULT 0,
    status       TEXT    NOT NULL DEFAULT 'novo',
    criado_em    TEXT    NOT NULL,
    confirmado_em TEXT,
    atualizado_em TEXT,
    ativo        INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS itens (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id    TEXT    NOT NULL REFERENCES pedidos(id),
    item_id      INTEGER NOT NULL,
    nome         TEXT    NOT NULL,
    preco        REAL    NOT NULL,
    quantidade   INTEGER NOT NULL
  );
`);

console.log('🗄️  Banco de dados SQLite conectado:', DB_PATH);

// ──────────────────────────────────────────────
// Migration: adiciona coluna 'ativo' se não existir
// ──────────────────────────────────────────────
try {
  db.exec(`ALTER TABLE pedidos ADD COLUMN ativo INTEGER NOT NULL DEFAULT 0`);
  console.log('📌 Coluna "ativo" adicionada à tabela pedidos');
} catch (e) {
  if (e.message.includes('duplicate column name')) {
    // Coluna já existe, tudo ok
  } else {
    // Outro erro, mas pode continuar
  }
}

// ──────────────────────────────────────────────
// Prepared Statements (mais rápidos e seguros)
// ──────────────────────────────────────────────
const stmtInserirPedido = db.prepare(`
  INSERT OR REPLACE INTO pedidos (id, telefone, total, status, criado_em, ativo)
  VALUES (@id, @telefone, @total, @status, @criado_em, 0)
`);

const stmtInserirItem = db.prepare(`
  INSERT INTO itens (pedido_id, item_id, nome, preco, quantidade)
  VALUES (@pedido_id, @item_id, @nome, @preco, @quantidade)
`);

const stmtConfirmarPedido = db.prepare(`
  UPDATE pedidos
  SET status = 'confirmado', confirmado_em = @confirmado_em
  WHERE id = @id
`);

const stmtGetPedido = db.prepare(`
  SELECT * FROM pedidos WHERE id = ?
`);

const stmtGetItensDoPedido = db.prepare(`
  SELECT * FROM itens WHERE pedido_id = ?
`);

const stmtListarPedidos = db.prepare(`
  SELECT * FROM pedidos ORDER BY criado_em DESC LIMIT ?
`);

const stmtAtualizarStatus = db.prepare(`
  UPDATE pedidos
  SET status = @status, atualizado_em = @atualizado_em
  WHERE id = @id
`);

const stmtSalvarPedidoAtivo = db.prepare(`
  INSERT OR REPLACE INTO pedidos (id, telefone, total, status, criado_em, ativo)
  VALUES (@id, @telefone, @total, @status, @criado_em, 1)
`);

const stmtSalvarItemAtivo = db.prepare(`
  INSERT OR REPLACE INTO itens (pedido_id, item_id, nome, preco, quantidade)
  VALUES (@pedido_id, @item_id, @nome, @preco, @quantidade)
`);

const stmtLimparItensAtivos = db.prepare(`
  DELETE FROM itens WHERE pedido_id = ?
`);

const stmtGetPedidosAtivos = db.prepare(`
  SELECT * FROM pedidos WHERE ativo = 1 ORDER BY criado_em DESC
`);

// ──────────────────────────────────────────────
// Funções exportadas
// ──────────────────────────────────────────────

/**
 * Salva um pedido ativo (não confirmado) no banco
 * @param {object} pedido
 */
function salvarPedidoAtivo(pedido) {
  const transacao = db.transaction((p) => {
    stmtSalvarPedidoAtivo.run({
      id:        p.id,
      telefone:  p.telefone,
      total:     p.total,
      status:    p.status || 'novo',
      criado_em: p.criadoEm
    });

    stmtLimparItensAtivos.run(p.id);

    for (const item of p.itens) {
      stmtSalvarItemAtivo.run({
        pedido_id:  p.id,
        item_id:    item.id,
        nome:       item.nome,
        preco:      item.preco,
        quantidade: item.quantidade
      });
    }
  });

  transacao(pedido);
}

/**
 * Carrega todos os pedidos ativos do banco (ao iniciar o bot)
 * @returns {Array}
 */
function carregarPedidosAtivos() {
  const pedidos = stmtGetPedidosAtivos.all();
  return pedidos.map(p => ({
    ...p,
    itens: stmtGetItensDoPedido.all(p.id)
  }));
}

/**
 * Remove pedido ativo do banco (quando confirmado ou cancelado)
 * @param {string} id
 */
function removerPedidoAtivo(id) {
  db.prepare('UPDATE pedidos SET ativo = 0 WHERE id = ?').run(id);
}

/**
 * Salva um pedido confirmado no banco
 * Usa transação para garantir consistência (pedido + itens juntos)
 * @param {object} pedido
 */
function salvarPedido(pedido) {
  const transacao = db.transaction((p) => {
    stmtInserirPedido.run({
      id:        p.id,
      telefone:  p.telefone,
      total:     p.total,
      status:    p.status,
      criado_em: p.criadoEm
    });

    stmtLimparItensAtivos.run(p.id);

    for (const item of p.itens) {
      stmtInserirItem.run({
        pedido_id:  p.id,
        item_id:    item.id,
        nome:       item.nome,
        preco:      item.preco,
        quantidade: item.quantidade
      });
    }
  });

  transacao(pedido);
  console.log(`💾 Pedido #${pedido.id.substring(0, 8)} confirmado no SQLite.`);
}

/**
 * Confirma um pedido (atualiza status no banco)
 * @param {string} id
 */
function confirmarPedidoDB(id) {
  stmtConfirmarPedido.run({
    id,
    confirmado_em: new Date().toISOString()
  });
}

/**
 * Retorna um pedido completo (com itens) pelo ID
 * @param {string} id
 * @returns {object|null}
 */
function getPedidoCompleto(id) {
  const pedido = stmtGetPedido.get(id);
  if (!pedido) return null;
  pedido.itens = stmtGetItensDoPedido.all(id);
  return pedido;
}

/**
 * Lista os pedidos mais recentes
 * @param {number} limite
 * @returns {Array}
 */
function listarPedidos(limite = 50) {
  const pedidos = stmtListarPedidos.all(limite);
  return pedidos.map(p => ({
    ...p,
    itens: stmtGetItensDoPedido.all(p.id)
  }));
}

/**
 * Atualiza o status de um pedido
 * @param {string} id
 * @param {string} status — 'novo' | 'confirmado' | 'em_preparo' | 'saiu_entrega' | 'entregue'
 */
function atualizarStatusPedido(id, status) {
  stmtAtualizarStatus.run({
    id,
    status,
    atualizado_em: new Date().toISOString()
  });
  console.log(`🔄 Pedido #${id.substring(0, 8)} → status: ${status}`);
}

/**
 * Estatísticas gerais do negócio
 * @returns {object}
 */
function getEstatisticas() {
  const hoje = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
  
  // Conta pedidos que foram pagos/confirmados (não cancelados)
  const statusValidos = ['confirmado', 'em_preparo', 'saiu_entrega', 'entregue'];
  const placeholders = statusValidos.map(() => '?').join(',');

  const totalPedidos = db.prepare(
    `SELECT COUNT(*) as total FROM pedidos WHERE status IN (${placeholders})`
  ).get(...statusValidos);

  const pedidosHoje = db.prepare(
    `SELECT COUNT(*) as total FROM pedidos WHERE status IN (${placeholders}) AND criado_em LIKE ?`
  ).get(...statusValidos, `${hoje}%`);

  const faturamento = db.prepare(
    `SELECT COALESCE(SUM(total), 0) as total FROM pedidos WHERE status IN (${placeholders})`
  ).get(...statusValidos);

  const faturamentoHoje = db.prepare(
    `SELECT COALESCE(SUM(total), 0) as total FROM pedidos WHERE status IN (${placeholders}) AND criado_em LIKE ?`
  ).get(...statusValidos, `${hoje}%`);

  const ticketMedio = db.prepare(
    `SELECT COALESCE(AVG(total), 0) as media FROM pedidos WHERE status IN (${placeholders})`
  ).get(...statusValidos);

  return {
    totalPedidos:     totalPedidos.total,
    pedidosHoje:      pedidosHoje.total,
    totalFaturado:    faturamento.total.toFixed(2),
    faturamentoHoje:  faturamentoHoje.total.toFixed(2),
    ticketMedio:      ticketMedio.media.toFixed(2)
  };
}

/**
 * Fecha o banco de dados (útil para shutdown limpo)
 */
function fecharBanco() {
  db.close();
  console.log('🗄️  Banco de dados fechado.');
}

// Fecha o banco ao encerrar o processo
process.on('exit', fecharBanco);
process.on('SIGINT', () => { fecharBanco(); process.exit(0); });

module.exports = {
  salvarPedido,
  confirmarPedidoDB,
  getPedidoCompleto,
  listarPedidos,
  atualizarStatusPedido,
  getEstatisticas,
  salvarPedidoAtivo,
  carregarPedidosAtivos,
  removerPedidoAtivo
};
