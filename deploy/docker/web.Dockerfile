FROM oven/bun:1.3.10-alpine AS build
WORKDIR /app

COPY bun.lock package.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN cd apps/web && bun install

COPY apps/web ./apps/web

ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=${VITE_SERVER_URL}

RUN cd apps/web && bun run build

FROM nginx:1.27-alpine AS runner
COPY deploy/docker/nginx-web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
