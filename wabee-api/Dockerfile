# ─── WABEE API — Dockerfile multi-stage ───────────────────────────────────────
# Build:
#   docker build --secret id=node_auth,env=NODE_AUTH_TOKEN -t wabee-api .
# El secret es necesario para instalar @r4d-26/core desde GitHub Packages.

# ── Stage 1: build ──
FROM node:22-bookworm-slim AS builder

# OpenSSL es requerido por el engine de Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar manifiestos y config de registro privado
COPY package*.json .npmrc ./
COPY patches ./patches

# Instalar dependencias usando el token de GitHub Packages como secret de build
RUN --mount=type=secret,id=node_auth \
    NODE_AUTH_TOKEN="$(cat /run/secrets/node_auth 2>/dev/null || echo '')" \
    npm ci

# Copiar el resto del código y compilar
COPY . .
RUN npm run prisma:generate && npm run build

# ── Stage 2: runtime ──
FROM node:22-bookworm-slim AS runtime

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Copiar artefactos del build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY package.json ./

EXPOSE 4000
CMD ["node", "dist/src/index.js"]
