/**
 * index.js — Ponto de entrada v2
 *
 * Comportamento:
 * - SEMPRE inicia o painel web primeiro
 * - WhatsApp só é conectado via painel admin
 */

require('dotenv').config();

const { iniciarPainel, setWhatsAppClient } = require('./painel');
const { getClient } = require('./bot');

console.log('');
console.log('╔══════════════════════════════════════╗');
console.log('║   🍔  ZÉ DELIVERY BOT  v2.0         ║');
console.log('║   Painel aguardando conexão...      ║');
console.log('╚══════════════════════════════════════╝');
console.log('');

iniciarPainel();

const intervalo = setInterval(() => {
  const client = getClient();
  if (client) {
    setWhatsAppClient(client);
    clearInterval(intervalo);
  }
}, 1000);

process.on('SIGINT', () => {
  console.log('\n👋 Encerrando bot... Até logo!');
  process.exit(0);
});