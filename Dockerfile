# ============================================================
# DOCKERFILE MULTI-STAGE — RADAR DE CONFORMIDADE FISCAL
# ============================================================
# Node.js 20 Alpine Linux (Leve, Seguro e Otimizado para Produção)
# ============================================================

# ── STAGE 1: BUILD DO FRONTEND E DEPENDÊNCIAS ────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar ferramentas de compilação para módulos nativos (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copiar manifests de dependências
COPY package*.json ./

# Instalar dependências completas
RUN npm ci

# Copiar todo o código-fonte
COPY . .

# Compilar frontend com Vite
RUN npm run build

# ── STAGE 2: RUNNER DE PRODUÇÃO ──────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3001

# Instalar dependências de execução (SQLite e bibliotecas essenciais)
RUN apk add --no-cache sqlite-libs

# Copiar arquivos de dependências e instalar apenas produção
COPY package*.json ./
RUN apk add --no-cache python3 make g++ && \
    npm ci --only=production && \
    apk del python3 make g++

# Copiar build do frontend gerado no Stage 1
COPY --from=builder /app/dist ./dist

# Copiar backend e configurações
COPY --from=builder /app/server ./server
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Criar diretórios de persistência
RUN mkdir -p /app/data /app/vault

# Expor porta da aplicação
EXPOSE 3001

# Comando de inicialização do servidor Express + TSX
CMD ["npx", "tsx", "server/index.ts"]
