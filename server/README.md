# Self-hosted Store search server

The repository includes the complete Fastify, SQLite, catalog sync, pinyin index, and `/api/search` server. The simplest deployment uses Docker Compose.

## Requirements

- Docker Engine with Docker Compose v2.
- A Steam Web API key kept only on the server. Register one at https://steamcommunity.com/dev/apikey and never put it in the plugin ZIP or browser configuration.
- A public deployment must use HTTPS. Put Caddy, nginx, Traefik, Cloudflare Tunnel, or another TLS reverse proxy in front of port 8787. Steam Store pages can block plain HTTP as mixed content.

## Start

From the repository root:

```bash
cp .env.docker.example .env
```

Edit `.env`, set `STEAM_WEB_API_KEY`, then run:

```bash
docker compose up -d --build api
docker compose logs -f api
```

The first start synchronizes the official Steam catalog before starting the API. The catalog is persisted in the `catalog-data` Docker volume. If the initial sync fails, the API still starts with the last successful database so an upstream outage does not destroy an existing deployment.

Verify it:

```bash
curl http://127.0.0.1:8787/health
curl "http://127.0.0.1:8787/api/search?q=hsh&limit=10"
```

After HTTPS is configured, open **Steam → Settings → Millennium → Plugins → Steam Pinyin Search**, enable Store search, enter the public base URL such as `https://steam-search.example.com`, save, and reload Steam.

## Update the catalog

Run an incremental sync whenever desired:

```bash
docker compose --profile tools run --rm sync
```

The API health probe refreshes the in-memory index from SQLite. For immediate pickup, call `/health` once or restart the API container:

```bash
docker compose restart api
```

For scheduled updates, run the sync command from cron/systemd timer or the hosting platform's scheduled-job facility. Do not run multiple sync jobs concurrently against the same SQLite file.

For a Linux host deployed at `/opt/steam-pinyin-search`, reusable systemd units are included:

```bash
sudo install -m 0644 deploy/systemd/steam-pinyin-search-sync.service /etc/systemd/system/
sudo install -m 0644 deploy/systemd/steam-pinyin-search-sync.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now steam-pinyin-search-sync.timer
```

The timer runs daily with a randomized delay, prevents overlapping syncs, and refreshes the API's in-memory index afterward.

## Update the application

```bash
git pull
docker compose up -d --build api
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `STEAM_WEB_API_KEY` | required for sync | Server-only Steam Web API key. |
| `STEAM_PINYIN_BIND_ADDRESS` | `127.0.0.1` | Host address published by Compose. Keep loopback when using a reverse proxy. |
| `STEAM_PINYIN_PUBLIC_PORT` | `8787` | Host port published by Compose. |
| `STEAM_PINYIN_ALLOWED_ORIGINS` | Steam Store/checkout origins | Comma-separated CORS allowlist. |
| `STEAM_PINYIN_ENABLE_LOCALIZED_DETAILS` | `false` | Enables the rate-limited unofficial Simplified Chinese details adapter. Read `docs/research.md` before enabling. |
| `STEAM_PINYIN_SYNC_ON_START` | `true` | Incrementally sync before starting the API container. |
| `STEAM_PINYIN_ALIASES` | `/app/catalog/aliases.zh-CN.json` | Curated CC0 Chinese names and common aliases imported after each catalog sync. |

The server accepts no SteamID, library list, account token, machine ID, or analytics payload. `/api/search` receives only `q` and `limit`.

The API container may run without a Web API key when `STEAM_PINYIN_SYNC_ON_START=false`, for example when serving an already-populated persistent volume. Catalog sync still requires the key, and the `sync` Compose profile fails fast when it is missing.

## Chinese aliases

`catalog/aliases.zh-CN.json` is a deliberately small, reviewable CC0 overlay keyed by Steam AppID. It supplies popular Chinese display names and unambiguous community aliases such as `老头环`, `黑猴`, and `大表哥2`. Alias text is also converted to full pinyin and initials, so `laotouhuan` and `lth` can match `ELDEN RING`.

Contributions should include the exact Steam AppID and avoid generic words that would create noisy matches. The overlay is merged with existing aliases and never creates catalog rows for unknown AppIDs.

## Without Docker

Node.js 22.5 or newer is supported:

```bash
npm ci
npm run build:server
npm run server:sync
npm run server
```

Use the variables from `server/.env.example` in the process environment. The application does not automatically parse `.env` files outside Docker Compose.
