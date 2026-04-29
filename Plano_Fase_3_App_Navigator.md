# Fase 3: App Navigator (Driver App) & Onboarding Híbrido

Este documento detalha o plano técnico para modificar o aplicativo móvel **Fleetbase Navigator** (React Native) e implementar o motor de aprovação de motoristas.

## 1. Modificação do App Navigator (Frontend React Native)

O aplicativo oficial do Fleetbase para motoristas (Navigator) é feito em React Native. Precisaremos baixar o código-fonte dele e injetar nossas customizações:

### A. Boilerplate da Aba "Financeiro"
- Adicionar uma nova aba "Financeiro" (Wallet) no Bottom Navigation do App.
- **Telas Inclusas:**
  - **Dashboard:** Exibe o saldo da carteira (Asaas) consumindo `GET /driver/wallet`.
  - **Ganhos:** Exibe o extrato de viagens e diárias consumindo `GET /driver/earnings`.
- **UI:** Reutilizaremos os componentes nativos do React Native (`Tailwind`/`NativeBase` dependendo da versão do Fleetbase), injetando as variáveis globais de Preto e Vermelho (Branding White Label).

### B. Tela "Aguardando Aprovação"
- Injetar um fluxo na rota inicial (`AuthLoading` / `Dashboard`): se o status do motorista retornado for `pending`, a tela será bloqueada com a mensagem de "Conta em análise" e sem acesso às rotas operacionais de despacho.

## 2. Order Gateway (Backend APIs)

O nosso Node.js assumirá um novo papel: **BFF (Backend For Frontend)** para os motoboys.

#### [NEW] `src/routes/driver-api/auth.ts` (`POST /register`)
- Fluxo Híbrido de Onboarding:
  1. O App submete nome, CNH, CPF e a **Chave PIX**.
  2. Gateway valida se a chave PIX é válida (via Asaas ou Regex/Format).
  3. Gateway chama a API do FleetOps para criar o driver (`POST /v1/drivers`) forçando `status: 'pending'` e salvando o PIX no campo `meta`.
  4. Nenhuma conta no Asaas é criada neste momento (economia de processamento para leads recusados).

#### [NEW] `src/routes/driver-api/wallet.ts` (`GET /driver/wallet` & `GET /driver/earnings`)
- **Earnings:** Lê os registros do fechamento (`weeklyClosure`) e das ordens finalizadas (`meta.financials`) pelo uuid do motorista.
- **Wallet:** Mostra o saldo acumulado (se retido) ou os extratos de transferências PIX.

## 3. Webhooks & Aprovação Manual

O Fleetbase possui um sistema nativo de Webhooks. Vamos orquestrá-lo:

#### [NEW] `src/routes/webhooks/fleetbase.ts`
- Endpoint: `POST /webhooks/fleetbase`
- **Listener de `driver.updated`:** 
  1. O Gateway recebe o webhook quando um Lojista ou Admin altera o status do motorista de `pending` para `active` no Console.
  2. Dispara a rotina de **Ativação Financeira**: cadastra o motorista no Asaas (se for necessário gerar conta, mas como faremos PIX direto, não há custo de customer aqui, apenas salvamos a aprovação).
  3. Dispara a **Sequência de Boas-Vindas** (Email/SMS via Twilio/Sendgrid se configurado).

---

## ⚠️ PERGUNTAS EM ABERTO (Aguardo sua decisão)

> [!CAUTION]
> 1. **Código Fonte do App:** Atualmente não temos a pasta do `fleetbase/navigator-app` no seu diretório `Sistema Fleetbase`. Você quer que eu execute um `git clone` do repositório oficial do Navigator App do Fleetbase aqui mesmo para podermos injetar o código React Native?
> 2. **Chaves PIX e Validação:** Durante o `POST /register`, o gateway vai receber a chave PIX do motorista. Se for CPF/Telefone/Email, a validação de formato é fácil. Quer que implementemos uma validação real na API do Banco Central / Asaas antes de deixar o motorista concluir o cadastro, ou apenas validamos a máscara localmente por enquanto?
