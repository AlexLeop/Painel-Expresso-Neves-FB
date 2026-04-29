# Camada Fintech (Asaas) - Plano de Execução (Fase 2)

Este documento detalha o plano para transformar o Fleetbase em uma solução financeira White Label utilizando o **Asaas** como motor bancário (Subcontas, Cobranças e Repasses PIX).

## Arquitetura: Clonando a Lógica do Stripe

Assim como analisado na estratégia headless do Fleetbase, o Order Gateway agirá como intermediário entre a extensão financeira no Console e a API do Asaas.

1. O Lojista acessa a aba "Financeiro" no Console do Fleetbase (via `financeiro-engine`).
2. O Frontend faz um `GET /financeiro/int/v1/dashboard`. O Nginx Proxy encaminha para o Order Gateway na porta 3000.
3. O Order Gateway consome a API do Asaas utilizando a chave de API (sandbox/produção) armazenada em variável de ambiente e atrelada aos sub-accounts (Lojistas).

## Alterações Propostas

### 1. Backend: Order Gateway (Serviços e Rotas)

Precisamos expandir o Node.js para falar com o Asaas e servir dados para o Console.

- **`src/services/asaas.ts`**: Cliente Axios configurado para a API do Asaas (`https://sandbox.asaas.com/api/v3` ou produção). Funções esperadas:
  - `createCustomer()`
  - `createPixCharge()`
  - `transferPix()` (Repasses)

- **`src/routes/financeiro-api/dashboard.ts`**: Endpoint Fastify para consolidar o saldo e métricas do Asaas e retornar ao Ember Data.
- **`src/routes/financeiro-api/cobrancas.ts`**: Endpoint Fastify para CRUD de cobranças geradas.
- **`src/routes/financeiro-api/repasses.ts`**: Endpoint Fastify (WeeklyRulesEngine) para listagem e execução de repasses aos motoboys ou contas de repasse.

### 2. Frontend: Financeiro Engine (Ember Addon)

Seguindo o mesmo molde do `integracoes-engine`, criaremos um addon similar focado nas finanças.

- **`financeiro-engine/`**: Criaremos as pastas `addon/models`, `addon/adapters`, `addon/templates/dashboard` com os mesmos arquivos mandatórios (`package.json`, `index.js`, `engine.js`, `extension.js`).
- **`addon/adapters/financeiro.js`**: Adapter apontando para `namespace = 'financeiro/int/v1'`.
- **`addon/templates/dashboard.hbs`**: UI com componentes nativos do Fleetbase mostrando KPIs: Saldo Disponível, Recebimentos Futuros, e Extrato (via Asaas).

### 3. Integração na Build (Console Dockerfile)

- **`console-custom/Dockerfile`**: Assim como linkamos o `integracoes-engine`, precisaremos copiar o `financeiro-engine` para o Stage 1 (Builder) e executar um `yarn add link:../financeiro-engine` para que ambas as abas sejam compiladas juntas na nuvem.

---

## ⚠️ PERGUNTAS EM ABERTO (Aguardo sua decisão)

1. **Repasses PIX aos Motoboys:** O Asaas exige que eles sejam cadastrados (chave PIX). Você quer que a tela do Dashboard Financeiro tenha um botão para o franqueado cadastrar os motoboys manualmente na subconta Asaas, ou devemos interceptar um Webhook de criação de motorista do Fleetbase para criar as contas de recebimento no Asaas automaticamente?
2. **Conta Master vs Subcontas:** No Order Gateway, posso fixar a `ASAAS_API_KEY` global no `config.ts` por enquanto (para usarmos a sua conta "Master" como hub distribuidor de PIX), ou você prefere que cada Lojista configure sua própria API Key do Asaas via tela do painel?
