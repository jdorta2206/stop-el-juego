# Production image for Railway
FROM node:20-slim AS builder

ENV CI=true
RUN npm install -g pnpm@10.26.1
WORKDIR /app

COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm run build:railway

# Keep the runtime image deliberately simple. Do not run a second pnpm install
# here: the build stage already contains the complete workspace dependencies.
FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production
ENV CI=true

# Railway may have a persisted Start Command that invokes pnpm, so keep pnpm
# available in the runtime image as well. Verify it during the image build.
RUN npm install -g pnpm@10.26.1 && pnpm --version

COPY --from=builder /app/artifacts /app/artifacts
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml

EXPOSE 8080

# Normal Railway start path. If Railway has an old pnpm Start Command saved,
# pnpm is still installed above and can execute it.
CMD ["node", "artifacts/api-server/dist/index.cjs"]
