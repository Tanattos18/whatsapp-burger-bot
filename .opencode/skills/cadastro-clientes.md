# Skill: Cadastro de Clientes

Sistema de cadastro de clientes com telefone, nome e endereço.

## Como usar

Quando o usuário fazer primeiro acesso, o bot pede:
1. Nome completo
2. Endereço de entrega

O cliente é salvo no SQLite (tabela `clientes`) e reconhecido em acessos seguintes.

## Arquivos

- `clientes.js` - Módulo de gestão de clientes
- `flow.js` - Fluxo de cadastro (estados CADASTRO_NOME, CADASTRO_ENDERECO)

## Variáveis do banco

- telefone (PK)
- nome
- endereco
- bairro
- complemento
- referencia
- created_at
- atualizado_em