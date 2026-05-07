/**
 * auth.js — Sistema de autenticação para o painel admin
 *
 * Suporta:
 * - Login com hash bcrypt
 * - Cadastro de novos usuários
 * - Recuperação de senha (código por e-mail simulado)
 * - Sessões em memória com TTL
 * - Usuários persistidos no SQLite
 */

const crypto = require('crypto');
const Database = require('better-sqlite3');
const path = require('path');

const SESSAO_TTL = 24 * 60 * 60 * 1000;

const sessoesAtivas = new Map();
const codigosRecuperacao = new Map();

const DB_PATH = path.join(__dirname, 'burger_bot.db');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    UNIQUE NOT NULL,
    email      TEXT    UNIQUE,
    senha_hash TEXT    NOT NULL,
    papel      TEXT    NOT NULL DEFAULT 'admin',
    ativo      INTEGER NOT NULL DEFAULT 1,
    criado_em  TEXT    NOT NULL,
    ultimo_login TEXT
  );
`);

function gerarHash(senha) {
  const salt = process.env.ADMIN_SALT || 'ze_delivery_default_salt_change_in_production';
  return crypto.pbkdf2Sync(senha, salt, 100000, 64, 'sha512').toString('hex');
}

function verificarSenha(senha, hash) {
  return gerarHash(senha) === hash;
}

function gerarToken() {
  return crypto.randomBytes(32).toString('hex');
}

function gerarCodigoRecuperacao() {
  return crypto.randomInt(100000, 999999).toString();
}

function criarUsuario(username, senha, email = null) {
  const existente = db.prepare('SELECT id FROM usuarios WHERE username = ?').get(username);
  if (existente) {
    return { ok: false, erro: 'Nome de usuário já existe' };
  }

  if (email) {
    const existenteEmail = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
    if (existenteEmail) {
      return { ok: false, erro: 'E-mail já cadastrado' };
    }
  }

  const hash = gerarHash(senha);
  const agora = new Date().toISOString();

  db.prepare(`
    INSERT INTO usuarios (username, email, senha_hash, papel, ativo, criado_em)
    VALUES (?, ?, ?, 'admin', 1, ?)
  `).run(username, email || null, hash, agora);

  return { ok: true, mensagem: 'Usuário criado com sucesso' };
}

function login(username, senha) {
  const user = db.prepare('SELECT * FROM usuarios WHERE username = ? AND ativo = 1').get(username);

  if (!user) {
    return { ok: false, erro: 'Usuário inválido' };
  }

  if (!verificarSenha(senha, user.senha_hash)) {
    return { ok: false, erro: 'Senha incorreta' };
  }

  const token = gerarToken();
  sessoesAtivas.set(token, {
    username: user.username,
    userId: user.id,
    papel: user.papel,
    criadoEm: Date.now(),
    expiraEm: Date.now() + SESSAO_TTL
  });

  db.prepare('UPDATE usuarios SET ultimo_login = ? WHERE id = ?')
    .run(new Date().toISOString(), user.id);

  return { ok: true, token, username: user.username };
}

function verificarToken(token) {
  if (!token) return false;

  const sessao = sessoesAtivas.get(token);
  if (!sessao) return false;

  if (Date.now() > sessao.expiraEm) {
    sessoesAtivas.delete(token);
    return false;
  }

  sessao.expiraEm = Date.now() + SESSAO_TTL;
  return true;
}

function logout(token) {
  if (token) {
    sessoesAtivas.delete(token);
  }
  return { ok: true };
}

function getHashSenha(senha) {
  return gerarHash(senha);
}

function gerarCodigo(email) {
  const user = db.prepare('SELECT id, username FROM usuarios WHERE email = ? AND ativo = 1').get(email);
  if (!user) {
    return { ok: false, erro: 'E-mail não encontrado' };
  }

  const codigo = gerarCodigoRecuperacao();
  const expiraEm = Date.now() + 15 * 60 * 1000;

  codigosRecuperacao.set(email, {
    codigo,
    userId: user.id,
    expiraEm
  });

  console.log(`📧 Código de recuperação para ${email}: ${codigo}`);
  console.log('   (Em produção, envie por e-mail real)');

  return { ok: true, codigo };
}

function redefinirSenha(email, codigo, novaSenha) {
  const recuperacao = codigosRecuperacao.get(email);

  if (!recuperacao) {
    return { ok: false, erro: 'Código expirado ou inválido. Solicite um novo.' };
  }

  if (Date.now() > recuperacao.expiraEm) {
    codigosRecuperacao.delete(email);
    return { ok: false, erro: 'Código expirado. Solicite um novo.' };
  }

  if (recuperacao.codigo !== codigo) {
    return { ok: false, erro: 'Código incorreto' };
  }

  const hash = gerarHash(novaSenha);
  db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?')
    .run(hash, recuperacao.userId);

  codigosRecuperacao.delete(email);

  return { ok: true, mensagem: 'Senha alterada com sucesso' };
}

function listarUsuarios(token) {
  if (!verificarToken(token)) return null;

  const sessao = sessoesAtivas.get(token);
  if (sessao.papel !== 'admin') return null;

  return db.prepare('SELECT id, username, email, papel, ativo, criado_em, ultimo_login FROM usuarios ORDER BY criado_em DESC').all();
}

function atualizarSenha(userId, senhaAtual, novaSenha) {
  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(userId);
  if (!user) return { ok: false, erro: 'Usuário não encontrado' };

  if (!verificarSenha(senhaAtual, user.senha_hash)) {
    return { ok: false, erro: 'Senha atual incorreta' };
  }

  const hash = gerarHash(novaSenha);
  db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hash, userId);

  return { ok: true };
}

function getUsuarioAtual(token) {
  const sessao = sessoesAtivas.get(token);
  if (!sessao) return null;
  return { userId: sessao.userId, username: sessao.username, papel: sessao.papel };
}

function criarAdminPadrao() {
  const existente = db.prepare("SELECT id FROM usuarios WHERE papel = 'admin'").get();
  if (!existente) {
    const username = process.env.ADMIN_USER || 'admin';
    const senha = process.env.ADMIN_SENHA || 'admin123';
    const email = process.env.ADMIN_EMAIL || null;

    criarUsuario(username, senha, email);
    console.log(`✅ Usuário admin criado: ${username} / ${senha}`);
  }
}

criarAdminPadrao();

module.exports = {
  login,
  criarUsuario,
  verificarToken,
  logout,
  getHashSenha,
  gerarCodigo,
  redefinirSenha,
  listarUsuarios,
  atualizarSenha,
  getUsuarioAtual
};