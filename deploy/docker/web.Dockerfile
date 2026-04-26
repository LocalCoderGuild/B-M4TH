FROM oven/bun:1.3.10-alpine AS build
WORKDIR /app

COPY apps/web/package.json apps/web/bun.lock ./
RUN bun install

COPY apps/web .

ENV VITE_PUBLIC_URL=__VITE_PUBLIC_URL__
ENV VITE_ENGINE_URL=__VITE_ENGINE_URL__
ENV VITE_API_URL=__VITE_API_URL__

RUN bun run build

FROM nginx:1.27-alpine AS runner
COPY deploy/docker/nginx-web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/docker/web-entrypoint.sh /docker-entrypoint.d/40-inject-vite-env.sh
RUN chmod +x /docker-entrypoint.d/40-inject-vite-env.sh

EXPOSE 80
