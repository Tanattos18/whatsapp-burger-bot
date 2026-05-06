/**
 * auth.js — Sistema de autenticação para o painel admin
 *
 * Gerencia login/senha usando hash bcrypt
 * Sessão usando token JWT simples em memória
 */

const crypto = require('crypto');

const SESSAO_TTL = 24 * 60 * 60 * 1000; // 24 horas

const sessoesAtivas = new Map();

function gerarHash(senha) {
  const salt = process.env.ADMIN_SALT || 'ze_delivery_default_salt';
  return crypto.pbkdf2Sync(senha, salt, 100000, 64, 'sha512').toString('hex');
}

function verificarSenha(senha, hash) {
  return gerarHash(senha) === hash;
}

function gerarToken() {
  return crypto.randomBytes(32).toString('hex');
}

function login(username, senha) {
  const userAdmin = process.env.ADMIN_USER || 'admin';
  const hashAdmin = process.env.ADMIN_HASH || gerarHash('admin123');

  if (username !== userAdmin) {
    return { ok: false, erro: 'Usuário inválido' };
  }

  if (!verificarSenha(senha, hashAdmin)) {
    return { ok: false, erro: 'Senha incorreta' };
  }

  const token = gerarToken();
  sessoesAtivas.set(token, {
    username,
    criadoEm: Date.now(),
    expiraEm: Date.now() + SESSAO_TTL
  });

  return { ok: true, token };
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

module.exports = {
  login,
  verificarToken,
  logout,
  getHashSenha
};