FROM oven/bun:1.3.10-alpine AS deps
WORKDIR /app
COPY apps/game/package.json apps/game/bun.lock ./
RUN bun install --production

FROM oven/bun:1.3.10-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY apps/game/package.json apps/game/bun.lock apps/game/tsconfig.json ./
COPY apps/game/src ./src

EXPOSE 2567
CMD ["bun", "run", "start:server"]
