# ─── WABEE Web — Dockerfile multi-stage ───────────────────────────────────────
# Las variables VITE_* se hornean en tiempo de build:
#   docker build \
#     --build-arg VITE_API_URL=https://wabee-api.onrender.com/v1 \
#     --build-arg VITE_SUPABASE_URL=... \
#     --build-arg VITE_SUPABASE_ANON_KEY=... \
#     -t wabee-web .

# ── Stage 1: build ──
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# ── Stage 2: nginx ──
FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
