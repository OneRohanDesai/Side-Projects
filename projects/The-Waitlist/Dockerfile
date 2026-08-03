# Single-process The Waitlist (API + static UI + SQLite)
FROM oven/bun:1.3 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY packages ./packages
COPY apps ./apps
RUN bun install --frozen-lockfile
RUN bun run --filter @the-waitlist/web build

FROM oven/bun:1.3-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV DATABASE_URL=/data/waitlist.db
ENV WEB_ROOT=/app/apps/web/build
COPY --from=build /app /app
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 3001
CMD ["bun", "run", "apps/server/src/index.ts"]
