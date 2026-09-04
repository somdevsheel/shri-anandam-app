# syntax=docker/dockerfile:1

# ---- Base ----
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo

# ---- Dependencies (cached layer) ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/validation/package.json packages/validation/
COPY packages/config/package.json packages/config/
COPY services/api/package.json services/api/
RUN pnpm install --frozen-lockfile --filter @shri-anandam/api...

# ---- Build ----
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared-types packages/shared-types
COPY packages/validation packages/validation
COPY packages/config packages/config
COPY services/api services/api
RUN pnpm --filter @shri-anandam/api prisma:generate
RUN pnpm --filter @shri-anandam/api build

# ---- Runtime ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo

RUN addgroup -S app && adduser -S app -G app

COPY --from=build /repo/pnpm-workspace.yaml /repo/package.json ./
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/services/api/dist ./services/api/dist
COPY --from=build /repo/services/api/package.json ./services/api/package.json
COPY --from=build /repo/services/api/prisma ./services/api/prisma
COPY --from=build /repo/services/api/node_modules ./services/api/node_modules
COPY --from=build /repo/node_modules ./node_modules

USER app
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "require('http').get('http://127.0.0.1:4000/live', r => process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "services/api/dist/main.js"]
