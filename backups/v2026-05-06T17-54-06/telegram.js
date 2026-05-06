/**
 * telegram.js — Notificações para a cozinha via Telegram
 *
 * Quando um pedido é confirmado, envia mensagem automática
 * para um grupo/chat do Telegram da cozinha.
 *
 * CONFIGURAÇÃO (adicione ao .env):
 *   TELEGRAM_TOKEN   = token do seu bot (obtido no @BotFather)
 *   TELEGRAM_CHAT_ID = ID do chat/grupo da cozinha
 *
 * COMO CRIAR SEU BOT TELEGRAM:
 *   1. No Telegram, procure @BotFather
 *   2. Envie /newbot e siga as instruções
 *   3. Copie o token gerado para o .env
 *   4. Adicione o bot ao grupo da cozinha
 *   5. Envie uma msg no grupo e akses:
 *      https://api.telegram.org/bot<TOKEN>/getUpdates
 *      para pegar o chat_id do grupo
 */

const axios = require('axios');

/**
 * Envia uma mensagem para o Telegram
 * @param {string} mensagem — Texto (suporta Markdown)
 * @returns {boolean} — true se enviou com sucesso
 */
async function enviarMensagem(mensagem) {
  const TELEGRAM_TOKEN   = process.env.TELEGRAM_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('⚠️  Telegram não configurado — pulando notificação.');
    console.log('   Configure TELEGRAM_TOKEN e TELEGRAM_CHAT_ID no .env');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id:    TELEGRAM_CHAT_ID,
      text:       mensagem,
      parse_mode: 'Markdown'
    });

    console.log('📲 Notificação Telegram enviada com sucesso!');
    return true;

  } catch (erro) {
    // Não quebra o fluxo principal se o Telegram falhar
    const msg = erro.response?.data?.description || erro.message;
    console.error('❌ Erro ao enviar Telegram:', msg);
    return false;
  }
}

/**
 * Notifica a cozinha sobre um novo pedido confirmado
 * @param {object} pedido
 */
async function notificarNovoPedido(pedido) {
  const agora = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit'
  });

  // Formata os itens do pedido
  const itensTexto = pedido.itens
    .map(item => `  • ${item.quantidade}x ${item.nome} — R$${(item.preco * item.quantidade).toFixed(2)}`)
    .join('\n');

  // Limpa o número de telefone para exibição
  const telefoneExibir = pedido.telefone
    .replace('@c.us', '')
    .replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');

  const mensagem =
    `🍔 *NOVO PEDIDO!* 🍔\n` +
    `⏰ ${agora}\n` +
    `─────────────────\n` +
    `📋 *Pedido #${pedido.id.substring(0, 8).toUpperCase()}*\n` +
    `📱 Cliente: ${telefoneExibir}\n\n` +
    `*ITENS:*\n${itensTexto}\n\n` +
    `─────────────────\n` +
    `💰 *TOTAL: R$${pedido.total.toFixed(2)}*\n` +
    `─────────────────\n` +
    `Status: 🟡 *Aguardando preparo*`;

  return enviarMensagem(mensagem);
}

/**
 * Notifica mudança de status de um pedido PARA A COZINHA (Telegram)
 * @param {object} pedido
 * @param {string} novoStatus
 */
async function notificarStatusPedido(pedido, novoStatus) {
  const emojis = {
    em_preparo:    '🔥 *EM PREPARO*',
    saiu_entrega:  '🛵 *SAIU PARA ENTREGA*',
    entregue:      '✅ *ENTREGUE*',
    cancelado:     '❌ *CANCELADO*'
  };

  const statusTexto = emojis[novoStatus] || `📌 ${novoStatus.toUpperCase()}`;

  const mensagem =
    `📦 *Atualização de Pedido*\n\n` +
    `Pedido *#${pedido.id.substring(0, 8).toUpperCase()}*\n` +
    `Novo status: ${statusTexto}`;

  return enviarMensagem(mensagem);
}

/**
 * Notifica mudança de status PARA O CLIENTE (WhatsApp)
 * @param {object} client — WhatsApp client
 * @param {string} telefone — Número do cliente
 * @param {object} pedido — Dados do pedido
 * @param {string} status — Novo status
 */
async function notificarClienteStatus(client, telefone, pedido, status) {
  try {
    const mensagens = {
      em_preparo: 
        `🔥 *Seu pedido está em preparo!*\n\n` +
        `Pedido #${pedido.id.substring(0, 8).toUpperCase()}\n` +
        `⏱️ Tempo estimado: 20-30 minutos\n\n` +
        `Avisaremos quando sair para entrega! 🛵`,
      
      saiu_entrega: 
        `🛵 *Seu pedido saiu para entrega!*\n\n` +
        `Pedido #${pedido.id.substring(0, 8).toUpperCase()}\n` +
        `💰 Total: R$${pedido.total.toFixed(2)}\n\n` +
        `⏱️ Chegará em breve! Fique atento! 👀`,
      
      entregue: 
        `✅ *Seu pedido foi entregue!*\n\n` +
        `Pedido #${pedido.id.substring(0, 8).toUpperCase()}\n` +
        `💵 Total: R$${pedido.total.toFixed(2)}\n\n` +
        `Obrigado pela preferência! 🍔\n` +
        `Volte sempre! 😊`,
      
      cancelado: 
        `❌ *Seu pedido foi cancelado*\n\n` +
        `Pedido #${pedido.id.substring(0, 8).toUpperCase()}\n\n` +
        `Se tiver dúvidas, entre em contato conosco! 📞`
    };

    const mensagem = mensagens[status];
    if (!mensagem) return false;

    // Envia via WhatsApp Web
    if (client && client.sendMessage) {
      await client.sendMessage(telefone, mensagem);
      console.log(`📱 Notificação enviada ao cliente | ${telefone} | Status: ${status}`);
      return true;
    }
    
    return false;
  } catch (erro) {
    console.error('❌ Erro ao notificar cliente:', erro.message);
    return false;
  }
}

/**
 * Envia um resumo diário dos pedidos
 * @param {object} stats — objeto de estatísticas
 */
async function enviarResumoDiario(stats) {
  const hoje = new Date().toLocaleDateString('pt-BR');

  const mensagem =
    `📊 *RESUMO DO DIA — ${hoje}*\n\n` +
    `📦 Pedidos hoje: *${stats.pedidosHoje}*\n` +
    `💰 Faturamento hoje: *R$${stats.faturamentoHoje}*\n` +
    `📈 Total geral: ${stats.totalPedidos} pedidos\n` +
    `🎯 Ticket médio: R$${stats.ticketMedio}`;

  return enviarMensagem(mensagem);
}

module.exports = {
  notificarNovoPedido,
  notificarStatusPedido,
  notificarClienteStatus,
  enviarResumoDiario,
  enviarMensagem
};
