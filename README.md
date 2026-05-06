# 🍔 WhatsApp Burger Bot — v2.0 (MVP+)

Bot de pedidos via WhatsApp para hamburguerias, com:
- ✅ Fluxo completo de pedidos via WhatsApp
- 💾 Banco de dados SQLite (persistente, sem servidor)
- 💸 Pagamento via Pix (copia e cola automático)
- 📲 Notificações para a cozinha via Telegram
- 🌐 Painel web em tempo real (http://localhost:3000)

---

## 📁 Estrutura de Arquivos

```
whatsapp-burger-bot/
│
├── index.js        ← Entrada: inicia bot + painel web
├── bot.js          ← Conexão WhatsApp + recebe mensagens
├── flow.js         ← Máquina de estados da conversa
├── orders.js       ← Criação e gestão de pedidos (memória)
├── storage.js      ← SQLite: salva/consulta pedidos
├── cardapio.js     ← Produtos e preços (edite aqui)
├── pix.js          ← Geração de Pix copia e cola
├── telegram.js     ← Notificações para a cozinha
├── painel.js       ← Servidor web do painel de pedidos
│
├── burger_bot.db   ← Banco SQLite (gerado automaticamente)
├── public/
│   └── qrcodes/    ← QR Codes Pix gerados
├── .env            ← Suas configurações (crie a partir do .example)
├── .env.example    ← Exemplo de configurações
└── package.json
```

---

## 🚀 Como Rodar

### 1. Instale as dependências

```bash
cd whatsapp-burger-bot
npm install
```

### 2. Configure o ambiente

```bash
cp .env.example .env
```

Edite o `.env` com seus dados:
- **PIX_CHAVE**: sua chave Pix (e-mail, CPF, telefone, etc.)
- **TELEGRAM_TOKEN** + **TELEGRAM_CHAT_ID**: para alertas na cozinha

> ⚠️ Pix e Telegram são opcionais. Deixe em branco para rodar sem eles.

### 3. Inicie

```bash
npm start
```

### 4. Escaneie o QR Code

Aparece no terminal. Escaneie com WhatsApp → Dispositivos Conectados.

### 5. Abra o painel

Acesse **http://localhost:3000** no navegador.

---

## 💬 Fluxo Completo de Pedido

```
Usuário:  oi
Bot:      Bem-vindo! 1-Ver cardápio / 2-Fazer pedido

Usuário:  2
Bot:      Mostra cardápio completo

Usuário:  1          (X-Burguer)
Bot:      Quantas unidades?

Usuário:  2
Bot:      ✅ 2x X-Burguer adicionado. Total: R$40,00

Usuário:  7          (Refrigerante)
Bot:      Quantas unidades?

Usuário:  2
Bot:      ✅ Total parcial: R$52,00

Usuário:  0          (finalizar)
Bot:      📋 Resumo do pedido + pergunta confirmação

Usuário:  sim
Bot:      🎉 Pedido confirmado! + Pix copia e cola
          ── Telegram notifica a cozinha ──

Usuário:  paguei
Bot:      ✅ Pagamento confirmado! Seu pedido entrou no preparo!
```

---

## 🌐 Painel Web

Acesse **http://localhost:3000** para ver:

| Recurso | Descrição |
|---|---|
| Cards de stats | Pedidos hoje, faturamento, ticket médio |
| Tabela de pedidos | Todos os pedidos com itens e totais |
| Filtros por status | Novo, Confirmado, Em Preparo, etc. |
| Mudar status | Select dropdown em cada pedido |
| Auto-refresh | Atualiza a cada 15 segundos |

---

## 💸 Configurar Pix

No `.env`:
```env
PIX_CHAVE=meuemail@gmail.com   # ou CPF: 12345678901
PIX_NOME=Zé Delivery
PIX_CIDADE=Sao Paulo
```

O bot gera automaticamente o **Pix Copia e Cola** no padrão do Banco Central. Funciona em qualquer banco sem APIs externas.

---

## 📲 Configurar Telegram (Cozinha)

1. Fale com **@BotFather** no Telegram → `/newbot`
2. Copie o token gerado para `TELEGRAM_TOKEN` no `.env`
3. Crie ou use um grupo para a cozinha
4. Adicione seu bot ao grupo
5. Mande uma mensagem no grupo e acesse:
   ```
   https://api.telegram.org/bot<SEU_TOKEN>/getUpdates
   ```
6. Copie o `"id"` do chat para `TELEGRAM_CHAT_ID`

---

## ✏️ Personalizar o Cardápio

Edite `cardapio.js`:

```javascript
{
  id: 9,
  nome: 'Meu Burguer Especial',
  descricao: 'Descrição do produto',
  preco: 35.00
}
```

---

## 🔄 Manter Rodando (produção)

```bash
npm install -g pm2
pm2 start index.js --name burger-bot
pm2 save && pm2 startup
```

---

## ❓ Problemas Comuns

| Problema | Solução |
|---|---|
| `Cannot find module 'better-sqlite3'` | `npm install` novamente |
| QR Code não aparece | Aguarde 60s ou delete `.wwebjs_auth/` |
| Sessão expirou | Delete `.wwebjs_auth/` e escaneie novamente |
| Erro SQLite no Linux | `sudo apt install build-essential` |
| Pix não funciona | Verifique `PIX_CHAVE` no `.env` |
| Telegram não envia | Confirme token e chat_id com `/getUpdates` |

---

## 🗺️ Arquitetura

```
Cliente WhatsApp
      ↓ mensagem
   bot.js          ← Conexão WhatsApp Web
      ↓
   flow.js         ← Máquina de estados (decide resposta)
    ↙    ↘
orders.js  cardapio.js
(carrinho)  (produtos)
    ↓
storage.js          pix.js        telegram.js
(SQLite DB)     (Pix copia&cola)  (notif. cozinha)

painel.js ← Express API + HTML → http://localhost:3000
```
