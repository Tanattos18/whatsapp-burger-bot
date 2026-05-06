/**
 * cardapio.js — Definição do cardápio da hamburgueria
 * Edite aqui para adicionar/remover/alterar produtos
 */

const CARDAPIO = [
  {
    id: 1,
    nome: 'X-Burguer',
    descricao: 'Pão, hambúrguer 150g, queijo, alface e tomate',
    preco: 20.00
  },
  {
    id: 2,
    nome: 'X-Bacon',
    descricao: 'Pão, hambúrguer 150g, bacon crocante, queijo e molho especial',
    preco: 25.00
  },
  {
    id: 3,
    nome: 'X-Tudo',
    descricao: 'Pão, hambúrguer 200g, bacon, ovo, queijo, alface, tomate e cebola',
    preco: 32.00
  },
  {
    id: 4,
    nome: 'X-Frango',
    descricao: 'Pão, frango grelhado, queijo, alface e maionese',
    preco: 22.00
  },
  {
    id: 5,
    nome: 'Batata Frita P',
    descricao: 'Porção pequena de batata frita crocante',
    preco: 10.00
  },
  {
    id: 6,
    nome: 'Batata Frita G',
    descricao: 'Porção grande de batata frita crocante',
    preco: 16.00
  },
  {
    id: 7,
    nome: 'Refrigerante Lata',
    descricao: 'Coca-Cola, Guaraná ou Sprite (350ml)',
    preco: 6.00
  },
  {
    id: 8,
    nome: 'Suco Natural',
    descricao: 'Laranja, limão ou maracujá (300ml)',
    preco: 8.00
  }
];

/**
 * Retorna o texto formatado do cardápio para enviar via WhatsApp
 */
function getCardapioTexto() {
  let texto = '🍔 *CARDÁPIO ZÉ DELIVERY* 🍔\n';
  texto += '━━━━━━━━━━━━━━━━━━━━━━\n\n';

  texto += '🍔 *HAMBÚRGUERES*\n';
  CARDAPIO.filter(i => i.id <= 4).forEach(item => {
    texto += `┣ *${item.id}* — ${item.nome}\n`;
    texto += `  💵 R$${item.preco.toFixed(2)}\n`;
    texto += `  _${item.descricao}_\n\n`;
  });

  texto += '🍟 *ACOMPANHAMENTOS*\n';
  CARDAPIO.filter(i => i.id === 5 || i.id === 6).forEach(item => {
    texto += `┣ *${item.id}* — ${item.nome}\n`;
    texto += `  💵 R$${item.preco.toFixed(2)}\n`;
    texto += `  _${item.descricao}_\n\n`;
  });

  texto += '🥤 *BEBIDAS*\n';
  CARDAPIO.filter(i => i.id >= 7).forEach(item => {
    texto += `┣ *${item.id}* — ${item.nome}\n`;
    texto += `  💵 R$${item.preco.toFixed(2)}\n`;
    texto += `  _${item.descricao}_\n\n`;
  });

  texto += '━━━━━━━━━━━━━━━━━━━━━━\n';
  texto += '📝 *Exemplos de entrada:*\n';
  texto += '• *1* - Um item (pede qtd)\n';
  texto += '• *1 2* - Dois itens (qtd 1)\n';
  texto += '• *1,3* - Com vírgula funciona\n';
  texto += '✅ *0* para finalizar\n';
  texto += '❌ *cancelar* para sair';

  return texto;
}

/**
 * Busca um item do cardápio pelo ID
 * @param {number} id
 * @returns {object|null}
 */
function getItemById(id) {
  return CARDAPIO.find(item => item.id === id) || null;
}

module.exports = { CARDAPIO, getCardapioTexto, getItemById };
