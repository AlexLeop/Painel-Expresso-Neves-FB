# STAGE 1: Builder
# Usamos o MONOREPO do Fleetbase (versões coordenadas) em vez do repo standalone antigo
FROM node:18-alpine AS builder

RUN apk add --no-cache git python3 make g++

WORKDIR /build

# 1. Clona o MONOREPO oficial (contém console v0.7.37 com ember-core 0.3.18)
RUN git clone --depth 1 https://github.com/fleetbase/fleetbase.git /tmp/fleetbase

# 2. Copia apenas o diretório console do monorepo
RUN cp -r /tmp/fleetbase/console/* . && cp -r /tmp/fleetbase/console/.* . 2>/dev/null || true
RUN rm -rf /tmp/fleetbase

# 3. Copia os nossos Engines locais para dentro do builder
COPY integracoes-engine /build-engine/integracoes-engine
COPY financeiro-engine /build-engine/financeiro-engine
COPY console-custom/templates/dashboard.hbs /build/app/templates/console/home.hbs

# Instala pnpm (versão compatível com o monorepo)
RUN npm install -g pnpm@9

# 4. Adiciona os nossos engines como dependência local
RUN pnpm add "file:/build-engine/integracoes-engine"
RUN pnpm add "file:/build-engine/financeiro-engine"

# 5. Instala todas as dependências
RUN pnpm install

# 6. Configura as variáveis de ambiente para o build
ENV API_HOST="https://expresso-neves-api.a3rpjn.easypanel.host"
ENV SOCKETCLUSTER_HOST="expresso-neves-expresso-neves-console.a3rpjn.easypanel.host"
ENV SOCKETCLUSTER_PORT="443"
ENV SOCKETCLUSTER_SECURE="true"

# 7. Build de produção do Ember
RUN pnpm run build --environment=production

# 8. Verificação do build
RUN test -f /build/dist/index.html || (echo "ERRO: BUILD FALHOU!" && exit 1)

# STAGE 2: Produção (Nginx puro)
FROM nginx:alpine

LABEL maintainer="Expresso Neves/Fleetbase"

COPY --from=builder /build/dist /usr/share/nginx/html/

# Branding CSS
COPY console-custom/branding.css /usr/share/nginx/html/assets/branding.css
RUN sed -i 's|</head>|<link rel="stylesheet" href="/assets/branding.css"></head>|g' /usr/share/nginx/html/index.html

# Nginx config
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
