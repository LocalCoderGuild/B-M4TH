FROM oven/bun:1.3.10-alpine AS build
WORKDIR /app

COPY apps/web/package.json apps/web/bun.lock ./
RUN bun install

COPY apps/web .

ARG VITE_PUBLIC_URL
ARG VITE_ENGINE_URL
ARG VITE_API_URL

ENV VITE_PUBLIC_URL=${VITE_PUBLIC_URL}
ENV VITE_ENGINE_URL=${VITE_ENGINE_URL}
ENV VITE_API_URL=${VITE_API_URL}


RUN bun run build

FROM nginx:1.27-alpine AS runner
COPY deploy/docker/nginx-web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
