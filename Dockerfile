# BuyBuy — multi-stage build for a slim, standalone Next.js server.
# The app runs as a non-root user; config/secrets are supplied at runtime via env.

# ---- Stage 1: dependencies ----
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Stage 2: build ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next.js standalone output needs runtime envs present at build time for
# build-time code generation. These defaults are non-secret; real secrets like
# AUTH_SECRET are supplied at runtime via compose and never baked into layers.
ENV NEXT_TELEMETRY_DISABLED=1
ENV MONGODB_URI=mongodb://127.0.0.1:27017/buybuy
ENV APP_URL=http://localhost:3000
RUN npm run build

# ---- Stage 3: runtime (slim) ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Local media uploads live under /app/.data; give the app user a writable volume.
RUN mkdir -p /app/.data/uploads && chown -R nextjs:nodejs /app/.data

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
