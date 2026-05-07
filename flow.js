/**
 * flow.js — Fluxo de conversa do bot (v2 — com Pix e Telegram)
 *
 * Estágios da conversa:
 *   INICIO       → Usuário acabou de entrar
 *   MENU         → Escolheu ver cardápio ou fazer pedido
 *   PEDIDO       → Está selecionando itens do cardápio
 *   QUANTIDADE   → Escolheu um item, aguarda quantidade
 *   CONFIRMAR    → Revisar pedido antes de confirmar
 *   AGUARDANDO_PIX → Pedido confirmado, aguardando pagamento Pix
 */

const { getCardapioTexto, getItemById }              = require('./cardapio');
const { criarPedido, adicionarItem, confirmarPedido,
        getPedidoAtivo, cancelarPedido }             = require('./orders');
const { gerarQRCodePix, mensagemPix }                = require('./pix');
const { notificarNovoPedido }                        = require('./telegram');
const { getCliente, salvarCliente }                  = require('./clientes');
const { menuBoasVindas, menuConfirmarPedido,
        menuConfirmarItens, menuCarrinho }           = require('./menus');

// ─── Estado em memória de cada usuário ───────────────
const estadosUsuarios = {};

// ─── Horário de funcionamento ───────────────────────
// Timeout para pagamento Pix (30 minutos)
const TIMEOUT_PIX = 30 * 60 * 1000;

function verificarHorario() {
  const inicio = process.env.HORARIO_INICIO;
  const fim = process.env.HORARIO_FIM;
  const diasAbertos = (process.env.DIAS_ABERTOS || '1,2,3,4,5,6,7').split(',').map(Number);

  if (!inicio || !fim) return { aberto: true };

  const agora = new Date();
  const diaSemana = agora.getDay() + 1; // 1=domingo, 7=sábado

  if (!diasAbertos.includes(diaSemana)) {
    return { aberto: false, inicio, fim, motivo: 'dia' };
  }

  const horaAtual = agora.getHours() * 60 + agora.getMinutes();

  const [hInicio, mInicio] = inicio.split(':').map(Number);
  const [hFim, mFim] = fim.split(':').map(Number);

  const minutoInicio = hInicio * 60 + mInicio;
  const minutoFim = hFim * 60 + mFim;

  if (horaAtual < minutoInicio || horaAtual >= minutoFim) {
    return { aberto: false, inicio, fim, motivo: 'horario' };
  }

  return { aberto: true, inicio, fim };
}

function mensagemFechado(inicio, fim, motivo) {
  if (motivo === 'dia') {
    return (
      '😔 *Estamos fechados hoje!* 🎁\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '📅 *Dias de funcionamento:*\n' +
      processaDiasAbertos() +
      '\n━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '⏰ Nosso horário padrão:\n' +
      `   *${inicio} às ${fim}*\n\n` +
      'Volte outro dia para pedir!\n' +
      '_Obrigado pela compreensão!_ 🍔'
    );
  }

  return (
    '😔 *Estamos fechados no momento!* 😔\n\n' +
    `⏰ Nosso horário de funcionamento:\n` +
    `   *${inicio} às ${fim}*\n\n` +
    'Volte nesse horário para fazer seu pedido!\n' +
    '_ Obrigado pela compreensão!_ 🍔'
  );
}

function processaDiasAbertos() {
  const dias = ['', 'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const diasAbertos = (process.env.DIAS_ABERTOS || '1,2,3,4,5,6,7').split(',').map(Number);
  return diasAbertos.map(d => dias[d]).join(', ');
}

// Palavras que reiniciam a conversa
const PALAVRAS_INICIO = [
  'oi','olá','ola','oi!','olá!','bom dia','boa tarde','boa noite',
  'menu','cardápio','cardapio','inicio','início','começo','start'
];

function isBotOnline() {
  try {
    const { getStatusWhatsApp } = require('./bot');
    const status = getStatusWhatsApp();
    return status.status === 'conectado';
  } catch (e) {
    return false;
  }
}

function getEstado(telefone) {
  if (!estadosUsuarios[telefone]) {
    estadosUsuarios[telefone] = { estagio: 'INICIO', itemSelecionado: null };
  }
  return estadosUsuarios[telefone];
}

function setEstado(telefone, novoEstado) {
  estadosUsuarios[telefone] = { ...getEstado(telefone), ...novoEstado, ultimoAcesso: Date.now() };
}

function resetarEstado(telefone) {
  delete estadosUsuarios[telefone];
}

// ═══════════════════════════════════════════════════════
// HANDLERS DE CADASTRO
// ═══════════════════════════════════════════════════════

function handleInicio(telefone) {
  const cliente = getCliente(telefone);
  if (!cliente) {
    setEstado(telefone, { estagio: 'CADASTRO_NOME' });
    return (
      '👋 *OLÁ! BEM-VINDO AO ZÉ DELIVERY!* 🍔\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      'Para fazer seu primeiro pedido,\nprecisamos do seu cadastro.\n\n' +
      '📝 *Qual é o seu nome completo?*'
    );
  }
  setEstado(telefone, { estagio: 'MENU', nomeCliente: cliente.nome });
  return (
    `👋 *OLÁ, ${cliente.nome.split(' ')[0]}!* 🍔\n\n` +
    '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    '📋 *Ver Cardápio* → Digite *1*\n' +
    '🛒 *Fazer Pedido* → Digite *2*\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━\n' +
    '_Ou clique nos botões acima_'
  );
}

function handleCadastroNome(telefone, texto) {
  const nome = texto.trim();
  if (nome.length < 3) {
    return '😅 Nome muito curto.\n\nPor favor, digite seu nome completo:';
  }
  if (nome.length > 50) {
    return '😅 Nome muito longo.\n\nPor favor, digite apenas o primeiro nome:';
  }

  setEstado(telefone, { estagio: 'CADASTRO_ENDERECO', nomeTemp: nome });

  return (
    `✅ *Olá, ${nome.split(' ')[0]}!* 🎉\n\n` +
    'Agora precisamos do seu endereço de entrega.\n\n' +
    '📍 *Qual é o seu endereço?*\n' +
    '(Rua, número, complemento)'
  );
}

function handleCadastroEndereco(telefone, texto) {
  const estado = getEstado(telefone);
  const nome = estado.nomeTemp;
  const endereco = texto.trim();

  if (endereco.length < 10) {
    return '😅 Endereço muito curto.\n\nPor favor, digite seu endereço completo:\n(Rua, número, bairro)';
  }

  salvarCliente({
    telefone,
    nome,
    endereco
  });

  resetarEstado(telefone);
  setEstado(telefone, { estagio: 'MENU', nomeCliente: nome });

  return (
    `✅ *Cadastro salvo!* 🎉\n\n` +
    `📝 *Nome:* ${nome}\n` +
    `📍 *Endereço:* ${endereco}\n\n` +
    '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    'Agora pode fazer seu pedido!\n\n' +
    '📋 *Ver Cardápio* → Digite *1*\n' +
    '🛒 *Fazer Pedido* → Digite *2*'
  );
}

// Cleanup de estados antigos (mais de 24h)
function cleanupEstadosAntigos() {
  const agora = Date.now();
  const LIMITE = 24 * 60 * 60 * 1000; // 24h

  for (const telefone of Object.keys(estadosUsuarios)) {
    const estado = estadosUsuarios[telefone];
    const ultimoAcesso = estado.ultimoAcesso || agora;
    if (agora - ultimoAcesso > LIMITE) {
      delete estadosUsuarios[telefone];
    }
  }
}

// Executa cleanup a cada hora
setInterval(cleanupEstadosAntigos, 60 * 60 * 1000);

// ─── Processamento principal ─────────────────────────

/**
 * Processa uma mensagem e retorna a(s) resposta(s) do bot
 * Pode retornar array de mensagens para envios sequenciais
 * @param {string} telefone - Número do telefone normalizado
 * @param {string} texto - Mensagem do usuário
 * @param {string} chatId - ID do chat do WhatsApp (para notificações)
 * @returns {string | string[]}
 */
async function processMessage(telefone, texto, chatId = null) {
  const textoLower = texto.toLowerCase().trim();
  const estado = getEstado(telefone);

  // Cancelar em qualquer momento
  if (textoLower === 'cancelar') {
    cancelarPedido(telefone);
    resetarEstado(telefone);
    return '❌ *Pedido cancelado.*\n\nEnvie *oi* para começar de novo! 😊';
  }

  // Palavras de boas-vindas reiniciam a conversa
  if (PALAVRAS_INICIO.includes(textoLower)) {
    if (!isBotOnline()) {
      return (
        '🔌 *WhatsApp desconectado*\n\n' +
        'O bot está temporariamente fora do ar.\n' +
        'Aguarde até que o administrador conecte novamente.\n\n' +
        '📱 Problemas? Entre em contato diretamente.\n' +
        '_Pedimos desculpas pelo transtorno._ 😊'
      );
    }

    const { aberto, inicio, fim, motivo } = verificarHorario();
    if (!aberto) {
      return mensagemFechado(inicio, fim, motivo);
    }

    // Verifica se cliente já existe
    const cliente = getCliente(telefone);
    if (!cliente) {
      // Primeiro acesso - pede cadastro
      resetarEstado(telefone);
      setEstado(telefone, { estagio: 'CADASTRO_NOME' });
      return (
        '👋 *OLÁ! BEM-VINDO AO ZÉ DELIVERY!* 🍔\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        'Para fazer seu primeiro pedido,\nprecisamos do seu cadastro.\n\n' +
        '📝 *Qual é o seu nome completo?*'
      );
    }

    // Cliente existente - mostra menu com nome
    resetarEstado(telefone, { estagio: 'MENU', nomeCliente: cliente.nome });
    return (
      `👋 *OLÁ, ${cliente.nome.split(' ')[0]}!* 🍔\n\n` +
      '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '📋 *Ver Cardápio* → Digite *1*\n' +
      '🛒 *Fazer Pedido* → Digite *2*\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━\n' +
      '_Ou clique nos botões acima_'
    );
  }

  switch (estado.estagio) {
    case 'INICIO':
      return handleInicio(telefone);

    case 'CADASTRO_NOME':
      return handleCadastroNome(telefone, texto);

    case 'CADASTRO_ENDERECO':
      return handleCadastroEndereco(telefone, texto);

    case 'MENU':
      return handleMenu(telefone, textoLower, chatId);

    case 'PEDIDO':
      return handlePedido(telefone, texto, textoLower);

    case 'QUANTIDADE':
      return handleQuantidade(telefone, texto);

    case 'CONFIRMAR_ITENS':
      return handleConfirmarItens(telefone, textoLower);

    case 'CONFIRMAR':
      return await handleConfirmar(telefone, textoLower);

    case 'AGUARDANDO_PIX':
      return handleAguardandoPix(telefone, textoLower);

    default:
      resetarEstado(telefone);
      return mensagemBoasVindas();
  }
}

// ═══════════════════════════════════════════════════════
// MENSAGENS AUXILIARES
// ═══════════════════════════════════════════════════════

function mensagemBoasVindas() {
  return menuBoasVindas();
}

// ═══════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════

function handleMenu(telefone, textoLower, chatId = null) {
  if (textoLower === 'cardapio' || textoLower === 'menu_cardapio') {
    return '📋 *CARDÁPIO* 🍔\n\n' + getCardapioTexto() +
      '\n\n━━━━━━━━━━━━━━━━━━━━━━\n' +
      '🛒 Quer fazer um pedido? Digite *2* para começar';
  }

  if (textoLower === 'fazer_pedido' || textoLower === 'menu_pedido' || textoLower === '2' || textoLower === 'fazer pedido' || textoLower === 'pedido') {
    const { aberto, inicio, fim, motivo } = verificarHorario();
    if (!aberto) {
      return mensagemFechado(inicio, fim, motivo);
    }
    criarPedido(telefone, chatId);
    setEstado(telefone, { estagio: 'PEDIDO' });
    return '📖 *COMO FAZER SEU PEDIDO* 📖\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '1️⃣ *Veja o cardápio* → Digite *cardápio*\n\n' +
      '2️⃣ *Escolha o item* → Digite o número\n' +
      '   Ex: *2* para X-Bacon\n\n' +
      '3️⃣ *Defina a quantidade* → Digite 1, 2, 3...\n\n' +
      '4️⃣ *Repita* para mais itens\n\n' +
      '5️⃣ *Finalize* → Digite *0*\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━\n' +
      '❌ A qualquer momento digite *cancelar*\n' +
      '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '📋 *Cardápio:*\n\n' + getCardapioTexto();
  }

  if (textoLower === '1') {
    return handleMenu(telefone, 'cardapio', chatId);
  }

  if (['2', 'fazer pedido', 'pedido'].includes(textoLower)) {
    return handleMenu(telefone, 'fazer_pedido', chatId);
  }

  return (
    '👋 *OLÁ! BEM-VINDO AO ZÉ DELIVERY!* 🍔\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    '📋 *Ver Cardápio* → Digite *1*\n' +
    '🛒 *Fazer Pedido* → Digite *2*\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━\n' +
    '_Ou clique nos botões acima_'
  );
}

function handlePedido(telefone, texto, textoLower) {
  if (textoLower === 'ver_cardapio' || textoLower === 'cardápio' || textoLower === 'cardapio' || textoLower === 'ver cardápio' || textoLower === 'menu') {
    return '📋 *CARDÁPIO* 🍔\n\n' + getCardapioTexto();
  }

  if (textoLower === 'ver carrinho' || textoLower === 'carrinho' || textoLower === 'meu pedido' || textoLower === 'ver pedido') {
    const pedido = getPedidoAtivo(telefone);
    if (!pedido || pedido.itens.length === 0) {
      return '🛒 Seu carrinho está *vazio*!\n\nDigite os números dos itens que deseja pedir.';
    }
    return menuCarrinho(pedido);
  }

  if (textoLower === 'adicionar_mais') {
    return getCardapioTexto() + '\n\n📝 Digite o número do item que deseja adicionar:';
  }

  if (textoLower === 'ajuda' || textoLower === 'help' || textoLower === '?') {
    const pedido = getPedidoAtivo(telefone);
    let resposta = '📖 *AJUDA* 📖\n\n';
    resposta += '━━━━━━━━━━━━━━━━━━━━━━\n';
    resposta += '1️⃣ *cardápio* → Ver os itens disponíveis\n';
    resposta += '2️⃣ *carrinho* → Ver seu pedido atual\n';
    resposta += '3️⃣ *número* → Adicionar/editar item (ex: *2*)\n';
    resposta += '4️⃣ *0* → Finalizar e confirmar pedido\n';
    resposta += '5️⃣ *cancelar* → Cancelar tudo e recomeçar\n';
    resposta += '━━━━━━━━━━━━━━━━━━━━━━\n';
    if (pedido && pedido.itens.length > 0) {
      resposta += `\n🛒 Carrinho atual: R$${pedido.total.toFixed(2)}`;
    }
    return resposta;
  }

  if (['0', 'finalizar', 'pronto', 'confirmar'].includes(textoLower)) {
    const pedido = getPedidoAtivo(telefone);
    if (!pedido || pedido.itens.length === 0) {
      return '🛒 Seu carrinho está *vazio*!\n\nDigite o número dos itens que deseja pedir.\nExemplo: *1* ou *2 5 7*';
    }
    setEstado(telefone, { estagio: 'CONFIRMAR' });
    return gerarResumoConfirmacao(pedido);
  }

  const inputs = texto.split(/[,\s]+/).map(s => s.trim()).filter(s => s && !isNaN(parseInt(s)));
  const numerosItens = inputs.map(s => parseInt(s)).filter(n => n > 0);

  // Limite máximo de itens por pedido
  const LIMITE_ITENS = 20;

  if (numerosItens.length === 0) {
    const pedido = getPedidoAtivo(telefone);
    let resposta = '😅 *Não entendi...*\n\n';
    resposta += '━━━━━━━━━━━━━━━━━━━━━━\n';
    resposta += '📝 *O que você pode fazer:*\n\n';
    resposta += '• Digite *número* do item (ex: *1*)\n';
    resposta += '• Digite *vários* separados por espaço (ex: *2 5 7*)\n';
    resposta += '• Digite *cardápio* para ver produtos\n';
    resposta += '• Digite *carrinho* para ver seu pedido\n';
    resposta += '• *0* para finalizar o pedido\n';
    resposta += '• *cancelar* para limpar tudo\n';
    resposta += '━━━━━━━━━━━━━━━━━━━━━━\n';
    if (pedido && pedido.itens.length > 0) {
      resposta += `\n🛒 Você tem ${pedido.itens.length} item(s) no carrinho (R$${pedido.total.toFixed(2)})`;
    }
    return resposta;
  }

  // Verifica limite de itens
  const pedidoAtual = getPedidoAtivo(telefone);
  const totalItens = pedidoAtual ? pedidoAtual.itens.length + numerosItens.length : numerosItens.length;
  if (totalItens > LIMITE_ITENS) {
    return `⚠️ *Limite máximo de ${LIMITE_ITENS} itens por pedido.*\n\nSeu carrinho tem ${pedidoAtual?.itens.length || 0} itens.`;
  }

  if (numerosItens.length === 1) {
    const numeroItem = numerosItens[0];
    const item = getItemById(numeroItem);
    if (!item) {
      return `❌ Item *${numeroItem}* não encontrado.\n\nEnvie *cardápio* para ver os itens disponíveis.`;
    }
    setEstado(telefone, { estagio: 'QUANTIDADE', itemSelecionado: item });
    return (
      `✅ *${item.nome}*\n` +
      `💵 R$${item.preco.toFixed(2)}\n\n` +
      '━━━━━━━━━━━━━━━━━━━━━━\n' +
      '❓ *Quantos?*\n\n' +
      '⚡ *Responda rápido:*\n' +
      '• *1* • *2* • *3* • *4*\n' +
      '(ou outro número até 20)\n' +
      '━━━━━━━━━━━━━━━━━━━━━━'
    );
  }

  let itensValidos = [];
  let erros = [];

  for (const numeroItem of numerosItens) {
    const item = getItemById(numeroItem);
    if (!item) {
      erros.push(`Item ${numeroItem}`);
    } else {
      itensValidos.push(item);
    }
  }

  if (numerosItens.length > 1 && itensValidos.length > 0) {
    const listaItens = itensValidos.map(item => `• ${item.id} - ${item.nome} (R$${item.preco.toFixed(2)})`).join('\n');
    const totalTemp = itensValidos.reduce((acc, item) => acc + item.preco, 0);

    setEstado(telefone, {
      estagio: 'CONFIRMAR_ITENS',
      itensParaConfirmar: itensValidos
    });

    return (
      '❓ *Confirmar estes itens?*\n\n' +
      listaItens + '\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━\n' +
      `💰 Total: *R$${totalTemp.toFixed(2)}*\n\n` +
      '✅ *1* → Adicionar ao carrinho\n' +
      '❌ *2* → Cancelar\n' +
      '━━━━━━━━━━━━━━━━━━━━━━'
    );
  }

  if (itensValidos.length === 0) {
    return `❌ Itens não encontrados: ${erros.join(', ')}.\n\nEnvie *cardápio* para ver os itens disponíveis.`;
  }

  return '😅 *Não entendi...*\n\nDigite o número do item (ex: *1*) ou múltiplos separados por espaço (ex: *2 5 7*).\nDigite *cardápio* para ver os itens.';
}

function handleQuantidade(telefone, texto) {
  const estado = getEstado(telefone);
  const quantidade = parseInt(texto);

  if (isNaN(quantidade) || quantidade < 1 || quantidade > 20) {
    return '❓ Informe uma quantidade válida entre *1 e 20*.';
  }

  const item = estado.itemSelecionado;
  adicionarItem(telefone, item, quantidade);
  setEstado(telefone, { estagio: 'PEDIDO', itemSelecionado: null });

  const pedido = getPedidoAtivo(telefone);
  const subtotal = item.preco * quantidade;

  return (
    `✅ *${quantidade}x ${item.nome}*\n` +
    `💵 Subtotal: R$${subtotal.toFixed(2)}\n\n` +
    `🛒 *TOTAL: R$${pedido.total.toFixed(2)}*\n\n` +
    '*Seu carrinho:*\n' +
    pedido.itens.map((i, idx) => `${idx+1}. ${i.quantidade}x ${i.nome} • R$${(i.preco * i.quantidade).toFixed(2)}`).join('\n') + '\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━\n' +
    '📝 *Para alterar itens:*\n' +
    '   Digite o nº do item para mudar a quantidade\n' +
    '   Ex: *2* (para 2 unidades do item 2)\n\n' +
    '✅ *0* → Confirmar pedido\n' +
    '❌ *cancelar* → Cancelar tudo\n' +
    '━━━━━━━━━━━━━━━━━━━━━━'
  );
}

function handleConfirmarItens(telefone, textoLower) {
  const estado = getEstado(telefone);
  const itens = estado.itensParaConfirmar;

  if (!itens || itens.length === 0) {
    setEstado(telefone, { estagio: 'PEDIDO' });
    return '❌ Erro ao confirmar. Tente novamente.';
  }

  if (textoLower === 'conf_itens_sim' || ['sim', '1', 'confirmar', 's'].includes(textoLower)) {
    for (const item of itens) {
      adicionarItem(telefone, item, 1);
    }

    const pedido = getPedidoAtivo(telefone);
    setEstado(telefone, { estagio: 'PEDIDO', itensParaConfirmar: null });

    let resposta = '✅ *Itens adicionados!*\n';
    itens.forEach(item => {
      resposta += `\n• 1x ${item.nome}\n  R$${item.preco.toFixed(2)}`;
    });
    resposta += '\n\n';
    resposta += `🛒 *TOTAL: R$${pedido.total.toFixed(2)}*\n\n`;
    resposta += '*Seu carrinho:*\n';
    resposta += pedido.itens.map((i, idx) => `${idx+1}. ${i.quantidade}x ${i.nome} • R$${(i.preco * i.quantidade).toFixed(2)}`).join('\n') + '\n\n';
    resposta += '━━━━━━━━━━━━━━━━━━━━━━\n';
    resposta += '📝 *Para alterar itens:*\n';
    resposta += '   Digite o nº do item para mudar a quantidade\n';
    resposta += '   Ex: *2* (para 2 unidades do item 2)\n\n';
    resposta += '✅ *0* → Confirmar pedido\n';
    resposta += '❌ *cancelar* → Cancelar tudo\n';
    resposta += '━━━━━━━━━━━━━━━━━━━━━━';

    return resposta;
  }

  if (textoLower === 'conf_itens_nao' || ['não', 'nao', '2', 'n', 'cancelar'].includes(textoLower)) {
    setEstado(telefone, { estagio: 'PEDIDO', itensParaConfirmar: null });
    return '❌ Itens não adicionados.\n\nDigite os itens que deseja pedir:';
  }

  return menuConfirmarItens(itens);
}

async function handleConfirmar(telefone, textoLower) {
  const pedido = getPedidoAtivo(telefone);

  if (textoLower === 'conf_pedido_sim' || ['sim', '1', 'confirmar', 's'].includes(textoLower)) {
    const pedidoConfirmado = confirmarPedido(telefone);
    notificarNovoPedido(pedidoConfirmado).catch(() => {});

    const pixAtivo = process.env.PIX_CHAVE && process.env.PIX_CHAVE.trim() !== '';
    const mpAtivo = process.env.MERCADOPAGO_TOKEN && process.env.MERCADOPAGO_TOKEN.trim() !== '';
    const asaasAtivo = process.env.ASAAS_API_KEY && process.env.ASAAS_API_KEY.trim() !== '';

    if (pixAtivo || mpAtivo || asaasAtivo) {
      try {
        const dadosPix = await gerarQRCodePix(pedidoConfirmado);
        setEstado(telefone, {
          estagio: 'AGUARDANDO_PIX',
          pedidoConfirmado: pedidoConfirmado,
          pixModo: dadosPix.modo || 'estatico',
          pixExpiraEm: Date.now() + TIMEOUT_PIX
        });

        return [
          `🎉 *PEDIDO CONFIRMADO!* 🎉\n\n` +
          `📋 *Pedido #${pedidoConfirmado.id.substring(0,8).toUpperCase()}*\n` +
          `💰 Total: *R$${pedidoConfirmado.total.toFixed(2)}*\n\n` +
          `⏱️ Assim que confirmarmos o pagamento,\nseu pedido entra no preparo! 🍔`,
          mensagemPix(pedidoConfirmado, dadosPix)
        ];
      } catch (e) {
        console.error('Erro ao gerar Pix:', e);
      }
    }

    resetarEstado(telefone);
    return (
      '🎉 *PEDIDO CONFIRMADO!* 🎉\n\n' +
      `📋 *Pedido #${pedidoConfirmado.id.substring(0,8).toUpperCase()}*\n` +
      `💰 *Total: R$${pedidoConfirmado.total.toFixed(2)}*\n\n` +
      '⏱️ Tempo estimado: *30-45 minutos*\n\n' +
      '✅ Em breve entraremos em contato!\n\n' +
      '_Obrigado pela preferência! 🍔_'
    );
  }

  if (textoLower === 'conf_pedido_nao' || ['não', 'nao', '2', 'n'].includes(textoLower)) {
    setEstado(telefone, { estagio: 'PEDIDO' });
    const pedidoAtual = getPedidoAtivo(telefone);
    return (
      '↩️ *Voltando para o pedido...*\n\n' +
      `🛒 Carrinho atual: R$${pedidoAtual.total.toFixed(2)}\n\n` +
      '📝 *Como adicionar mais:*\n' +
      '   Digite o número do item\n' +
      '   Exemplo: *2* ou *2 5 7*\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━\n' +
      '📋 *Cardápio:*\n\n' + getCardapioTexto()
    );
  }

  if (textoLower === 'cancelar' || textoLower === '3') {
    cancelarPedido(telefone);
    resetarEstado(telefone);
    return '❌ *Pedido cancelado.*\n\nEnvie *oi* para começar de novo! 😊';
  }

  if (!pedido) {
    resetarEstado(telefone);
    return mensagemBoasVindas();
  }

  return gerarResumoConfirmacao(pedido);
}

function handleAguardandoPix(telefone, textoLower) {
  const { verificarPagamentoPix } = require('./pix');
  const estado = getEstado(telefone);

  if (estado.pixExpiraEm && Date.now() > estado.pixExpiraEm) {
    resetarEstado(telefone);
    return '⏰ *Tempo esgotado!* 😔\n\nO prazo para pagamento expirou.\nEnvie *oi* para fazer um novo pedido!';
  }

  if (['paguei', 'pago', 'pix enviado', 'transferi', '1'].includes(textoLower)) {
    const pixModo = estado.pixModo;

    if ((pixModo === 'mercadopago' || pixModo === 'asaas') && estado.pedidoConfirmado) {
      verificarPagamentoPix(estado.pedidoConfirmado.id).then(resultado => {
        if (['approved', 'CONFIRMED', 'APPROVED'].includes(resultado.status)) {
          console.log(`✅ Pagamento confirmado para ${estado.pedidoConfirmado.id}`);
        }
      }).catch(() => {});
    }

    resetarEstado(telefone);
    return (
      '✅ *Pagamento recebido! Obrigado!* 🙏\n\n' +
      '🔥 Seu pedido já entrou no preparo!\n' +
      '⏱️ Tempo estimado: *30-45 minutos*\n\n' +
      '_Avisaremos quando sair para entrega! 🛵_'
    );
  }

  if (textoLower === 'cancelar' || textoLower === '2') {
    resetarEstado(telefone);
    return '❌ Pedido cancelado. Envie *oi* para começar novamente.';
  }

  if (textoLower === 'verificar' || textoLower === '3') {
    if (estado.pixModo === 'asaas' && estado.pedidoConfirmado) {
      verificarPagamentoPix(estado.pedidoConfirmado.id).then(resultado => {
        if (['CONFIRMED', 'APPROVED'].includes(resultado.status)) {
          resetarEstado(telefone);
        }
      }).catch(() => {});
    }
    return '⏳ Verificando pagamento...\n\nTente novamente em segundos ou envie *paguei*.';
  }

  const tempoRestante = estado.pixExpiraEm ? Math.ceil((estado.pixExpiraEm - Date.now()) / 60000) : 30;

  return (
    `⏳ *Aguardando pagamento Pix* (${tempoRestante} min)\n` +
    '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    '✅ *1* → Já efectuei o pagamento\n' +
    '📲 *2* → Cancelar pedido\n' +
    '🔄 *3* → Verificar status\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    '_Caso já tenha pago, envie *1* para confirmarmos!_'
);
}

function gerarResumoConfirmacao(pedido) {
  let texto = '🛒 *RESUMO DO SEU PEDIDO*\n';
  texto += '━━━━━━━━━━━━━━━━━━━━━━\n\n';

  pedido.itens.forEach((item, idx) => {
    const subtotal = item.preco * item.quantidade;
    texto += `${idx+1}. ${item.quantidade}x ${item.nome}\n`;
    texto += `   R$${subtotal.toFixed(2)}\n\n`;
  });

  texto += '━━━━━━━━━━━━━━━━━━━━━━\n';
  texto += `💰 *TOTAL A PAGAR: R$${pedido.total.toFixed(2)}*\n`;
  texto += '━━━━━━━━━━━━━━━━━━━━━━\n\n';
  texto += '✅ *1* → Confirmar pedido\n';
  texto += '➕ *2* → Adicionar mais itens\n';
  texto += '❌ *3* → Cancelar pedido';

  return texto;
}

module.exports = { processMessage };