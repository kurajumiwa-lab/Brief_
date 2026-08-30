# ---------------------------------------------------------------------------
# BRIEF — one container: the API serves the compiled frontend in production.
# The data dir MUST be a volume (docker-compose mounts one at /data).
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS client
WORKDIR /app
COPY package.json package-lock.json ./
COPY preview/package.json preview/
COPY server/package.json server/
COPY tc/package.json tc/
RUN npm ci --workspace=preview --include-workspace-root=false 2>/dev/null || npm install
COPY . .
RUN npm run build:client

FROM node:20-bookworm-slim
ENV NODE_ENV=production PORT=8080 BRIEF_DATA_DIR=/data
WORKDIR /app
COPY server/package.json server/package-lock.json* server/
RUN cd server && npm ci --omit=dev || npm install --omit=dev
COPY server ./server
COPY --from=client /app/preview/dist ./preview/dist
# Non-root + a writable data mount point.
RUN useradd -m brief && mkdir -p /data && chown -R brief:brief /data /app
USER brief
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/src/index.js"]
