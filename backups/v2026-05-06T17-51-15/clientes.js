/**
 * clientes.js — Cadastro e gestão de clientes
 * 
 * Tabelas:
 *   clientes — dados dos clientes cadastrados
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'burger_bot.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
  )
`);

console.log('👥 Tabela clientes criada/conectada');

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
 * Busca cliente pelo telefone
 */
function getCliente(telefone) {
  const telefoneNormalizado = telefoneParaBusca(telefone);
  return stmtBuscarCliente.get(telefoneNormalizado);
}

/**
 * Salva novo cliente ou atualiza existente
 */
function salvarCliente(dados) {
  const telefoneNormalizado = telefoneParaBusca(dados.telefone);
  const telefoneFormatado = normalizarTelefone(dados.telefone);
  
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