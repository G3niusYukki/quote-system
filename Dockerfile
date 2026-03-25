# ---- Base Stage ----
FROM node:20-alpine AS base
WORKDIR /app

# ---- Dependencies Stage ----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# ---- Builder Stage ----
FROM deps AS builder
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Runner Stage ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# 不以 root 运行
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

# 复制构建产物和必要文件
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
