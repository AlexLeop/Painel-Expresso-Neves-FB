# ERP Logístico White Label — Plano de Execução v3

> **Visão:** Transformar o Fleetbase em um ERP Logístico e Financeiro White Label, onde o lojista recebe o pedido no PDV favorito e o motoboy já sai para a entrega automaticamente.

> [!CAUTION]
> **REGRA DE OURO:** O sistema atual (Machine API + Next.js + Supabase) permanece **100% intacto e operacional** até que a nova solução esteja completamente pronta e validada em produção no EasyPanel.

---

## Auto-Questionamento Crítico (Antes de Codificar)

Antes de escrever uma linha de código, identifiquei **7 riscos sérios** que poderiam invalidar o plano inteiro. Cada um tem uma mitigação específica.

### Risco 1: FleetOps API — Nunca Testamos

**Problema:** Trabalhamos apenas no console Ember (frontend). Nunca fizemos um `POST /fleet-ops/api/v1/orders` real. Não sabemos se o motor de despacho está configurado na instância do EasyPanel.

**Mitigação:** Antes de qualquer desenvolvimento, validar:
- [ ] Gerar API Key no painel Developers do Fleetbase
- [ ] Criar um Payload via API (`POST /v1/payloads`)
- [ ] Criar uma Ordem via API (`POST /v1/orders`)
- [ ] Confirmar que a ordem aparece no FleetOps console
- [ ] Verificar se auto-dispatch funciona

**Se falhar:** O Fleetbase pode precisar de configuração adicional (Order Configs, Service Areas) antes de aceitar ordens.

---

### Risco 2: Navigator App — Não Está Operacional

**Problema:** O plano assume que motoboys usarão o Navigator. Mas ele está instalado? Configurado? Conectado à nossa instância?

**Mitigação:**
- [ ] Baixar Navigator do Play Store/TestFlight
- [ ] Configurar para apontar à nossa API: `https://expresso-neves-api.a3rpjn.easypanel.host`
- [ ] Criar driver de teste no Fleetbase
- [ ] Login no Navigator com esse driver
- [ ] Verificar se corrida de teste aparece no app

**Se falhar:** Possivelmente o Navigator precisa de compilação customizada para apontar à instância self-hosted.

---

### Risco 3: Ember Engines — Como Consomem Dados Reais?

**Problema:** O `financeiro-engine` que construímos tem templates 100% HTML estático. Não conectamos nenhum controller a uma API.

**Solução encontrada (pesquisa):** Engines no Fleetbase usam o padrão Ember Data:
```javascript
// addon/adapters/integracao.js
import ApplicationAdapter from '@fleetbase/ember-core/adapters/application';

export default class IntegracaoAdapter extends ApplicationAdapter {
  namespace = 'integracoes/int/v1'; // API namespace customizado
}
```
```javascript
// addon/controllers/catalogo/index.js
import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default class CatalogoController extends Controller {
  @service store;

  async loadIntegrations() {
    this.integrations = await this.store.findAll('integracao');
  }
}
```

**Implicação:** Precisamos de um backend Laravel (ou proxy) que responda no namespace `/integracoes/int/v1/*` para que os adapters do Ember Data funcionem. Isso significa que o **Order Gateway (Node.js)** precisa ser acessível via o proxy Nginx do console, ou precisamos registrar rotas no Fleetbase API (Laravel).

---

### Risco 4: Onde Fica o Backend das Extensões?

**Problema:** Asaas e Order Gateway precisam de chamadas server-side. Mas o Ember Engine roda no browser.

**Decisão arquitetural:**
```
Ember Engine (browser)
    ↓ fetch via Ember Data adapter
Nginx proxy no Console (/integracoes/int/*)
    ↓ proxy_pass
Order Gateway (Node.js, EasyPanel, porta 3000)
    ↓ cria ordens
FleetOps API (Laravel, porta 8000)

Ember Engine (browser)
    ↓ fetch via Ember Data adapter
Nginx proxy no Console (/financeiro/int/*)
    ↓ proxy_pass
Order Gateway (Node.js, porta 3000, rotas /financeiro/*)
    ↓ chama
Asaas API (https://api.asaas.com)
```

**O Node.js Order Gateway serve DUPLA função:**
1. Recebe webhooks/polling de marketplaces → cria ordens no FleetOps
2. Serve como backend para ambos os Ember Engines (financeiro + integrações)

---

### Risco 5: Volume Extremo (10.000 pedidos/dia)

**Problema:** Operar 10.000 pedidos diários é Missão Crítica. O Order Gateway precisa processar picos de webhooks de múltiplos PDVs simultaneamente sem perder eventos ou sobrecarregar a API do FleetOps (que pode responder com Rate Limits ou timeouts).

**Solução (Arquitetura de Alta Performance):**
1. **Fila de Eventos (Message Broker):** Usaremos **Redis + BullMQ** no Order Gateway. Webhooks (ex: iFood, Open Delivery) apenas *enfileiram* o payload no Redis e recebem HTTP 200 OK imediato. Workers assíncronos processam a fila e criam a Ordem no FleetOps.
2. **Node.js Cluster Mode / PM2:** O Order Gateway será escalado usando todas as CPUs disponíveis para maximizar a concorrência na porta 3000.
3. **Database Tuning:** Purga automática de `WebhookRequestLog` e indexação de UUIDs e timestamps. Tabelas de rastreamento (`positions`) sofrerão arquivamento em cold storage a cada 30 dias.

---

### Risco 6: Multi-tenant Antes de Ter Clientes

**Decisão:** Multi-tenant (Fase 3) só acontece **após** validar o sistema com a Expresso Neves. Sem cliente pagante piloto, não investimos em white label.

---

### Risco 7: Open Delivery — Agora Entendemos

**Descobertas da pesquisa:**

O Open Delivery é um **padrão de comunicação REST** (OpenAPI 3.0, v1.7.0) com 3 módulos:

| Módulo | Nosso Papel | O que implementamos |
|--------|------------|---------------------|
| **Merchant** | Não aplicável | N/A — somos logística, não cardápio |
| **Orders** | **LOGISTICS SERVICE** | Recebemos pedidos, devolvemos status |
| **Logistics** | **LOGISTICS SERVICE** | `POST /logistics/delivery`, tracking, finish |

**Fluxo Open Delivery para nós (LOGISTICS SERVICE):**
```
PDV/Cardápio (Software Service ou Ordering App)
    ↓ POST /logistics/delivery (novo pedido)
Nosso Order Gateway recebe
    ↓ Normaliza → Cria Ordem no FleetOps
Motoboy aceita no Navigator
    ↓ Status updates
Order Gateway devolve:
    POST /deliveryUpdate (webhook) → PDV sabe que "motoboy saiu"
```

**Endpoints que PRECISAMOS implementar (nosso lado):**
- `POST /oauth/token` — autenticação OAuth2
- `POST /logistics/delivery` — receber nova entrega
- `POST /logistics/readyForPickup/{id}` — pedido pronto para coleta
- `POST /logistics/orderPicked/{id}` — motoboy coletou
- `POST /logistics/finishDelivery/{id}` — entregue
- `POST /logistics/cancel/{id}` — cancelar
- `GET /logistics/delivery/{id}` — detalhes
- `POST /logistics/availability` — verificar disponibilidade/preço

**Sandbox disponível:** https://developer.opendelivery.com.br

---

---

## Pesquisa Estratégica: Fleetbase Headless & Asaas (Clonando Stripe)

### 1. Fleetbase Headless Architecture
Realizei uma imersão na arquitetura do Fleetbase (pesquisando soluções prontas e o código-fonte clonado). O Fleetbase foi desenhado 100% como **API-first (Headless)**:
- **Separação Frontend/Backend:** O backend logístico (`fleetops-api`) não possui frontend atrelado. O "Storefront" (E-commerce) e o "Navigator" (App do Motorista) são construídos em **React Native**.
- **Painéis Customizados:** Desenvolvedores frequentemente constroem painéis administrativos inteiros (Dashboards B2B, White-label) usando **Next.js ou React** separados do Fleetbase. 
- **O Motor Fica Intacto:** Como previmos, delegar a interface pesada para um frontend Headless (Next.js/React) conversando com nosso **Order Gateway (Node.js)** protege totalmente o `fleetops-api`. O motor de despacho processará apenas dados puros de ordens, mantendo a escalabilidade.

### 2. Integração Asaas: O Clone do Stripe
Analisei como a extensão do Stripe foi nativamente implementada dentro do `storefront-api` (nos arquivos `CheckoutController.php` e `Gateway.php`). A arquitetura é extremamente elegante e espelha exatamente o que faremos para o Asaas:
1. **Configuração via Gateway:** A chave da API do Stripe fica associada ao Lojista na tabela `gateways` (campo JSON `config`).
2. **Geração de Cobrança (Checkout):** A API inicia um `PaymentIntent` no Stripe e retorna o segredo para o frontend pagar.
3. **Webhook de Captura:** O webhook escuta o sucesso do Stripe, cria uma entidade `Transaction` no Fleetbase, fatura os itens e despacha a `Order` no FleetOps.

**A Decisão Aberta (Sua Escolha):**
A arquitetura do Asaas será um "clone" lógico dessa estrutura do Stripe. Podemos implementar isso de duas formas:
- **Opção A (Recomendada pela nossa Fase 0):** Implementar o webhook e a geração da cobrança do Asaas dentro do nosso **Order Gateway (Node.js)**. Ele serve como intermediário "Headless", atualizando a API do Fleetbase em seguida.
- **Opção B (Totalmente Nativo):** Desenvolver uma extensão nativa em PHP diretamente no código do `fleetbase` que você clonou.

Aguardo sua decisão sobre onde o código do Asaas vai residir para prosseguirmos com a **Fase 1**!

## Decisões Confirmadas

| Decisão | Escolha |
|---------|---------|
| Descontinuar Next.js | ✅ Sim (após migração completa) |
| Provedor Fintech | **Asaas** |
| Order Gateway | **Node.js no EasyPanel** (dupla função: backend + gateway) |
| Foco de Integração | **Open Delivery** (padrão Logistics Service) |
| Backend dos Engines | Node.js via proxy nginx |

---

## Fases Reordenadas (por Risco)

### Fase 0 — Validação Técnica (Semana 1)

> [!IMPORTANT]
> **NENHUM código novo nesta fase.** Apenas validar que as peças existentes funcionam.

**Checklist:**

#### FleetOps API
- [ ] Acessar Developers no console Fleetbase
- [ ] Gerar API Key (`flb_live_...`)
- [ ] Via curl/Postman: `POST /fleet-ops/api/v1/payloads` (criar payload)
- [ ] Via curl/Postman: `POST /fleet-ops/api/v1/orders` (criar ordem)
- [ ] Verificar ordem no console FleetOps
- [ ] Criar Order Config se necessário

#### Navigator App
- [ ] Instalar Navigator no celular de teste
- [ ] Configurar host: `https://expresso-neves-api.a3rpjn.easypanel.host`
- [ ] Criar driver de teste no console
- [ ] Login no Navigator com driver de teste
- [ ] Enviar ordem → verificar se aparece no app
- [ ] Aceitar → marcar como entregue → verificar ciclo completo

#### Open Delivery Sandbox
- [ ] Registrar no https://developer.opendelivery.com.br
- [ ] Obter credenciais sandbox
- [ ] Testar `POST /logistics/delivery` com payload de exemplo
- [ ] Entender formato exato do payload de entrega

#### Asaas Sandbox
- [ ] Criar conta em https://sandbox.asaas.com
- [ ] Gerar API Key sandbox
- [ ] Via API: criar customer, criar cobrança PIX, verificar status
- [ ] Testar transferência (simular repasse)

**Entregável:** Documento de validação com ✅/❌ para cada item. Se algo falhar, ajustar o plano antes de investir semanas de desenvolvimento.

---

### Fase 1 — Integrações Engine + Order Gateway (Semanas 2-4)

#### 1A. Order Gateway (Node.js — EasyPanel)

Novo serviço no EasyPanel, porta 3000:

```
order-gateway/
├── src/
│   ├── server.ts                 # Fastify HTTP server
│   ├── config.ts                 # Env vars
│   │
│   ├── routes/
│   │   ├── open-delivery/        # Endpoints Open Delivery Logistics
│   │   │   ├── auth.ts           # POST /oauth/token
│   │   │   ├── delivery.ts       # POST /logistics/delivery
│   │   │   ├── status.ts         # readyForPickup, orderPicked, finish
│   │   │   ├── cancel.ts         # POST /logistics/cancel/{id}
│   │   │   └── availability.ts   # POST /logistics/availability
│   │   │
│   │   ├── integracoes-api/      # Backend para o Ember Engine
│   │   │   ├── list.ts           # GET /integracoes/int/v1/integrations
│   │   │   ├── configure.ts      # POST/PUT credentials
│   │   │   └── logs.ts           # GET logs de pedidos
│   │   │
│   │   └── financeiro-api/       # Backend para Financeiro Engine
│   │       ├── dashboard.ts      # GET KPIs
│   │       ├── cobrancas.ts      # CRUD cobranças Asaas
│   │       └── repasses.ts       # CRUD repasses Asaas
│   │
│   ├── services/
│   │   ├── fleetops.ts           # Client para FleetOps API
│   │   ├── asaas.ts              # Client para Asaas API
│   │   └── open-delivery.ts      # Callbacks para PDVs
│   │
│   ├── normalizer.ts             # Pedido OD → Ordem FleetOps
│   └── database.ts               # Logs em MySQL (mesmo do Fleetbase)
│
├── Dockerfile
├── package.json
└── .env.example
```

#### 1B. Integrações Engine (Ember — Console)

```
integracoes-engine/
├── addon/
│   ├── engine.js
│   ├── extension.js              # Tab "Integrações" no header
│   ├── adapters/
│   │   └── integration.js        # Extends @fleetbase/ember-core adapter
│   ├── models/
│   │   └── integration.js        # Ember Data model
│   ├── routes/
│   │   ├── home.js               # Dashboard
│   │   ├── catalogo/index.js     # Catálogo
│   │   ├── configurar.js         # Config credenciais
│   │   └── logs/index.js         # Pedidos recebidos
│   ├── controllers/
│   │   ├── home.js
│   │   ├── catalogo/index.js     # Usa @service store
│   │   ├── configurar.js
│   │   └── logs/index.js
│   └── templates/
│       ├── application.hbs
│       ├── home.hbs
│       ├── catalogo/index.hbs
│       ├── configurar.hbs
│       └── logs/index.hbs
├── index.js
└── package.json
```

#### 1C. Nginx Proxy Update

Adicionar proxy no Dockerfile do console:
```nginx
location /integracoes/int/ {
    proxy_pass http://expresso_neves_order_gateway:3000/integracoes-api/;
}
location /financeiro/int/ {
    proxy_pass http://expresso_neves_order_gateway:3000/financeiro-api/;
}
```

---

### Fase 2 — Camada Fintech Asaas (Semanas 5-7)

- Integrar Asaas API no Order Gateway (Node.js)
- Expandir Financeiro Engine com rotas `cobrancas` e `repasses`
- Conectar WeeklyRulesEngine → Asaas (repasse PIX automático)
- Dashboard financeiro com KPIs reais da API Asaas

---

### Fase 3 — SaaS + White Label (Semanas 8-10)

Só após validar com Expresso Neves operando 100% no novo sistema.

---

### Fase 4 — Migração Controlada (Semana 11)

Desligar Machine + Next.js apenas após operação estável.

---

## Cronograma Revisado

| Fase | Semanas | Entregável | Risco |
|------|---------|-----------|-------|
| **0 — Validação** | 1 | Checklist ✅/❌ de viabilidade | 🔴 Crítico |
| **1 — Integrações** | 2-4 | Order Gateway + Open Delivery + Ember Engine | 🟡 Médio |
| **2 — Fintech** | 5-7 | Asaas integrado + Cobranças + Repasses | 🟢 Baixo |
| **3 — SaaS** | 8-10 | Multi-tenant + White Label | 🟢 Baixo |
| **4 — Migração** | 11 | Desligar Machine + Next.js | 🔴 Alto |

**A Fase 0 é a mais importante.** Se algo falhar na validação, reajustamos antes de investir semanas.

## Próximo Passo Imediato

Começar a **Fase 0** — validar FleetOps API, Navigator, Open Delivery sandbox e Asaas sandbox. Posso começar testando a API do Fleetbase agora.
