# Production image for Railway
FROM node:20-slim AS builder

ENV CI=true
RUN npm install -g pnpm@10.26.1
WORKDIR /app

COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm run build:railway

FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production
ENV CI=true
ENV PATH="/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin"

RUN npm install -g pnpm@10.26.1 \
    && command -v pnpm \
    && pnpm --version

COPY --from=builder /app/artifacts /app/artifacts
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml

EXPOSE 8080

ENTRYPOINT ["node"]
CMD ["artifacts/api-server/dist/index.cjs"]
