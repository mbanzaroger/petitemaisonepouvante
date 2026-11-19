# syntax=docker/dockerfile:1
# Étape 1 : construction du bundle (image de build, non livrée)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts --no-audit --no-fund
COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN npx tsc -p tsconfig.app.json --noEmit && npx vite build

# Étape 2 : nginx non root (UID 101, port 8080), compatible avec un système de fichiers racine en lecture seule
# (écritures limitées à /tmp et /etc/nginx/conf.d, montés en volumes vides dans Kubernetes)
FROM nginxinc/nginx-unprivileged:1.30-alpine
ENV KEYCLOAK_URL=http://localhost:8080 \
    KEYCLOAK_REALM=pme \
    KEYCLOAK_CLIENT_ID=pme-web
USER root
# Correctifs publiés après l'image de base : paquets Alpine (brotli, curl, expat, musl, zlib… : Trivy, 16/11/2026)
# et nginx lui-même depuis le dépôt officiel nginx.org (1.30.7 du 18/11/2026 : 10 CVE), clé de signature vérifiée
# par son empreinte comme dans l'image officielle. Sans effet dès que l'image de base embarque les versions corrigées.
ARG NGINX_KEY_SHA512=e09fa32f0a0eab2b879ccbbc4d0e4fb9751486eedda75e35fac65802cc9faa266425edf83e261137a2f4d16281ce2c1a5f4502930fe75154723da014214f0655
RUN apk upgrade --no-cache \
    && wget -q -O /tmp/nginx_signing.rsa.pub https://nginx.org/keys/nginx_signing.rsa.pub \
    && echo "${NGINX_KEY_SHA512} */tmp/nginx_signing.rsa.pub" | sha512sum -c - \
    && mv /tmp/nginx_signing.rsa.pub /etc/apk/keys/ \
    && apk upgrade --no-cache -X "https://nginx.org/packages/alpine/v$(grep -Eo '^[0-9]+\.[0-9]+' /etc/alpine-release)/main" \
    && rm -f /etc/apk/keys/nginx_signing.rsa.pub /etc/nginx/conf.d/default.conf /usr/share/nginx/html/* \
    && nginx -v
COPY nginx/templates /etc/nginx/templates
COPY nginx/pme-api /etc/nginx/pme-api
COPY --from=build /app/dist /usr/share/nginx/html
RUN rm -f /usr/share/nginx/html/config.json
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
