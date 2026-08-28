# Production image for Railway
FROM node:20-slim AS builder

ENV CI=true
RUN npm install -g pnpm@10.26.1
WORKDIR /app

COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm run build:railway

# Runtime image: no dependency reinstall here. The build stage already
# contains everything required by the compiled server.
FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production
ENV CI=true
# Keep the normal system paths explicit because Railway starts containers
# without an interactive shell/TTY.
ENV PATH="/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin"

# Some Railway services can retain an old Start Command that invokes pnpm.
# Install it in the FINAL image and verify both the binary and its version.
RUN npm install -g pnpm@10.26.1 \
    && command -v pnpm \
    && pnpm --version

COPY --from=builder /app/artifacts /app/artifacts
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml

EXPOSE 8080

# Preferred start command. Railway should use this rather than an old
# service-level pnpm command.
CMD ["node", "artifacts/api-server/dist/index.cjs"]
