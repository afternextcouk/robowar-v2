FROM node:22-alpine AS base
WORKDIR /app

# ─── Development target ───────────────────────────────────────────────────────
FROM base AS development
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ─── Builder target ───────────────────────────────────────────────────────────
FROM base AS builder
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_ELDR_CONTRACT
ARG VITE_CHAIN_ID
ARG VITE_WEB3_RPC_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ─── Production target (nginx) ────────────────────────────────────────────────
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
