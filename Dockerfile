# Etapa de construcción
FROM node:20-slim AS builder

# CI evita que pnpm intente operaciones interactivas durante Railway.
ENV CI=true

RUN npm install -g pnpm@10.26.1
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm run build:railway

# --- Segunda etapa: imagen de producción ---
FROM node:20-slim
WORKDIR /app

COPY --from=builder /app/artifacts /app/artifacts
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml

# Las dependencias ya están instaladas en el builder.
# No ejecutar pnpm install de nuevo en producción.

EXPOSE 8080
CMD ["pnpm", "run", "start:railway"]
