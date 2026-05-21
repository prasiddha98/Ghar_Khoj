# Multi-stage build for production API

# Builder
FROM node:18-alpine AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm@8 --no-fund --silent
RUN pnpm install --frozen-lockfile --prod=false

COPY . .
# Build only the api package
RUN pnpm --filter @workspace/api-server build

# Runner
FROM node:18-alpine AS runner
WORKDIR /app

# Copy production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/index.js"]
