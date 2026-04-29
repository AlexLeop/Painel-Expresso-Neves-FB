# STAGE 1: Builder
# Usamos Node.js para clonar o console do Fleetbase e compilar junto com os nossos engines
FROM node:18-alpine AS builder

# Instala git e ferramentas de compilação nativas
RUN apk add --no-cache git python3 make g++

WORKDIR /build

# 1. Clona o Console oficial do Fleetbase
RUN git clone https://github.com/fleetbase/console.git .

# 2. Copia os nossos Engines locais para dentro do builder
COPY integracoes-engine /build-engine/integracoes-engine
COPY financeiro-engine /build-engine/financeiro-engine

# Instala pnpm globalmente pois o console requer pnpm
RUN npm install -g pnpm

# 3. Adiciona os nossos engines como dependência local no projeto do console
RUN pnpm add "file:/build-engine/integracoes-engine"
RUN pnpm add "file:/build-engine/financeiro-engine"

# O pnpm hoisting causa problemas em polyfills implícitos do ember-file-upload
RUN pnpm add "ember-tracked-storage-polyfill"

# 4. Instala todas as dependências do console (incluindo os nossos addons)
RUN pnpm install

# 5. Configura as variáveis de ambiente em tempo de build para o Ember injetar no HTML
# CORRIGIDO: API_HOST agora aponta para o backend PHP/Laravel, NÃO para o próprio console
ENV API_HOST="https://expresso-neves-api.a3rpjn.easypanel.host"
ENV SOCKETCLUSTER_HOST="expresso-neves-expresso-neves-console.a3rpjn.easypanel.host"
ENV SOCKETCLUSTER_PORT="443"
ENV SOCKETCLUSTER_SECURE="true"

# 6. Roda o build de produção do Ember
RUN pnpm run build

# 7. Verificação: se o build falhou silenciosamente, o Docker para aqui com erro explícito
RUN test -f /build/dist/index.html || (echo "ERRO: BUILD FALHOU - dist/index.html não encontrado!" && exit 1)

# STAGE 2: Produção (Nginx PURO)
# CORRIGIDO: Usar nginx:alpine puro em vez de fleetbase/fleetbase-console:latest
# A imagem fleetbase/fleetbase-console contém assets PRÉ-COMPILADOS antigos que
# sobrescreviam/conflitavam com o nosso build, causando o erro getCompany
FROM nginx:alpine

LABEL maintainer="Expresso Neves/Fleetbase"
LABEL description="Console Fleetbase Customizado (Com Engines Integrados)"

# Copia APENAS o resultado do nosso build compilado
COPY --from=builder /build/dist /usr/share/nginx/html/

# Copia o CSS de branding customizado
COPY console-custom/branding.css /usr/share/nginx/html/assets/branding.css

# Injeta o CSS de branding no index.html
RUN sed -i 's|</head>|<link rel="stylesheet" href="/assets/branding.css"></head>|g' /usr/share/nginx/html/index.html

# Configuração do Nginx
RUN printf '%s\n' \
    'server {' \
    '    listen 4200;' \
    '    root /usr/share/nginx/html;' \
    '    index index.html;' \
    '    location / {' \
    '        try_files $uri $uri/ /index.html =404;' \
    '    }' \
    '}' > /etc/nginx/conf.d/default.conf

EXPOSE 4200

CMD ["nginx", "-g", "daemon off;"]
