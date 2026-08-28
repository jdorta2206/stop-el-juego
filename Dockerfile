# Etapa de construcción
FROM node:20-slim AS builder

# Railway/CI no debe ejecutar operaciones interactivas de pnpm.
ENV CI=true

RUN npm install -g pnpm@10.26.1
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm run build:railway

# --- Segunda etapa: imagen de producción ---
FROM node:20-slim
WORKDIR /app

# La imagen final ejecuta Node directamente; no necesita reinstalar dependencias
# ni ejecutar pnpm install en producción.
COPY --from=builder /app/artifacts /app/artifacts
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml

EXPOSE 8080
CMD ["node", "artifacts/api-server/dist/index.cjs"]
