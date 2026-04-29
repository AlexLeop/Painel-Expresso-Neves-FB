# Setup Fleetbase no EasyPanel — Guia Definitivo

> Projeto: `expresso_neves` | VPS: `191.101.235.244`
> Última atualização: 26/Abril/2026

## Status Final dos Serviços

| Serviço | Tipo | Imagem/Fonte | Status |
|---------|------|-------------|--------|
| mysql | Database | MySQL 8.0 | ✅ Verde |
| redis | Database | Redis 4 Alpine | ✅ Verde |
| api | App | `fleetbase/fleetbase-api:latest` (Imagem Docker) | ✅ Verde |
| console | App | Dockerfile customizado | ✅ Verde |
| queue | App | Dockerfile customizado | ⚠️ Verificar logs |
| scheduler | App | `fleetbase/fleetbase-api:latest` (Imagem Docker) | ⚠️ Verificar |
| socket | App | `socketcluster/socketcluster:v17.4.0` | ⚠️ Verificar |

---

## Credenciais

### MySQL
- Usuário: `mysql`
- Senha: `admin`
- Database: `expresso_neves`
- Host: `expresso_neves_mysql:3306`

### Redis
- Senha: `f08ead003f97b11d6490`
- Host: `expresso_neves_redis:6379`

### Console Admin
- Email: `admin@expressoneves.com`
- Senha: `admin123`

---

## Configuração por Serviço

### API (Imagem Docker: `fleetbase/fleetbase-api:latest`)

**Porta:** 8000

**Variáveis de Ambiente:**
```
DATABASE_URL=mysql://mysql:admin@expresso_neves_mysql:3306/expresso_neves
APP_KEY=base64:3I0YlDh2QHYvtUcssfYcqG0rkKm9ypY0XbndjX1WMSs=
QUEUE_CONNECTION=sync
CACHE_DRIVER=redis
CACHE_PATH=/fleetbase/api/storage/framework/cache
CACHE_URL=tcp://:f08ead003f97b11d6490@expresso_neves_redis:6379
REDIS_URL=tcp://:f08ead003f97b11d6490@expresso_neves_redis:6379
SESSION_DOMAIN=localhost
BROADCAST_DRIVER=socketcluster
MAIL_FROM_NAME=Fleetbase
APP_NAME=ExpressoNeves
LOG_CHANNEL=daily
REGISTRY_HOST=https://registry.fleetbase.io
REGISTRY_PREINSTALLED_EXTENSIONS=true
OSRM_HOST=https://router.project-osrm.org
ENVIRONMENT=production
APP_DEBUG=true
CONSOLE_HOST=https://expresso-neves-console.a3rpjn.easypanel.host
APP_URL=https://expresso-neves-api.a3rpjn.easypanel.host
MAIL_MAILER=log
GOOGLE_APPLICATION_CREDENTIALS=/fleetbase/api/storage/firebase-credentials.json
FIREBASE_PROJECT_ID=dummy-disabled
```

> **NOTA (27/Abr/2026):** `MAIL_MAILER=log` evita erro de AWS SES. Firebase dummy evita crash ao despachar ordens. Quando configurar FCM real, substituir por credenciais válidas.

### API FleetOps — Referência Rápida

- **Base URL:** `https://expresso-neves-api.a3rpjn.easypanel.host/v1/`
- **Auth:** `Authorization: Bearer flb_live_uE2GYXFODK7HvCGg7vB7`
- **Versão:** Fleetbase 0.7.37

| Endpoint | Método | Testado |
|----------|--------|---------|
| `/v1/drivers` | GET | ✅ |
| `/v1/places` | POST | ✅ |
| `/v1/payloads` | POST | ✅ |
| `/v1/orders` | GET/POST | ✅ |
| `/v1/orders/{id}` | GET/PUT | ✅ |
| `/v1/orders/{id}/start` | POST | ✅ |
| `/v1/contacts` | GET | ✅ (vazio) |
| `/v1/service-areas` | GET | ✅ (vazio) |

**Ciclo de vida da ordem:** `created → started → driver_enroute → completed`

---

### Console (Fonte: Dockerfile)

**Porta:** 4200

**Dockerfile (colar na aba "Dockerfile" do EasyPanel):**
```dockerfile
FROM fleetbase/fleetbase-console:latest
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
    '    location / {' \
    '        try_files $uri $uri/ /index.html =404;' \
    '    }' \
    '}' > /etc/nginx/conf.d/default.conf
EXPOSE 4200
CMD ["sh", "-c", "echo '{\"API_HOST\":\"\"}' > /usr/share/nginx/html/fleetbase.config.json && nginx -g 'daemon off;'"]
```

**Variáveis de Ambiente:**
```
API_HOST=http://expresso_neves_api:8000/
SOCKETCLUSTER_HOST=
SOCKETCLUSTER_PORT=8000
```

> **IMPORTANTE:** O CMD do Dockerfile sobrescreve o `fleetbase.config.json` com `API_HOST` vazio, forçando o console a usar caminhos relativos (`/int/v1/...`). O nginx proxy redireciona essas requests para a API.

---

### Queue (Fonte: Dockerfile)

**Dockerfile:**
```dockerfile
FROM fleetbase/fleetbase-api:latest
WORKDIR /fleetbase/api
ENTRYPOINT []
CMD ["php", "artisan", "queue:work", "--tries=3", "--sleep=3"]
```

**Variáveis de Ambiente:**
```
DATABASE_URL=mysql://mysql:admin@expresso_neves_mysql:3306/expresso_neves
APP_KEY=base64:3I0YlDh2QHYvtUcssfYcqG0rkKm9ypY0XbndjX1WMSs=
QUEUE_CONNECTION=redis
CACHE_DRIVER=redis
CACHE_PATH=/fleetbase/api/storage/framework/cache
CACHE_URL=tcp://:f08ead003f97b11d6490@expresso_neves_redis:6379
REDIS_URL=tcp://:f08ead003f97b11d6490@expresso_neves_redis:6379
SESSION_DOMAIN=localhost
BROADCAST_DRIVER=socketcluster
APP_NAME=ExpressoNeves
LOG_CHANNEL=daily
ENVIRONMENT=production
```

---

### Scheduler (Imagem Docker: `fleetbase/fleetbase-api:latest`)

**Comando (Avançado):** `go-crond --verbose root:./crontab`

**Variáveis de Ambiente:** mesmas do Queue (sem APP_KEY não é necessário, mas não prejudica).

---

### Socket (Imagem Docker: `socketcluster/socketcluster:v17.4.0`)

**Porta:** 8000

**Variáveis de Ambiente:**
```
SOCKETCLUSTER_WORKERS=10
SOCKETCLUSTER_BROKERS=10
```

---

## Inicialização do Banco (Executar 1x)

Via terminal do serviço `api`:

```bash
php artisan migrate --force
php artisan db:seed --force
```

### Criar/Resetar Admin via Tinker:

```bash
php artisan tinker
```

```php
$user = \Fleetbase\Models\User::first();
$user->password = 'admin123';
$user->email_verified_at = now();
$user->phone_verified_at = now();
$user->status = 'active';
$user->save();
```

---

## Arquitetura de Rede

```
Browser → EasyPanel Traefik (HTTPS)
   ├── console.a3rpjn.easypanel.host → console:4200 (nginx)
   │       └── /int/* → proxy_pass → api:8000 (FrankenPHP)
   └── api.a3rpjn.easypanel.host → api:8000 (FrankenPHP)

Rede interna Docker:
   api:8000 ← queue (worker)
           ← scheduler (cron)
           ← redis:6379 (cache)
           ← mysql:3306 (database)
           ← socket:8000 (websocket)
```

## Problemas Resolvidos

| Problema | Causa | Solução |
|----------|-------|---------|
| 502 Proxy Error | Console não tinha proxy para API | Dockerfile com nginx proxy `/int/` |
| Login infinito | `fleetbase.config.json` apontava `localhost:8000` | CMD sobrescreve config com `API_HOST` vazio |
| "Unexpected token '<'" | API retornava HTML (SPA fallback) | Nginx proxy direciona `/int/` para API |
| User not verified | `email_verified_at` era null | Tinker: `$user->email_verified_at = now()` |
| Queue "Connecting to Websocket" | FrankenPHP ENTRYPOINT ignorava CMD | Dockerfile com `ENTRYPOINT []` |
