# ---------- 1. Frontend (React + Vite) ----------
FROM node:24.21.0-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ---------- 2. Backend (Fastify + TypeScript) ----------
FROM node:24.21.0-alpine AS server
WORKDIR /server
COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY server/ ./
RUN npm run build && npm prune --omit=dev

# ---------- 3. Runtime: só Node + o que foi compilado ----------
FROM node:24.21.0-alpine

# Commit que gerou a imagem (passado pelo CI). O ZAP da hml lê /version.txt.
ARG VERSION=local

# Correções do Alpine ainda não publicadas na imagem base; npm/yarn/corepack não são
# usados em runtime e trazem dependências próprias (menos superfície de ataque e de CVEs)
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

WORKDIR /app
ENV NODE_ENV=production PORT=8080 VERSION=$VERSION
COPY --from=server /server/package.json ./
COPY --from=server /server/node_modules ./node_modules
COPY --from=server /server/dist ./dist
COPY --from=server /server/migrations ./migrations
COPY --from=web /web/dist ./public
RUN echo "$VERSION" > public/version.txt

# Usuário sem privilégios (o Kubernetes também força runAsNonRoot e rootfs somente leitura)
USER 10101:10101
EXPOSE 8080
CMD ["node", "dist/index.js"]
