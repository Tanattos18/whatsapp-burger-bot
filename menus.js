/**
 * menus.js — Menus clicáveis do WhatsApp
 *
 * Estrutura leve e organizada para menus interativos
 * Usa Buttons do WhatsApp Web
 */

const { getCardapioTexto } = require('./cardapio');

/**
 * Cria uma mensagem com botões clicáveis
 * @param {string} titulo - Título da mensagem
 * @param {string} texto - Texto da mensagem
 * @param {Array} botoes - Array de botões [{id, texto}]
 * @returns {object} - Objeto para enviar como buttonsMessage
 */
function criarMenuBotoes(titulo, texto, botoes) {
  return {
    titulo,
    texto,
    botoes
  };
}

/**
 * Menu inicial (Boas-vindas)
 */
function menuBoasVindas() {
  return (
    '👋 *OLÁ! BEM-VINDO AO ZÉ DELIVERY!* 🍔\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    '📋 *Ver Cardápio* → Digite *1*\n' +
    '🛒 *Fazer Pedido* → Digite *2*\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━\n' +
    '_Você digita o número da opção_'
  );
}

/**
 * Menu de confirmação do pedido
 */
function menuConfirmarPedido(pedido) {
  let texto = '🛒 *RESUMO DO PEDIDO*\n\n';
  texto += '━━━━━━━━━━━━━━━━━━━━━━\n\n';

  pedido.itens.forEach((item, idx) => {
    const subtotal = item.preco * item.quantidade;
    texto += `${idx+1}. ${item.quantidade}x ${item.nome} — R$${subtotal.toFixed(2)}\n`;
  });

  texto += '\n━━━━━━━━━━━━━━━━━━━━━━\n';
  texto += `💰 TOTAL: R$${pedido.total.toFixed(2)}\n`;
  texto += '━━━━━━━━━━━━━━━━━━━━━━';

  return criarMenuBotoes(
    '✅ CONFIRMAR PEDIDO',
    texto,
    [
      { id: 'conf_sim', texto: '✅ Confirmar Pedido' },
      { id: 'conf_adicionar', texto: '➕ Adicionar Mais' },
      { id: 'conf_cancelar', texto: '❌ Cancelar' }
    ]
  );
}

/**
 * Menu de confirmar itens múltiplos
 */
function menuConfirmarItens(itens) {
  let texto = '❓ *Adicionar estes itens?*\n\n';
  itens.forEach((item, idx) => {
    texto += `${idx+1}. ${item.nome} — R$${item.preco.toFixed(2)}\n`;
  });

  return criarMenuBotoes(
    '✅ CONFIRMAR ITENS',
    texto,
    [
      { id: 'itens_sim', texto: '✅ Sim, adicionar' },
      { id: 'itens_nao', texto: '❌ Não, cancelar' }
    ]
  );
}

/**
 * Menu carrinho (opções durante pedido)
 */
function menuCarrinho(pedido) {
  let texto = '🛒 *SEU CARRINHO*\n\n';
  texto += '━━━━━━━━━━━━━━━━━━━━━━\n\n';

  pedido.itens.forEach((item, idx) => {
    const subtotal = item.preco * item.quantidade;
    texto += `${idx+1}. ${item.quantidade}x ${item.nome}\n`;
    texto += `   R$${subtotal.toFixed(2)}\n\n`;
  });

  texto += '━━━━━━━━━━━━━━━━━━━━━━\n';
  texto += `💰 TOTAL: R$${pedido.total.toFixed(2)}\n`;
  texto += '━━━━━━━━━━━━━━━━━━━━━━';

  return criarMenuBotoes(
    '🛒 CARRINHO',
    texto,
    [
      { id: 'carrinho_finalizar', texto: '✅ Finalizar Pedido' },
      { id: 'carrinho_mais', texto: '➕ Adicionar Mais' },
      { id: 'carrinho_cardapio', texto: '📋 Ver Cardápio' }
    ]
  );
}

/**
 * Converte ID do botão em ação
 * @param {string} buttonId
 * @returns {object} { acao: string, tipo: string }
 */
function processarBotao(buttonId) {
  const mapa = {
    // Menu inicial
    'menu_cardapio': { acao: 'cardapio', tipo: 'menu' },
    'menu_pedido': { acao: 'fazer_pedido', tipo: 'menu' },

    // Confirmação de itens - mapeia para ações esperadas pelo flow.js
    'itens_sim': { acao: 'sim', tipo: 'conf_itens' },
    'itens_nao': { acao: 'nao', tipo: 'conf_itens' },

    // Confirmação do pedido - mapeia para ações esperadas pelo flow.js
    'conf_sim': { acao: 'sim', tipo: 'conf_pedido' },
    'conf_adicionar': { acao: 'nao', tipo: 'conf_pedido' },
    'conf_cancelar': { acao: 'cancelar', tipo: 'geral' },

    // Carrinho
    'carrinho_finalizar': { acao: 'finalizar', tipo: 'pedido' },
    'carrinho_mais': { acao: 'adicionar_mais', tipo: 'pedido' },
    'carrinho_cardapio': { acao: 'ver_cardapio', tipo: 'pedido' }
  };

  return mapa[buttonId] || { acao: 'invalido', tipo: 'invalido' };
}

module.exports = {
  criarMenuBotoes,
  menuBoasVindas,
  menuConfirmarPedido,
  menuConfirmarItens,
  menuCarrinho,
  processarBotao
};