/**
 * clientes.js — Cadastro e gestão de clientes
 * 
 * Otimizado para múltiplas conexões
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'burger_bot.db');
const db = new Database(DB_PATH, {
  timeout: 5000,
  verbose: null
});

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000');

db.exec(`
  CREATE TABLE IF NOT EXISTS clientes (
    telefone     TEXT PRIMARY KEY,
    nome         TEXT NOT NULL,
    endereco     TEXT,
    bairro      TEXT,
    complemento TEXT,
    referencia  TEXT,
    created_at   TEXT NOT NULL,
    atualizado_em TEXT
  );
  
  CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome);
`);

console.log('👥 Tabela clientes conectada');

let cacheClientes = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 min

function getCache(telefone) {
  const cached = cacheClientes.get(telefone);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCache(telefone, data) {
  cacheClientes.set(telefone, { data, ts: Date.now() });
}

/**
 * Normaliza telefone para formato padrão (+55...)
 */
function normalizarTelefone(telefone) {
  let t = telefone.replace('@c.us', '').replace('@s.whatsapp.net', '').replace('@lid', '');
  
  // Remove tudo que não for número
  t = t.replace(/\D/g, '');
  
  // Adiciona código do Brasil se não tiver
  if (!t.startsWith('55')) {
    t = '55' + t;
  }
  
  return '+' + t;
}

/**
 * Normaliza telefone para busca no banco (sem +)
 */
function telefoneParaBusca(telefone) {
  return normalizarTelefone(telefone).replace('+', '');
}

const stmtBuscarCliente = db.prepare('SELECT * FROM clientes WHERE telefone = ?');
const stmtSalvarCliente = db.prepare(`
  INSERT OR REPLACE INTO clientes (telefone, nome, endereco, bairro, complemento, referencia, created_at, atualizado_em)
  VALUES (@telefone, @nome, @endereco, @bairro, @complemento, @referencia, @created_at, @atualizado_em)
`);
const stmtAtualizarCliente = db.prepare(`
  UPDATE clientes SET nome = @nome, endereco = @endereco, bairro = @bairro, complemento = @complemento, 
  referencia = @referencia, atualizado_em = @atualizado_em
  WHERE telefone = @telefone
`);

/**
 * Busca cliente pelo telefone (com cache)
 */
function getCliente(telefone) {
  const telefoneNormalizado = telefoneParaBusca(telefone);
  
  // Verifica cache primeiro
  const cached = getCache(telefoneNormalizado);
  if (cached) return cached;
  
  const resultado = stmtBuscarCliente.get(telefoneNormalizado);
  if (resultado) {
    setCache(telefoneNormalizado, resultado);
  }
  return resultado;
}

/**
 * Salva novo cliente (invalidando cache)
 */
function salvarCliente(dados) {
  const telefoneNormalizado = telefoneParaBusca(dados.telefone);
  
  cacheClientes.delete(telefoneNormalizado); // Limpa cache
  
  const existente = getCliente(dados.telefone);
  
  if (existente) {
    stmtAtualizarCliente.run({
      telefone: telefoneNormalizado,
      nome: dados.nome,
      endereco: dados.endereco || '',
      bairro: dados.bairro || '',
      complemento: dados.complemento || '',
      referencia: dados.referencia || '',
      atualizado_em: new Date().toISOString()
    });
  } else {
    stmtSalvarCliente.run({
      telefone: telefoneNormalizado,
      nome: dados.nome,
      endereco: dados.endereco || '',
      bairro: dados.bairro || '',
      complemento: dados.complemento || '',
      referencia: dados.referencia || '',
      created_at: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    });
  }
}

/**
 * Lista todos os clientes
 */
function listarClientes(limite = 100) {
  return db.prepare('SELECT * FROM clientes ORDER BY created_at DESC LIMIT ?').all(limite);
}

/**
 * Conta total de clientes
 */
function getTotalClientes() {
  return db.prepare('SELECT COUNT(*) as total FROM clientes').get().total;
}

/**
 * Formata telefone para exibir (com DD)
 */
function formatarTelefone(telefone) {
  const t = telefone.replace('@c.us', '').replace(/\D/g, '');
  if (t.length === 13) {
    return `+${t.slice(0, 2)} (${t.slice(2, 4)}) ${t.slice(4, 9)}-${t.slice(9)}`;
  }
  return telefone;
}

module.exports = { getCliente, salvarCliente, listarClientes, getTotalClientes, formatarTelefone };