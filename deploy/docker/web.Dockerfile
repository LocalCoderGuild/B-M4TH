FROM oven/bun:1.3.10-alpine AS build
WORKDIR /app

COPY apps/web/package.json apps/web/bun.lock ./
RUN bun install

COPY apps/web .

ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=${VITE_SERVER_URL}

RUN bun run build

FROM nginx:1.27-alpine AS runner
COPY deploy/docker/nginx-web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
