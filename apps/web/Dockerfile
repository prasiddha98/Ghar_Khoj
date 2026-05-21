# Multi-stage build for production web

# Builder
FROM node:18-alpine AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm@8 --no-fund --silent
RUN pnpm install --frozen-lockfile --prod=false

COPY . .
# Build the web site
RUN pnpm --filter @workspace/ghar-khoj run build

# Nginx runner
FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
