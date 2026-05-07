# 📋 CHANGELOG — v2.1 (Em Desenvolvimento)

## Objetivo desta atualização
Desbloquear WhatsApp APENAS após login no painel admin, com:
- Cadastro de novas contas
- Recuperação de senha
- Botão no painel para conectar/desconectar WhatsApp

---

## ✅ O QUE FOI FEITO

### 1. Backup criado
- **Pasta**: `backups/v2026-05-07-12-33-01/`
- **Arquivos**: index.js, bot.js, flow.js, orders.js, storage.js, clientes.js, cardapio.js, pix.js, telegram.js, painel.js, menus.js, auth.js, package.json, .env

### 2. auth.js — Expansão completa
- [x] Tabela `usuarios` no SQLite (username, email, senha_hash, papel, ativo)
- [x] `criarUsuario()` — criar novas contas
- [x] `login()` — autenticar com bcrypt
- [x] `gerarCodigo()` — solicitar recuperação de senha (código de 6 dígitos)
- [x] `redefinirSenha()` — redefinir com código + nova senha
- [x] `listarUsuarios()` — listar todos os usuários
- [x] `atualizarSenha()` — usuário troca sua própria senha
- [x] `criarAdminPadrao()` — cria admin padrão na primeira execução
- [x] Sessões em memória com TTL de 24h
- [x] Códigos de recuperação expirados em 15min

### 3. bot.js — Refatorado
- [x] Criação do cliente isolada na função `criarClienteWhatsApp()`
- [x] `conectarWhatsApp()` — inicia conexão sob demanda
- [x] `desconectarWhatsApp()` — desconecta via painel
- [x] `getStatusWhatsApp()` — retorna status + QR code
- [x] `getClient()` — expõe cliente para uso interno
- [x] Notificações de status via `painel.js`
- [x] QR code disponibilizado em tempo real

### 4. index.js — Modificado
- [x] REMOVIDO: `startBot()` automático na inicialização
- [x] ADICIONADO: só inicia o painel web
- [x] WhatsApp só conecta via painel admin

### 5. flow.js — Controle de status
- [x] `isBotOnline()` — verifica se WhatsApp está conectado
- [x] Bloqueio de mensagens quando bot está offline
- [x] Mensagem amigável explicando que o bot está temporariamente fora

---

## ✅ O QUE FALTOU FAZER — AGORA COMPLETO

### 6. painel.js — EXPANDIR (CONCLUÍDO ✅)
- [x] APIs REST:
  - [x] `POST /api/whatsapp/connect` — conectar WhatsApp
  - [x] `POST /api/whatsapp/disconnect` — desconectar
  - [x] `GET /api/whatsapp/status` — ver status
  - [x] `GET /api/whatsapp/qr` — pegar QR code
  - [x] `POST /api/auth/cadastrar` — criar nova conta
  - [x] `POST /api/auth/esqueci-senha` — solicitar código
  - [x] `POST /api/auth/redefinir-senha` — redefinir com código
  - [x] `GET /api/usuarios` — listar usuários (admin)

- [x] Páginas HTML:
  - [x] **Tela de login** atualizada com:
    - [x] Link "Criar conta"
    - [x] Link "Esqueci minha senha"
  - [x] **Tela de cadastro** com formulário:
    - [x] Usuário, e-mail, senha, confirmar senha
  - [x] **Tela de recuperação** com:
    - [x] Campo e-mail → envia código
    - [x] Campo código + nova senha
  - [x] **Painel principal** com:
    - [x] Status do WhatsApp (badge ON/OFF)
    - [x] Botão "Conectar WhatsApp" (quando desconectado)
    - [x] Botão "Desconectar" (quando conectado)
    - [x] QR Code visual (quando aguardando scan)
    - [x] Polling de status a cada 5 segundos

- [x] JavaScript no painel:
  - [x] Polling para QR code ao vivo (a cada 5s)
  - [x] Auto-refresh do status
  - [ ] Troca de senha do próprio usuário (pendente)

---

## 📊 Status da Implementação

| Componente | Status |
|---|---|
| Backup | ✅ Feito |
| auth.js | ✅ Feito |
| bot.js | ✅ Feito |
| index.js | ✅ Feito |
| flow.js | ✅ Feito |
| painel.js | ✅ COMPLETO |

**Progresso: ~95% completo**

---

## ✅ TESTADO E FUNCIONANDO

1. ✅ Painel web inicia sem WhatsApp
2. ✅ Login com usuário/senha (admin/admin123)
3. ✅ Cadastro de novas contas
4. ✅ Recuperação de senha por código
5. ✅ Botão "Conectar WhatsApp" no painel
6. ✅ QR Code visual para escanear
7. ✅ Sessão salva (não precisa escanear toda vez)
8. ✅ Recebimento de pedidos via WhatsApp
9. ✅ Atualização de status no painel (em_preparo, saiu_entrega, entregue)
10. ✅ Filtros no painel: Todos, Confirmados, Em Preparo, Saiu p/ Entrega, Entregues, Cancelados

---

## ❌ FALTA CORRIGIR/IMPLEMENTAR

1. ✅ **Notificações ao cliente via WhatsApp** — CORRIGIDO (v2026-05-08)
   - Agora salva o chatId do WhatsApp quando o cliente faz o pedido
   - Usa o chatId salvo para enviar notificações de status
   - Fallback para telefone formatado se chatId falhar

2. ⚠️ **Telegram** — "chat not found"
   - TELEGRAM_TOKEN e TELEGRAM_CHAT_ID não configurados no .env (normal em ambiente de teste)
   - O código está correto, basta configurar no .env

3. ✅ **Troca de senha do próprio usuário no painel** — IMPLEMENTADO (v2026-05-08)
   - Nova página /trocar-senha
   - Botão "Trocar Senha" no header do painel
   - API POST /api/auth/trocar-senha

---

## 🔧 Para continuar

1. ~~Completar `painel.js` com todas as APIs e páginas HTML~~ ✅ CONCLUÍDO
2. ✅ Testar fluxo completo: cadastro → login → conectar WhatsApp
3. ✅ Testar QR code em tempo real
4. ✅ Testar recuperação de senha
5. ✅ **Corrigir notificações ao cliente** — IMPLEMENTADO
6. ✅ **Trocar senha do usuário** — IMPLEMENTADO

---

## 📦 Atualização v2026-05-08 — Correções

### Notificações ao Cliente (WhatsApp)
- `bot.js` - agora passa o chatId (msg.from) para processMessage
- `flow.js` - processMessage aceita chatId, passa para handleMenu e criarPedido
- `orders.js` - criarPedido aceita e salva chatId no pedido
- `storage.js` - salva chatId em pedidos ativos e confirmados
- `telegram.js` - notificarClienteStatus usa chatId do banco, com fallback para telefone

### Troca de Senha
- `auth.js` - adicionada função getUsuarioAtual, exportada
- `painel.js` - nova rota /trocar-senha, nova API /api/auth/trocar-senha, nova página HTML

## 📝 Observações

- **Fluxo completo**: O WhatsApp agora só conecta após login no painel e clique em "Conectar WhatsApp"
- **Teste**: Acesse http://localhost:3000, faça login (admin/admin123), clique em "Conectar WhatsApp", escaneie o QR
- **Códigos de recuperação**: Appecem no console do servidor (configure e-mail real em produção)
- **Polling**: Status do WhatsApp atualiza automaticamente a cada 5 segundos
- **Sessão**: O WhatsApp reconecta automaticamente usando a sessão salva

---

## 📁 Arquivos do backup (voltar se der problema)

```
backups/
└── v2026-05-07-12-33-01/
    ├── index.js
    ├── bot.js
    ├── flow.js
    ├── orders.js
    ├── storage.js
    ├── clientes.js
    ├── cardapio.js
    ├── pix.js
    ├── telegram.js
    ├── painel.js
    ├── menus.js
    ├── auth.js
    ├── package.json
    └── .env
```

Para restaurar: copiar arquivos da pasta `v2026-05-07-12-33-01/` para a raiz.