# STAGE 1: Builder
# Usamos Node.js para clonar o console do Fleetbase e compilar junto com o nosso engine
FROM node:18-alpine AS builder

# Instala git para podermos clonar o repositório oficial
RUN apk add --no-cache git python3 make g++

WORKDIR /build

# 1. Clona o Console oficial do Fleetbase
# Fixamos numa branch/tag estável se necessário (aqui usamos master/main)
RUN git clone https://github.com/fleetbase/console.git .

# 2. Copia os nossos Engines locais para dentro do builder
COPY integracoes-engine /build-engine/integracoes-engine
COPY financeiro-engine /build-engine/financeiro-engine

# Instala pnpm globalmente pois o console requer pnpm
RUN npm install -g pnpm

# 3. Adiciona os nossos engines como dependência local no projeto do console
RUN pnpm add "file:/build-engine/integracoes-engine"
RUN pnpm add "file:/build-engine/financeiro-engine"

# 4. Instala todas as dependências do console (incluindo os nossos addons)
RUN pnpm install

# 5. Roda o build de produção do Ember
RUN pnpm run build

# STAGE 2: Produção (Nginx Proxy)
# Agora pegamos a imagem oficial base apenas para usar sua estrutura Nginx pré-configurada
FROM fleetbase/fleetbase-console:latest

LABEL maintainer="Expresso Neves/Fleetbase"
LABEL description="Console Fleetbase Customizado (Com Engine Integrado)"

# Limpa o HTML original e injeta o nosso HTML recém-compilado que já contém o Engine
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /build/dist /usr/share/nginx/html/

# Copia os assets de branding e i18n
# Presume-se que a pasta console-custom está no context
COPY console-custom/branding.css /usr/share/nginx/html/assets/branding.css
COPY console-custom/translations/pt-BR.json /usr/share/nginx/html/translations/pt-BR.json

# Sobrescreve o index.html para injetar o css customizado (branding)
RUN sed -i 's|</head>|<link rel="stylesheet" href="/assets/branding.css"></head>|g' /usr/share/nginx/html/index.html

# Gera o arquivo de configuração do NGINX para o proxy do Order Gateway
RUN printf '%s\n' \
    'server {' \
    '    listen 4200;' \
    '    root /usr/share/nginx/html;' \
    '    index index.html;' \
    '    location /int/ {' \
    '        proxy_pass http://expresso_neves_api:8000;' \
    '        proxy_set_header Host $host;' \
    '        proxy_set_header X-Real-IP $remote_addr;' \
    '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
    '        proxy_set_header X-Forwarded-Proto $scheme;' \
    '        proxy_connect_timeout 600;' \
    '        proxy_send_timeout 600;' \
    '        proxy_read_timeout 600;' \
    '    }' \
    '    location /integracoes/int/ {' \
    '        proxy_pass http://expresso_neves_order_gateway:3000/integracoes-api/;' \
    '        proxy_set_header Host $host;' \
    '        proxy_set_header X-Real-IP $remote_addr;' \
    '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
    '        proxy_set_header X-Forwarded-Proto $scheme;' \
    '    }' \
    '    location /financeiro/int/ {' \
    '        proxy_pass http://expresso_neves_order_gateway:3000/financeiro-api/;' \
    '        proxy_set_header Host $host;' \
    '        proxy_set_header X-Real-IP $remote_addr;' \
    '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
    '        proxy_set_header X-Forwarded-Proto $scheme;' \
    '    }' \
    '    location / {' \
    '        try_files $uri $uri/ /index.html =404;' \
    '    }' \
    '}' > /etc/nginx/conf.d/default.conf

EXPOSE 4200

CMD ["sh", "-c", "echo '{\"API_HOST\":\"\"}' > /usr/share/nginx/html/fleetbase.config.json && nginx -g 'daemon off;'"]
