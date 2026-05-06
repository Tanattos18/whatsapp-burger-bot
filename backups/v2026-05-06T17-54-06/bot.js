/**
 * bot.js — Conexão com WhatsApp (v2)
 *
 * Suporta:
 * - Respostas múltiplas (array de mensagens)
 * - Menus clicáveis (botões)
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode                               = require('qrcode-terminal');
const { processMessage }                  = require('./flow');
const { menuBoasVindas, menuConfirmarPedido,
        menuConfirmarItens, menuCarrinho,
        processarBotao }                   = require('./menus');

/**
 * Normaliza o telefone para formato padrão
 * Tenta obter número real do contato WhatsApp
 */
async function normalizarTelefone(from, client) {
  // Remove sufixos conhecidos
  let telefone = from.replace('@c.us', '').replace('@s.whatsapp.net', '').replace('@lid', '');
  
  // Tenta obter número real do contato
  try {
    const contato = await client.getContactById(from);
    if (contato && contato.number) {
      telefone = contato.number.replace(/\D/g, '');
    }
  } catch (e) {
    // Fallback: usa o ID direto
  }
  
  // Se já tem código do país (55 para Brasil)
  if (telefone.startsWith('55')) {
    return '+' + telefone;
  }
  
  // Adiciona código do Brasil se não tiver
  return '+55' + telefone;
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', (qr) => {
  console.log('📲 Escaneie o QR Code com seu WhatsApp:\n');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  console.log('✅ WhatsApp autenticado!');
});

client.on('ready', () => {
  console.log('🚀 Bot está online!\n');
  
  // Vincula o cliente ao painel para notificações
  try {
    const { setWhatsAppClient } = require('./painel');
    setWhatsAppClient(client);
  } catch (e) {
    console.log('⚠️  Painel não vinculado ao bot (isso é ok)');
  }
});

client.on('message', async (msg) => {
  if (msg.from.includes('@g.us')) return; // Ignora grupos
  if (msg.fromMe) return;                  // Ignora mensagens próprias

  const telefone = await normalizarTelefone(msg.from, client);
  const texto    = msg.body.trim();

  console.log(`📩 [${telefone}] "${texto}"`);

  try {
    // Verifica se é um clique em botão
    if (msg.selectedButtonId) {
      const botao = processarBotao(msg.selectedButtonId);
      console.log(`🔘 Botão clicado: ${msg.selectedButtonId}`);

      if (botao.acao !== 'invalido') {
        const resposta = await processMessage(telefone, botao.acao);
        if (resposta) await enviarResposta(msg, resposta);
        return;
      }
    }

    const resposta = await processMessage(telefone, texto);

    if (!resposta) return;

    await enviarResposta(msg, resposta);

  } catch (erro) {
    console.error(`❌ Erro [${telefone}]:`, erro.message);
    await msg.reply('⚠️ Ops! Algo deu errado. Envie *"oi"* para recomeçar.');
  }
});

/**
 * Envia resposta (string, array ou objeto de menu)
 */
async function enviarResposta(msg, resposta) {
  // Array de respostas
  if (Array.isArray(resposta)) {
    for (const item of resposta) {
      await enviarItem(msg, item);
      await new Promise(r => setTimeout(r, 800));
    }
    return;
  }

  // Resposta única
  await enviarItem(msg, resposta);
}

async function enviarItem(msg, item) {
  // Objeto de menu com botões
  if (item && item.botoes && Array.isArray(item.botoes)) {
    const buttons = item.botoes.map(b => ({
      buttonId: b.id,
      buttonText: { displayText: b.texto }
    }));

    await msg.reply(item.texto, null, {
      buttons
    });
    return;
  }

  // String normal
  await msg.reply(item);
}

client.on('auth_failure', (msg) => {
  console.error('❌ Falha na autenticação:', msg);
});

client.on('disconnected', (reason) => {
  console.log('📴 Desconectado:', reason);
});

function startBot() {
  client.initialize();
}

module.exports = { startBot, client };
