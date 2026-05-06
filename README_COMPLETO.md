# 🍔 Zé Delivery Bot - Documentação Completa

## 📦 Funcionalidades

### 🤖 Bot WhatsApp
- ✅ Cardápio interativo com 8 produtos
- ✅ Múltiplos itens em um pedido (ex: "1 3" adiciona 2 itens)
- ✅ Suporte a Pix com QR Code automático
- ✅ Fluxo conversacional intuitivo
- ✅ Notificações automáticas ao cliente
- ✅ Cancelamento de pedidos

### 🎛️ Painel de Pedidos
- ✅ Dashboard em tempo real (atualiza a cada 5s)
- ✅ Filtros por status (Todos, Confirmados, Em Preparo, etc)
- ✅ Mudar status rapidamente via dropdown
- ✅ Estatísticas: Pedidos, Faturamento, Ticket Médio
- ✅ Tabela responsiva com dados completos
- ✅ Toast feedback ao fazer ações

### 📱 Notificações
- ✅ Cliente recebe mensagem quando status muda
- ✅ 4 tipos de notificação (Em Preparo, Saiu Entrega, Entregue, Cancelado)
- ✅ Mensagens personalizadas e profissionais
- ✅ Enviadas instantaneamente via WhatsApp

### 💾 Banco de Dados
- ✅ SQLite local e portável
- ✅ Histórico de pedidos
- ✅ Rastreamento de status
- ✅ Backup automático

### 🔔 Integrações Opcionais
- ✅ Telegram (notificar cozinha - configurável)
- ✅ Pix (receber pagamentos - configurável)

---

## 📋 Documentação

### Arquivos de Análise
- `RESUMO_EXECUTIVO.md` - Visão geral executiva
- `VISAO_GERAL.md` - Fluxo operacional completo
- `MELHORIAS_IMPLEMENTADAS.md` - O que foi adicionado
- `GUIA_TESTE.md` - Como testar as funcionalidades
- `ANALISE_PROBLEMAS.md` - Problemas identificados e soluções

### Arquivos de Código
- `index.js` - Ponto de entrada
- `bot.js` - Bot WhatsApp
- `flow.js` - Fluxo de conversa
- `cardapio.js` - Definição do cardápio
- `orders.js` - Gestão de pedidos em memória
- `storage.js` - Persistência no banco SQLite
- `painel.js` - Servidor web do painel
- `telegram.js` - Integrações Telegram + Notificações cliente
- `pix.js` - Integração Pix

---

## 🚀 Como Usar

### Iniciar o Bot
```bash
npm install
npm start
```

### Acessar o Painel
```
http://localhost:3000
```

### Usar no WhatsApp
1. Escaneie o QR Code com seu WhatsApp
2. Envie "oi" para começar
3. Siga o fluxo do bot

---

## ⚙️ Configuração

### Arquivo `.env` (opcional)

```env
# Porta do painel (padrão: 3000)
PORT=3000

# Telegram (opcional)
TELEGRAM_TOKEN=seu_token_aqui
TELEGRAM_CHAT_ID=seu_chat_id_aqui

# Pix (opcional)
PIX_CHAVE=sua_chave_pix@email.com
```

---

## 📊 Estatísticas

O painel mostra:
- **Pedidos Hoje:** Quantidade de pedidos confirmados hoje
- **Faturamento Hoje:** Soma total dos pedidos de hoje
- **Total de Pedidos:** Quantidade total (todos os tempos)
- **Ticket Médio:** Valor médio por pedido

---

## 🔄 Fluxo do Pedido

```
1. Cliente entra → Bot oferece menu
2. Cliente faz pedido → Bot pede confirmação
3. Cliente confirma → Painel mostra pedido
4. Gerente marca "Em Preparo" → Cliente notificado
5. Gerente marca "Saiu Entrega" → Cliente notificado
6. Gerente marca "Entregue" → Cliente notificado
```

---

## 📱 Mensagens do Bot

### Boas-vindas
```
👋 Bem-vindo ao Zé Delivery! 🍔

🍔 Hambúrgueres deliciosos entregues rápido!

━━━━━━━━━━━━━━━━━━━━━━
📋 Ver Cardápio → Digite 1 ou "cardápio"
🛒 Fazer Pedido → Digite 2 ou "pedido"
━━━━━━━━━━━━━━━━━━━━━━

⌨️ Escolha uma opção acima para começar!
```

### Após Adicionar Item
```
✅ Adicionado!

• 1x X-Burguer
  R$20.00

━━━━━━━━━━━━━━━━━━━━━━
🛒 TOTAL: R$20.00

Seu carrinho:
1. 1x X-Burguer • R$20.00

━━━━━━━━━━━━━━━━━━━━━━
🛒 Próximos passos:
📝 Digite nº do item (ajusta qtd)
✅ 0 para confirmar
❌ cancelar para limpar
━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🎯 Status de Pedido

| Status | Emoji | Descrição |
|--------|-------|-----------|
| Novo | 🔵 | Recém-criado |
| Confirmado | ✅ | Cliente confirmou |
| Em Preparo | 🔥 | Sendo preparado |
| Saiu Entrega | 🛵 | A caminho |
| Entregue | 📦 | Finalizado |
| Cancelado | ❌ | Desistência |

---

## 🔐 Segurança

- ✅ Banco de dados local (não sai do servidor)
- ✅ Validação de entrada em todas as mensagens
- ✅ Sem armazenamento de senhas
- ✅ Conexão WhatsApp encriptada

---

## 📈 Performance

- **Resposta do Bot:** < 1 segundo
- **Atualização Painel:** 5 segundos
- **Notificação Cliente:** Instantânea
- **Capacidade:** Centenas de pedidos

---

## 🆘 Suporte

### Erro: "EADDRINUSE"
Porta 3000 já está em uso. Solução:
```bash
# Windows
Get-Process node | Stop-Process -Force

# macOS/Linux
pkill -f node
```

### Erro: "QR Code não aparece"
1. Verifique se o terminal está maximizado
2. Tente escanear mesmo que pareça bugado
3. Se não funcionar, feche e abra novamente

### Cliente não recebe notificação
1. Verifique se bot mostra "Bot está online!"
2. Verifique se número tem formato correto
3. Tente mudar status novamente

---

## 🎨 Customização

### Mudar Cardápio
Edite `cardapio.js`:
```javascript
const CARDAPIO = [
  {
    id: 1,
    nome: 'Seu Produto',
    descricao: 'Descrição',
    preco: 25.00
  },
  // ...
];
```

### Mudar Cores do Painel
Edite `painel.js` na seção `<style>`

### Mudar Mensagens do Bot
Edite `flow.js` nos handlers

---

## 📄 Licença

Este projeto é fornecido como está para uso pessoal e comercial.

---

## ✨ Créditos

Desenvolvido com ❤️ para hamburgueria.

Versão: **2.0.0**
Última atualização: **05/05/2026**

