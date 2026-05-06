/**
 * pix.js — Geração de cobrança Pix
 *
 * Suporta dois modos configurados no .env:
 *
 *  PIX_MODO=estatico  → Pix Copia e Cola (sem API)
 *  PIX_MODO=mercadopago → API do Mercado Pago (confirmação automática)
 *  PIX_MODO=asaas    → API do Asaas
 */

const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const QR_DIR = path.join(__dirname, 'public', 'qrcodes');
if (!fs.existsSync(QR_DIR)) {
  fs.mkdirSync(QR_DIR, { recursive: true });
}

const cobrancasPendentes = new Map();

// ──────────────────────────────────────────────────────────
// PIX ESTÁTICO (Copia e Cola)
// ──────────────────────────────────────────────────────────

function gerarPayloadPixEstatico({ chave, nome, cidade, valor, txid }) {
  nome = nome.substring(0, 25).replace(/[^a-zA-Z0-9 ]/g, '');
  cidade = cidade.substring(0, 15).replace(/[^a-zA-Z0-9 ]/g, '');
  txid = txid.substring(0, 25).replace(/[^a-zA-Z0-9]/g, '');

  const valorStr = valor.toFixed(2);
  const tlv = (id, valor) => `${id}${String(valor.length).padStart(2, '0')}${valor}`;

  const payload =
    tlv('00', '01') +
    tlv('26', tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', chave)) +
    tlv('52', '0000') +
    tlv('53', '986') +
    tlv('54', valorStr) +
    tlv('58', 'BR') +
    tlv('59', nome) +
    tlv('60', cidade) +
    tlv('62', tlv('05', txid)) +
    '6304';

  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return payload + ((crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0'));
}

// ──────────────────────────────────────────────────────────
// MERCADO PAGO API
// ──────────────────────────────────────────────────────────

async function criarCobrancaMercadoPago(pedido) {
  const accessToken = process.env.MERCADOPAGO_TOKEN;

  if (!accessToken) {
    throw new Error('MERCADOPAGO_TOKEN não configurado no .env');
  }

  const ambiente = process.env.MERCADOPAGO_AMBIENTE === 'production'
    ? 'https://api.mercadopago.com'
    : 'https://api.sandbox.mercadopago.com';

  const dados = {
    transaction_amount: pedido.total,
    description: `Pedido #${pedido.id.substring(0, 8).toUpperCase()}`,
    payment_method: 'pix',
    payer: {
      email: 'cliente@whatsapp.com'
    },
    external_reference: pedido.id,
    notification_url: `${process.env.MERCADOPAGO_NOTIFICATION_URL || ''}`,
    items: pedido.itens.map(item => ({
      title: item.nome,
      quantity: item.quantidade,
      unit_price: item.preco
    }))
  };

  const resposta = await axios.post(
    `${ambiente}/v1/payments`,
    dados,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return resposta.data;
}

async function verificarPagamentoMercadoPago(paymentId) {
  const accessToken = process.env.MERCADOPAGO_TOKEN;

  if (!accessToken) {
    return { status: 'erro', erro: 'Token não configurado' };
  }

  const ambiente = process.env.MERCADOPAGO_AMBIENTE === 'production'
    ? 'https://api.mercadopago.com'
    : 'https://api.sandbox.mercadopago.com';

  try {
    const resposta = await axios.get(
      `${ambiente}/v1/payments/${paymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    return resposta.data;
  } catch (e) {
    return { status: 'erro', erro: e.message };
  }
}

// ──────────────────────────────────────────────────────────
// ASAAS API (alternativa)
// ──────────────────────────────────────────────────────────

async function criarCobrancaAsaas(pedido) {
  const apiKey = process.env.ASAAS_API_KEY;
  const ambiente = process.env.ASAAS_AMBIENTE || 'sandbox';

  if (!apiKey) {
    throw new Error('ASAAS_API_KEY não configurada no .env');
  }

  const baseURL = ambiente === 'production'
    ? 'https://www.asaas.com/api/v3'
    : 'https://sandbox.asaas.com/api/v3';

  const dadosCobranca = {
    billingType: 'PIX',
    customer: process.env.ASAAS_CUSTOMER_ID,
    value: pedido.total,
    dueDate: new Date().toISOString().split('T')[0],
    description: `Pedido #${pedido.id.substring(0, 8).toUpperCase()}`,
    externalReference: pedido.id,
    items: pedido.itens.map(item => ({
      name: item.nome,
      value: item.preco,
      quantity: item.quantidade
    }))
  };

  const resposta = await axios.post(`${baseURL}/payments`, dadosCobranca, {
    headers: {
      'access_token': apiKey,
      'Content-Type': 'application/json'
    }
  });

  return resposta.data;
}

async function verificarPagamentoAsaas(idCobranca) {
  const apiKey = process.env.ASAAS_API_KEY;
  const ambiente = process.env.ASAAS_AMBIENTE || 'sandbox';

  if (!apiKey) {
    return { status: 'erro', erro: 'API Key não configurada' };
  }

  const baseURL = ambiente === 'production'
    ? 'https://www.asaas.com/api/v3'
    : 'https://sandbox.asaas.com/api/v3';

  try {
    const resposta = await axios.get(`${baseURL}/payments/${idCobranca}`, {
      headers: { 'access_token': apiKey }
    });
    return resposta.data;
  } catch (e) {
    return { status: 'erro', erro: e.message };
  }
}

// ──────────────────────────────────────────────────────────
// API PRINCIPAL
// ──────────────────────────────────────────────────────────

async function gerarQRCodePix(pedido) {
  const modo = process.env.PIX_MODO || 'estatico';
  const chavePix = process.env.PIX_CHAVE || '';
  const nomeLoja = process.env.PIX_NOME || 'Zé Delivery';
  const cidade = process.env.PIX_CIDADE || 'Sao Paulo';
  const txid = pedido.id.replace(/-/g, '').substring(0, 25);

  // Modo Mercado Pago
  if (modo === 'mercadopago') {
    try {
      const mp = await criarCobrancaMercadoPago(pedido);
      
      if (mp.point_of_interaction && mp.point_of_interaction.transaction_data) {
        const qr码 = mp.point_of_interaction.transaction_data.qr_code;
        const nomeArquivo = `pix_${txid}.png`;
        const qrPath = path.join(QR_DIR, nomeArquivo);

        await QRCode.toFile(qrPath, qr码, {
          width: 300,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' }
        });

        cobrancasPendentes.set(pedido.id, {
          mpId: mp.id,
          status: mp.status
        });

        return {
          payload: qr码,
          qrPath,
          qrUrl: `/qrcodes/${nomeArquivo}`,
          modo: 'mercadopago',
          mpId: mp.id
        };
      }
    } catch (e) {
      console.error('Erro Mercado Pago:', e.message);
    }
  }

  // Modo Asaas
  if (modo === 'asaas') {
    try {
      const cobranca = await criarCobrancaAsaas(pedido);
      
      if (cobranca.qrCode && cobranca.qrCode.qrCode) {
        const nomeArquivo = `pix_${txid}.png`;
        const qrPath = path.join(QR_DIR, nomeArquivo);

        await QRCode.toFile(qrPath, cobranca.qrCode.qrCode, {
          width: 300,
          margin: 2,
          color: { dark: '#000000', light: '#FFFFFF' }
        });

        cobrancasPendentes.set(pedido.id, {
          asaasId: cobranca.id,
          status: cobranca.status
        });

        return {
          payload: cobranca.qrCode.qrCode,
          qrPath,
          qrUrl: `/qrcodes/${nomeArquivo}`,
          modo: 'asaas',
          asaasId: cobranca.id
        };
      }
    } catch (e) {
      console.error('Erro Asaas:', e.message);
    }
  }

  // Volta para estático
  if (!chavePix) {
    throw new Error('PIX_CHAVE não configurada no .env');
  }

  const payload = gerarPayloadPixEstatico({
    chave: chavePix,
    nome: nomeLoja,
    cidade: cidade,
    valor: pedido.total,
    txid: txid
  });

  const nomeArquivo = `pix_${txid}.png`;
  const qrPath = path.join(QR_DIR, nomeArquivo);

  await QRCode.toFile(qrPath, payload, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' }
  });

  return { payload, qrPath, qrUrl: `/qrcodes/${nomeArquivo}`, modo: 'estatico' };
}

async function verificarPagamentoPix(pedidoId) {
  const cobranca = cobrancasPendentes.get(pedidoId);
  if (!cobranca) return { status: 'nao_encontrado' };

  if (cobranca.mpId) {
    return verificarPagamentoMercadoPago(cobranca.mpId);
  }
  if (cobranca.asaasId) {
    return verificarPagamentoAsaas(cobranca.asaasId);
  }
  return { status: 'nao_encontrado' };
}

function mensagemPix(pedido, dados) {
  const modo = dados.modo || 'estatico';

  if (modo === 'mercadopago') {
    return (
      '💳 *PAGAMENTO VIA PIX - MERCADO PAGO*\n\n' +
      `💰 Valor: *R$${pedido.total.toFixed(2)}*\n\n` +
      '📲 *Como pagar:*\n' +
      '1. Abra seu banco/app\n' +
      '2. Escolha Pix\n' +
      '3. Escaneie o QR Code\n' +
      '4. Confirme o pagamento\n\n' +
      '⏰ *Aguardando pagamento...*\n\n' +
      'Assim que recebermos, você será notificado!'
    );
  }

  if (modo === 'asaas') {
    return (
      '💳 *PAGAMENTO VIA PIX*\n\n' +
      `💰 Valor: *R$${pedido.total.toFixed(2)}*\n\n` +
      '📲 *Como pagar:*\n' +
      '1. Abra seu banco\n' +
      '2. Escolha Pix\n' +
      '3. Escaneie o QR Code\n' +
      '4. Confirme o pagamento\n\n' +
      '⏰ *Aguardando pagamento...*\n' +
      'Assim que recebermos, você será notificado!'
    );
  }

  return (
    '💳 *PAGAMENTO VIA PIX*\n\n' +
    `💰 Valor: *R$${pedido.total.toFixed(2)}*\n\n` +
    '📋 *Pix Copia e Cola:*\n' +
    '```\n' + dados.payload + '\n```\n\n' +
    '📲 *Como pagar:*\n' +
    '1. Abra seu banco\n' +
    '2. Vá em Pix → Pagar\n' +
    '3. Escolha "Copia e Cola"\n' +
    '4. Cole o código\n' +
    '5. Confirme\n\n' +
    '✅ Após pagar, envie *"paguei"*!'
  );
}

module.exports = {
  gerarQRCodePix,
  mensagemPix,
  gerarPayloadPixEstatico,
  verificarPagamentoPix
};