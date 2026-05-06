# 🧪 GUIA DE TESTE

## Como Testar as Novas Funcionalidades

### **Teste 1: Notificação Automática ao Mudar Status**

1. **Abra o painel** em `http://localhost:3000`
2. **Vá ao WhatsApp** e faça um pedido:
   - Digite qualquer mensagem (ex: "oi")
   - Siga o fluxo normalmente
   - Finalize um pedido
3. **No painel:** Veja o novo pedido aparecer
4. **Mude o status** → Selecione "🔥 Em Preparo"
5. **No WhatsApp:** Cliente recebe mensagem instantaneamente! ✅

### **Teste 2: Testar Todos os Status**

```
Pedido novo → 🔥 Em Preparo
          ↓
        Mensagem enviada ✅

          ↓
     🛵 Saiu p/ Entrega
          ↓
        Mensagem enviada ✅

          ↓
      ✅ Entregue
          ↓
        Mensagem enviada ✅
```

### **Teste 3: Painel Rápido**

1. Faça 2-3 pedidos rápido pelo WhatsApp
2. Observe o painel
3. Deve atualizar a cada 5 segundos
4. Os pedidos devem aparecer **automaticamente**

### **Teste 4: Verificar Toast Notification**

1. Mude o status de um pedido
2. Veja o toast no canto inferior esquerdo:
   - "✅ Status atualizado para: 🔥 Em Preparo"
   - "📱 Cliente foi notificado via WhatsApp!"

---

## ✅ Checklist de Funcionamento

- [ ] Cliente recebe notificação ao mudar para "Em Preparo"
- [ ] Cliente recebe notificação ao mudar para "Saiu p/ Entrega"
- [ ] Cliente recebe notificação ao mudar para "Entregue"
- [ ] Painel atualiza rapidamente (< 5s)
- [ ] Toast mostra mensagem clara
- [ ] Estatísticas não zeran mais ao mudar status
- [ ] Painel continua respondendo bem mesmo com múltiplos pedidos

---

## 🐛 Se Algo Não Funcionar

**Problema:** Cliente não recebe notificação
- Solução: Verifique se o bot está online (mensagem "Bot está online!" aparece)
- Verifique se a mensagem tem `@c.us` no formato

**Problema:** Painel não atualiza
- Solução: Recarregue a página (F5)
- Verifique console do navegador (F12)

**Problema:** Toast não aparece
- Solução: Abra console do navegador (F12) e procure por erros

---

## 📊 Análise de Performance

**Antes:**
- ❌ Cliente não era notificado
- ❌ Painel atualizava a cada 15s
- ❌ Estatísticas buggadas

**Depois:**
- ✅ Cliente recebe notificação instantaneamente
- ✅ Painel atualiza a cada 5s
- ✅ Estatísticas funcionam perfeitamente
- ✅ Toast feedback ao usuário

