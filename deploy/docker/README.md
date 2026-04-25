# Docker deploy (public IP)

This setup runs:

- `web` on host port `80` (nginx serving built `apps/web/dist`)
- `server` on host port `2567` (Colyseus + API)

## 1) Prepare env

```bash
cd /home/simon/Documents/Projects/B-M4TH
cp deploy/docker/.env.example .env
```

Edit `.env` values:

- `PUBLIC_BASE_URL`: web URL users open (example: `http://xxx.x.xxx.xx`)
- `CLIENT_ORIGIN`: same as web origin
- `VITE_SERVER_URL`: API URL used by frontend (example: `http://xxx.x.xxx.xx:2567`)
- optional host ports (`WEB_EXPOSE_PORT`, `API_EXPOSE_PORT`)

## 2) Build and run

```bash
cd /home/simon/Documents/Projects/B-M4TH
docker compose up -d --build
```

## 3) Check

```bash
docker compose ps
curl http://127.0.0.1:2567/api/health
```

## 4) Update

```bash
cd /home/simon/Documents/Projects/B-M4TH
docker compose up -d --build
```

## Notes

- If you change `VITE_SERVER_URL`, rebuild `web` (`docker compose up -d --build web`).
- Open firewall for both exposed ports (default `80` and `2567`).
- For production TLS, place Nginx/Caddy/Traefik in front and switch env URLs to `https://...`.

## GitHub Actions Docker CI/CD

Workflow: [`.github/workflows/docker-cicd.yml`](../../.github/workflows/docker-cicd.yml)

What it does on push (`main`/`master`/`develop`/`dev`) and manual dispatch:

1. Runs quality gate (`typecheck` + `ci:engine`)
2. Builds and pushes:
   - `ghcr.io/<owner>/b-m4th-server:<sha>`
   - `ghcr.io/<owner>/b-m4th-web:<sha>`
3. Stops after image push (no server deployment)

### Required GitHub Variables

- `VITE_SERVER_URL` (example: `http://xxx.x.xxx.xx:2567`, used at web image build time)
