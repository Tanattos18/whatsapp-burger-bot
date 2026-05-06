/**
 * index.js — Ponto de entrada v2
 * Inicia o bot WhatsApp + painel web simultaneamente
 */

// ⚠️ Carrega dotenv PRIMEIRO, antes de qualquer outro require
require('dotenv').config();

const { startBot }      = require('./bot');
const { iniciarPainel } = require('./painel');

console.log('');
console.log('╔══════════════════════════════════════╗');
console.log('║   🍔  ZÉ DELIVERY BOT  v2.0         ║');
console.log('╚══════════════════════════════════════╝');
console.log('');

// Inicia o painel web de pedidos
iniciarPainel();

// Inicia o bot do WhatsApp
console.log('📱 Iniciando conexão com WhatsApp...');
console.log('   Aguarde o QR Code para escanear.\n');
startBot();

// Shutdown limpo ao pressionar Ctrl+C
process.on('SIGINT', () => {
  console.log('\n👋 Encerrando bot... Até logo!');
  process.exit(0);
});
