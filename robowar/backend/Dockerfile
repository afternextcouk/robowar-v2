FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

# ─── Development target ───────────────────────────────────────────────────────
FROM base AS development
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 4000
CMD ["dumb-init", "npm", "run", "dev"]

# ─── Builder target ───────────────────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build

# ─── Production target ────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
EXPOSE 4000
USER node
CMD ["dumb-init", "node", "dist/index.js"]
