# Production image for the API server.
# The image intentionally runs one process: the API server owns the HTTP
# health endpoint, PostgreSQL schema bootstrap, and Telegram long polling.
FROM node:20-alpine

ARG PNPM_VERSION=10.26.1
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc tsconfig.base.json tsconfig.json ./
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

RUN pnpm install --frozen-lockfile --filter @workspace/api-server...
RUN pnpm --filter @workspace/api-server run build

WORKDIR /app/artifacts/api-server

ENV NODE_ENV=production
ENV PORT=8080
ENV LOG_LEVEL=info

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

USER node
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]