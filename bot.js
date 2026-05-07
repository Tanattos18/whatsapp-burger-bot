/**
 * bot.js — Conexão com WhatsApp (v2)
 *
 * Controlado pelo painel admin via APIs:
 * - conectarWhatsApp()
 * - desconectarWhatsApp()
 * - getStatusWhatsApp()
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { processMessage } = require('./flow');
const { menuBoasVindas, menuConfirmarPedido,
        menuConfirmarItens, menuCarrinho,
        processarBotao } = require('./menus');

let client = null;
let statusConexao = 'desconectado';
let qrCodeData = null;
let listenerQR = null;
let listenerReady = null;
let listenerDisconnected = null;

function normalizarTelefone(from, clientInstance) {
  let telefone = from.replace('@c.us', '').replace('@s.whatsapp.net', '').replace('@lid', '');

  try {
    if (clientInstance) {
      const contato = clientInstance.getContactById(from);
      if (contato && contato.number) {
        telefone = contato.number.replace(/\D/g, '');
      }
    }
  } catch (e) {}

  if (telefone.startsWith('55')) {
    return '+' + telefone;
  }

  return '+55' + telefone;
}

function criarClienteWhatsApp() {
  if (client) {
    try { client.destroy(); } catch (e) {}
    client = null;
  }

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: '.wwebjs_auth'
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', (qr) => {
    qrCodeData = qr;
    statusConexao = 'aguardando_qr';
    console.log('📲 QR Code gerado — aguardando escaneamento');

    try {
      const { notificarQRCode } = require('./painel');
      notificarQRCode(qr);
    } catch (e) {}
  });

  client.on('authenticated', () => {
    statusConexao = 'autenticado';
    qrCodeData = null;
    console.log('✅ WhatsApp autenticado!');
  });

  client.on('ready', () => {
    statusConexao = 'conectado';
    qrCodeData = null;
    console.log('🚀 WhatsApp Bot está online!');

    try {
      const { notificarStatusWhatsApp, setWhatsAppClient } = require('./painel');
      notificarStatusWhatsApp('conectado');
      setWhatsAppClient(client);
    } catch (e) {}
  });

  client.on('auth_failure', (msg) => {
    statusConexao = 'erro';
    console.error('❌ Falha na autenticação:', msg);
  });

  client.on('disconnected', (reason) => {
    statusConexao = 'desconectado';
    qrCodeData = null;
    console.log('📴 WhatsApp desconectado:', reason);

    try {
      const { notificarStatusWhatsApp, setWhatsAppClient } = require('./painel');
      notificarStatusWhatsApp('desconectado');
      setWhatsAppClient(null);
    } catch (e) {}
  });

  client.on('message', async (msg) => {
    if (msg.from.includes('@g.us')) return;
    if (msg.fromMe) return;

    const telefone = await normalizarTelefone(msg.from, client);
    const texto = msg.body.trim();

    console.log(`📩 [${telefone}] "${texto}"`);

    try {
      if (msg.selectedButtonId) {
        const botao = processarBotao(msg.selectedButtonId);
        console.log(`🔘 Botão: ${msg.selectedButtonId}`);

        if (botao.acao !== 'invalido') {
          const resposta = await processMessage(telefone, botao.acao, msg.from);
          if (resposta) await enviarResposta(msg, resposta);
          return;
        }
      }

      const resposta = await processMessage(telefone, texto, msg.from);

      if (!resposta) return;
      await enviarResposta(msg, resposta);

    } catch (erro) {
      console.error(`❌ Erro [${telefone}]:`, erro.message);
      await msg.reply('⚠️ Ops! Algo deu errado. Envie *"oi"* para recomeçar.');
    }
  });
}

async function enviarResposta(msg, resposta) {
  if (Array.isArray(resposta)) {
    for (const item of resposta) {
      await enviarItem(msg, item);
      await new Promise(r => setTimeout(r, 800));
    }
    return;
  }
  await enviarItem(msg, resposta);
}

async function enviarItem(msg, item) {
  if (item && item.botoes && Array.isArray(item.botoes)) {
    const buttons = item.botoes.map(b => ({
      buttonId: b.id,
      buttonText: { displayText: b.texto }
    }));
    await msg.reply(item.texto, null, { buttons });
    return;
  }
  await msg.reply(item);
}

function conectarWhatsApp() {
  if (statusConexao === 'conectado' || statusConexao === 'autenticado') {
    return { ok: false, erro: 'WhatsApp já está conectado' };
  }

  if (statusConexao === 'iniciando') {
    return { ok: true, status: 'iniciando', mensagem: 'Conexão já está em andamento' };
  }

  if (client && statusConexao === 'desconectado') {
    console.log('📱 Reconectando com sessão existente...');
    statusConexao = 'iniciando';
    client.initialize().then(() => {
      console.log('✅ Cliente WhatsApp reconectado com sessão salva');
    }).catch(err => {
      console.log('🔄 Sessão expirada, criando nova conexão...');
      statusConexao = 'desconectado';
      client = null;
      conectarWhatsApp();
    });
    return { ok: true, status: statusConexao };
  }

  statusConexao = 'iniciando';
  console.log('📱 Iniciando conexão com WhatsApp...');

  criarClienteWhatsApp();
  client.initialize().then(() => {
    console.log('✅ Cliente WhatsApp inicializado');
  }).catch(err => {
    if (err.message.includes('EBUSY') || err.message.includes('locked')) {
      console.log('🔄 Sessão anterior travada, tentando novamente...');
      statusConexao = 'desconectado';
      client = null;
      setTimeout(() => conectarWhatsApp(), 2000);
    } else {
      statusConexao = 'erro';
      console.error('❌ Erro ao inicializar WhatsApp:', err.message);
    }
  });

  return { ok: true, status: statusConexao };
}

function desconectarWhatsApp() {
  if (!client) {
    statusConexao = 'desconectado';
    return { ok: true };
  }

  client.destroy().then(() => {
    client = null;
    statusConexao = 'desconectado';
    qrCodeData = null;
    console.log('📴 WhatsApp desconectado pelo painel');
  }).catch(err => {
    console.error('Erro ao desconectar:', err.message);
    client = null;
    statusConexao = 'desconectado';
    qrCodeData = null;
  });

  return { ok: true };
}

function getStatusWhatsApp() {
  return {
    status: statusConexao,
    qrCode: qrCodeData,
    conectado: statusConexao === 'conectado'
  };
}

function getClient() {
  return client;
}

module.exports = {
  conectarWhatsApp,
  desconectarWhatsApp,
  getStatusWhatsApp,
  getClient
};