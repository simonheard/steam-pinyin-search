FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY shared ./shared
COPY server ./server
RUN npm run build:server

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    STEAM_PINYIN_HOST=0.0.0.0 \
    STEAM_PINYIN_PORT=8787 \
    STEAM_PINYIN_DB=/data/catalog.sqlite \
    STEAM_PINYIN_ENABLE_LOCALIZED_DETAILS=false \
    STEAM_PINYIN_SYNC_ON_START=true

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

RUN mkdir -p /data && chown -R node:node /app /data
USER node

EXPOSE 8787
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["sh", "-c", "if [ \"$STEAM_PINYIN_SYNC_ON_START\" = \"true\" ]; then node dist/server/src/sync-cli.js || echo '[SteamPinyinSearch] initial catalog sync failed; starting with the existing database'; fi; exec node dist/server/src/cli.js"]
