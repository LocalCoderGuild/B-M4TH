# Cloudflare Tunnel config (B-M4TH)

This folder contains deployment templates for exposing:

- `game.example.com` -> web app (`apps/web` preview on `:5173`)
- `api.example.com` -> Colyseus + HTTP API server (`:2567`)

## 1) Prepare env files

Server env from repo root:

```bash
cp .env.server.example .env.server
```

Web env from `apps/web`:

```bash
cd apps/web
cp .env.production.example .env.production
```

Edit values to your real domains.

## 2) Build and run services

Terminal A (server):

```bash
cd /home/simon/Documents/Projects/B-M4TH
set -a
source .env.server
set +a
rtk bun run start:server
```

Terminal B (web):

```bash
cd /home/simon/Documents/Projects/B-M4TH/apps/web
rtk bun run build
rtk bunx vite preview --host 0.0.0.0 --port 5173
```

## 3) Configure cloudflared

Copy the template:

```bash
mkdir -p ~/.cloudflared
cp deploy/cloudflare/config.yml.example ~/.cloudflared/config.yml
```

Set:

- `tunnel` to your tunnel UUID
- `credentials-file` to your generated credentials JSON path
- hostnames to your real domains

Then run:

```bash
cloudflared tunnel run <tunnel-name>
```

## 4) One-time tunnel DNS wiring

```bash
cloudflared tunnel login
cloudflared tunnel create b-m4th
cloudflared tunnel route dns b-m4th game.example.com
cloudflared tunnel route dns b-m4th api.example.com
```
